/**
 * 笔记（Note）数据访问层：CRUD、关键词检索（标题加权）与知识库问答
 * （先检索相关笔记，再让 AI 仅基于笔记作答；离线/无 Key 时降级为匹配列表）。
 */

import db from './index';
import { Note, AskResult } from '../../shared/types';
import { answerWithNotes } from '../services/aiService';

function rowToNote(r: any): Note {
  let images: string[] | undefined;
  if (r.images) {
    try {
      images = JSON.parse(r.images);
    } catch {
      images = undefined;
    }
  }
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    created_at: r.created_at,
    updated_at: r.updated_at ?? null,
    images,
  };
}

export function listNotes(): Note[] {
  const rows = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC, created_at DESC').all();
  return rows.map(rowToNote);
}

export function getNote(id: string): Note | null {
  const r = db.prepare('SELECT * FROM notes WHERE id=?').get(id) as any;
  return r ? rowToNote(r) : null;
}

export function createNote(title: string, content: string, images?: string[]): Note {
  const now = Date.now();
  const id = (globalThis as any).crypto.randomUUID();
  const imagesJson = images?.length ? JSON.stringify(images) : null;
  db.prepare('INSERT INTO notes (id,title,content,created_at,updated_at,images) VALUES (?,?,?,?,?,?)').run(
    id,
    title,
    content,
    now,
    now,
    imagesJson
  );
  return getNote(id)!;
}

export function updateNote(
  id: string,
  patch: Partial<Pick<Note, 'title' | 'content' | 'images'>>
): Note | null {
  const existing = getNote(id);
  if (!existing) return null;
  const title = patch.title ?? existing.title;
  const content = patch.content ?? existing.content;
  const images = patch.images ?? existing.images;
  const imagesJson = images?.length ? JSON.stringify(images) : null;
  db.prepare('UPDATE notes SET title=?, content=?, updated_at=?, images=? WHERE id=?').run(
    title,
    content,
    Date.now(),
    imagesJson,
    id
  );
  return getNote(id);
}

export function deleteNote(id: string): void {
  db.prepare('DELETE FROM notes WHERE id=?').run(id);
}

function tokenize(q: string): string[] {
  return q
    .split(/[\s,，。、；;:：!！?？"'""''（）()\[\]【】\n\r]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export interface SearchHit {
  note: Note;
  snippet: string;
}

/** 关键词检索 + 相关性排序（命中 token 数越多越靠前） */
export function searchNotes(query: string, limit = 8): SearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const lowerTokens = tokens.map((t) => t.toLowerCase());
  const all = (db.prepare('SELECT * FROM notes').all() as any[]).map(rowToNote);
  const scored = all
    .map((note) => {
      const titleLower = note.title.toLowerCase();
      const contentLower = note.content.toLowerCase();
      const full = titleLower + '\n' + contentLower;
      let score = 0;
      let firstHit = -1;
      for (const tk of lowerTokens) {
        const inTitle = titleLower.indexOf(tk);
        const inContent = contentLower.indexOf(tk);
        if (inTitle >= 0) {
          score += 3; // 标题命中权重更高
          if (firstHit < 0) firstHit = note.title.indexOf(tk);
        } else if (inContent >= 0) {
          score += 1;
          if (firstHit < 0) firstHit = note.content.indexOf(tk);
        }
      }
      return { note, score, firstHit };
    })
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || (b.note.updated_at ?? 0) - (a.note.updated_at ?? 0));
  return scored.slice(0, limit).map((x) => ({
    note: x.note,
    snippet: makeSnippet(x.note.content, x.firstHit),
  }));
}

function makeSnippet(content: string, idx: number): string {
  if (idx < 0) return content.slice(0, 60);
  const start = Math.max(0, idx - 20);
  const end = Math.min(content.length, idx + 60);
  return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
}

/** 知识库问答：先检索相关笔记，再让 AI 基于笔记回答；无 AI 时降级为返回匹配列表。支持图片。 */
export async function askQuestion(question: string, images?: string[]): Promise<AskResult> {
  // 检索本身可能因数据库异常抛错，这里必须兜底，否则会冒泡成调用方的「识别失败」
  let hits: SearchHit[] = [];
  try {
    hits = searchNotes(question, 6);
  } catch {
    hits = [];
  }
  const sources = hits.map((h) => h.note);
  if (sources.length === 0) {
    return {
      answer: images?.length
        ? '我的笔记里没有找到相关内容，且当前为离线/未连接状态，无法理解图片。你可以先在「知识库」里记录，再来问我。'
        : '我的笔记里没有找到相关内容。你可以先在「知识库」里记录，再来问我。',
      sources: [],
      usedAI: false,
    };
  }
  try {
    const answer = await answerWithNotes(question, sources, images);
    return { answer, sources, usedAI: true };
  } catch {
    const list = sources.map((n) => `• ${n.title}`).join('\n');
    return {
      answer: images?.length
        ? `（图片理解失败，可能是当前模型不支持图片；以下是相关笔记）\n${list}`
        : `（未连接 AI，以下是相关笔记）\n${list}`,
      sources,
      usedAI: false,
    };
  }
}
