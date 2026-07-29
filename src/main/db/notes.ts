/**
 * 笔记（Note）数据访问层：CRUD、关键词检索（标题加权）与知识库问答
 * （先检索相关笔记，再让 AI 仅基于笔记作答；离线/无 Key 时降级为匹配列表）。
 */

import db from './index';
import { Note, AskResult } from '../../shared/types';
import { loadSettings } from '../db/settings';

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

const STOP_WORDS = new Set([
  '的', '了', '是', '在', '和', '与', '或', '有', '我', '你', '他', '她', '它', '们', '这', '那', '哪', '什么', '怎么',
  '为什么', '为何', '谁', '多少', '吗', '呢', '吧', '啊', '哦', '嗯', '的', '地', '得', '着', '过', '被', '把', '给',
]);

function isStopWord(t: string): boolean {
  return STOP_WORDS.has(t);
}

function hasCJK(t: string): boolean {
  return /[\u4e00-\u9fa5]/.test(t);
}

function ngrams(text: string, n: number): string[] {
  const chars = Array.from(text);
  const grams: string[] = [];
  for (let i = 0; i <= chars.length - n; i++) {
    grams.push(chars.slice(i, i + n).join(''));
  }
  return grams;
}

interface SearchTerm {
  term: string;
  weight: number;
}

/** 把查询扩展成不同粒度的检索项：完整词权重高，中文长词补充 2-gram/3-gram 提高召回 */
function expandQueryTerms(query: string): SearchTerm[] {
  const rawTokens = tokenize(query);
  const terms: SearchTerm[] = [];
  for (const t of rawTokens) {
    const lower = t.toLowerCase();
    if (isStopWord(lower)) continue;
    terms.push({ term: lower, weight: t.length >= 4 ? 4 : 3 }); // 完整词权重高
    if (hasCJK(t) && t.length >= 4) {
      // 中文 3-gram 权重较高，2-gram 权重较低；避免过短 noise
      for (const g of ngrams(t, 3)) terms.push({ term: g.toLowerCase(), weight: 1.8 });
      if (t.length >= 6) {
        for (const g of ngrams(t, 2)) terms.push({ term: g.toLowerCase(), weight: 0.9 });
      }
    }
  }
  return terms;
}

export interface SearchHit {
  note: Note;
  snippet: string;
}

/** 关键词检索 + 相关性排序（命中 token 数越多、完整匹配越多越靠前） */
export function searchNotes(query: string, limit = 8): SearchHit[] {
  const terms = expandQueryTerms(query);
  if (terms.length === 0) return [];
  const all = (db.prepare('SELECT * FROM notes').all() as any[]).map(rowToNote);
  const scored = all
    .map((note) => {
      const titleLower = note.title.toLowerCase();
      const contentLower = note.content.toLowerCase();
      let score = 0;
      let firstHit = -1;
      for (const { term, weight } of terms) {
        const inTitle = titleLower.indexOf(term);
        const inContent = contentLower.indexOf(term);
        if (inTitle >= 0) {
          score += weight * 3; // 标题命中权重更高
          if (firstHit < 0) firstHit = titleLower.indexOf(term);
        } else if (inContent >= 0) {
          score += weight;
          if (firstHit < 0) firstHit = contentLower.indexOf(term);
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

function buildQuestionContext(notes: Note[], question: string): string {
  const context = notes
    .map((n, i) => `【笔记${i + 1}】标题：${n.title}\n内容：${n.content}`)
    .join('\n\n');
  return `以下是相关的笔记内容：\n\n${context}\n\n用户问题：${question}`;
}

/** 知识库问答：仅基于提供的笔记内容回答，不编造。支持附带图片（多模态）。 */
export async function answerWithNotes(question: string, notes: Note[], images?: string[]): Promise<string> {
  const settings = loadSettings();
  if (settings.localOnly || !settings.apiKey) {
    throw new Error('NO_AI');
  }
  const fetchFn = (globalThis as any).fetch as typeof fetch;
  const textContext = buildQuestionContext(notes, question);
  const userContent: any = images?.length
    ? [{ type: 'text', text: textContext }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))]
    : textContext;
  const resp = await fetchFn(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model: settings.model || 'deepseek-chat',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            '你是个人知识库问答助手。只能依据下面提供的【笔记】内容和用户上传的图片回答用户问题，' +
            '不要编造笔记中不存在的信息。如果笔记或图片中没有相关信息，请明确说"我的笔记里没有这方面的记录"。' +
            '回答要简洁、直接。当笔记内容是表格、列表或任务分配时，请根据用户提到的关键词直接定位到对应行并给出答案；' +
            '只有确实找不到对应项时才请用户补充细节。' +
            '当引用某条笔记的内容时，请在该句末尾标注来源，格式如「（出自《笔记标题》）」，以便用户追溯出处。',
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content?.trim() || '（AI 返回为空）';
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
