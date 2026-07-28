/**
 * AI 记忆库（Memory）数据访问层：要点 CRUD、可选向量语义检索（余弦相似度），
 * 无向量时降级为关键词打分。importance 高者优先展示。
 */

import db from './index';
import { Memory, MemoryDraft, MemoryType } from '../../shared/types';

function rowToMemory(r: any): Memory {
  let embedding: number[] | null = null;
  if (r.embedding) {
    try {
      embedding = JSON.parse(r.embedding);
    } catch {
      embedding = null;
    }
  }
  return {
    id: r.id,
    content: r.content,
    type: (r.type as MemoryType) || 'fact',
    importance: (r.importance as 1 | 2 | 3) || 2,
    source: r.source,
    source_id: r.source_id ?? null,
    access_count: r.access_count ?? 0,
    created_at: r.created_at,
    embedding,
  };
}

export function listMemories(limit = 200): Memory[] {
  const rows = db.prepare('SELECT * FROM memories ORDER BY importance DESC, created_at DESC LIMIT ?').all(limit) as any[];
  return rows.map(rowToMemory);
}

export function getMemory(id: string): Memory | null {
  const r = db.prepare('SELECT * FROM memories WHERE id=?').get(id) as any;
  return r ? rowToMemory(r) : null;
}

export function createMemory(draft: MemoryDraft): Memory {
  const now = Date.now();
  const id = (globalThis as any).crypto.randomUUID();
  db.prepare(
    `INSERT INTO memories (id,content,type,importance,source,source_id,access_count,created_at)
     VALUES (?,?,?,?,?,?,0,?)`
  ).run(
    id,
    draft.content,
    draft.type || 'fact',
    draft.importance ?? 2,
    draft.source || 'manual',
    draft.source_id ?? null,
    now
  );
  return getMemory(id)!;
}

export function deleteMemory(id: string): void {
  db.prepare('DELETE FROM memories WHERE id=?').run(id);
}

export function bumpAccess(id: string): void {
  db.prepare('UPDATE memories SET access_count = access_count + 1 WHERE id=?').run(id);
}

function tokenize(q: string): string[] {
  return q
    .split(/[\s,，。、；;:：!！?？"'""''（）()\[\]【】\n\r]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * 记忆检索：默认关键词命中打分（标题/内容加权）；
 * 若传入 queryEmbedding 且记忆带 embedding，则改用余弦相似度（语义检索）。
 */
export function searchMemories(
  query: string,
  limit = 20,
  queryEmbedding?: number[] | null
): Memory[] {
  const all = (db.prepare('SELECT * FROM memories').all() as any[]).map(rowToMemory);
  if (!query.trim()) return all.slice(0, limit);

  // 语义检索路径
  if (queryEmbedding && queryEmbedding.length) {
    const scored = all
      .map((m) => {
        let score = 0;
        if (m.embedding && m.embedding.length === queryEmbedding.length) {
          let dot = 0;
          let na = 0;
          let nb = 0;
          for (let i = 0; i < queryEmbedding.length; i++) {
            dot += queryEmbedding[i] * m.embedding[i];
            na += queryEmbedding[i] * queryEmbedding[i];
            nb += m.embedding[i] * m.embedding[i];
          }
          score = na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
        }
        return { m, score };
      })
      .filter((x) => x.score > 0.2);
    if (scored.length) {
      scored.sort((a, b) => b.score - a.score);
      scored.slice(0, limit).forEach((x) => bumpAccess(x.m.id));
      return scored.slice(0, limit).map((x) => x.m);
    }
  }

  // 关键词检索路径（兜底 / 离线）
  const tokens = tokenize(query).map((t) => t.toLowerCase());
  const scored = all
    .map((m) => {
      const titleLower = m.content.toLowerCase(); // 记忆无标题，直接按内容匹配
      let score = 0;
      for (const tk of tokens) {
        const idx = titleLower.indexOf(tk);
        if (idx >= 0) score += 2;
      }
      score += (4 - m.importance) * 0.5; // 重要记忆略加权
      return { m, score };
    })
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || (b.m.importance - a.m.importance));
  scored.slice(0, limit).forEach((x) => bumpAccess(x.m.id));
  return scored.slice(0, limit).map((x) => x.m);
}
