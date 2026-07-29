/**
 * AI 服务层：封装对 OpenAI 兼容接口（默认 DeepSeek）的调用。
 * 提供自然语言解析、任务拆解、执行顺序推荐、知识库问答、统一智能输入、每日简报、
 * 目标规划、记忆提炼与可选向量化。所有入口在无 Key / 仅本地模式 / 调用失败时，
 * 自动降级到本地规则或模板，保证离线可用。
 */

import { loadSettings } from '../db/settings';
import { Task, TaskDraft, Priority, ParseResult, Note, SmartResult, SmartIntent, Briefing, BriefingText, Recurrence, SubTask, PlanStage, Memory, MemoryType, ChatMessage } from '../../shared/types';
import { getBriefing } from '../db/briefing';
import { searchNotes, askQuestion, answerWithNotes } from '../db/notes';

const CATEGORY_HINT = '工作/生活/学习/健康/其他';
const TIMEZONE = 'Asia/Shanghai';
const TZ_OFFSET = '+08:00';

function nowInShanghai(): string {
  return new Date().toLocaleString('zh-CN', { timeZone: TIMEZONE });
}

/** 解析时间字符串：显式带时区/Z 则按 ISO 解析；否则按 Asia/Shanghai 解析 */
function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  // 已有明确时区信息（+08:00、-05:00、Z）
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(v)) {
    const t = Date.parse(v);
    return isNaN(t) ? null : t;
  }
  // 无时区：按 Asia/Shanghai 解析
  const normalized = v.replace(' ', 'T');
  const t = new Date(normalized + TZ_OFFSET).getTime();
  return isNaN(t) ? null : t;
}

function normalizePriority(p: any): Priority {
  const n = Number(p);
  if (n === 1 || n === 2 || n === 3) return n;
  return 2;
}

function normalizeImportance(p: any): 1 | 2 | 3 {
  const n = Number(p);
  if (n === 1 || n === 2 || n === 3) return n;
  return 2;
}

function normalizeRecurrence(r: any): Recurrence {
  const v = String(r || '').toLowerCase();
  if (v === 'daily' || v === 'weekly' || v === 'monthly' || v === 'yearly') return v as Recurrence;
  if (/每天|每日|天天/.test(v)) return 'daily';
  if (/每周|每星期|周周/.test(v)) return 'weekly';
  if (/每月|每个月|月月/.test(v)) return 'monthly';
  if (/每年|年年|每年一次/.test(v)) return 'yearly';
  return 'none';
}

/** 本地兜底解析：关键词规则，保证离线 / 无 Key 时仍可用 */
export function localParse(text: string): TaskDraft {
  let priority: Priority = 2;
  if (/急|马上|尽快|立刻|赶紧|立即|火速/.test(text)) priority = 1;
  if (/随便|不急|有空|慢慢|再说/.test(text)) priority = 3;

  let category = '其他';
  if (/会议|客户|报告|工作|项目|老板|周报|系统|邮件|汇报/.test(text)) category = '工作';
  else if (/学习|读书|课程|考试|作业|论文/.test(text)) category = '学习';
  else if (/健身|运动|跑步|医院|体检|健康|看病/.test(text)) category = '健康';
  else if (/买|做饭|家务|家人|朋友|聚会/.test(text)) category = '生活';

  // 重要程度启发式（四象限用）
  let importance: 1 | 2 | 3 = 2;
  if (/重要|关键|必须|一定要|核心|年度|战略|考试|答辩|体检|述职|项目交付|上线|发布/.test(text)) importance = 1;
  else if (/随便|有空|顺手|可能|看看|无聊|娱乐|刷/.test(text)) importance = 3;

  let due_time: number | null = null;
  const now = new Date();
  if (/明天/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    due_time = d.getTime();
  } else if (/后天/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    d.setHours(9, 0, 0, 0);
    due_time = d.getTime();
  } else if (/今天/.test(text)) {
    const d = new Date(now);
    d.setHours(18, 0, 0, 0);
    due_time = d.getTime();
  } else if (/下周/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    due_time = d.getTime();
  }

  let recurrence: Recurrence = 'none';
  if (/每天|每日|天天/.test(text)) recurrence = 'daily';
  else if (/每周|每星期|周周/.test(text)) recurrence = 'weekly';
  else if (/每月|每个月|月月/.test(text)) recurrence = 'monthly';
  else if (/每年|年年|每年一次/.test(text)) recurrence = 'yearly';

  // 若用户未指定任何时间，默认截止时间为今天 18:00，确保每条待办都有截止时间
  if (!due_time) {
    const d = new Date(now);
    d.setHours(18, 0, 0, 0);
    due_time = d.getTime();
  }

  // 补充一条默认备注，避免空串
  const notes = `通过本地规则自动创建。建议补充具体执行细节。`;

  return { title: text.slice(0, 200), priority, importance, category, due_time, remind_at: null, notes, recurrence };
}

/** 调用 DeepSeek / OpenAI 兼容接口做结构化解析；失败或离线自动降级 */
export async function parseTask(text: string): Promise<ParseResult> {
  const settings = loadSettings();
  if (settings.localOnly || !settings.apiKey) {
    return { draft: localParse(text), usedAI: false };
  }
  try {
    const fetchFn = (globalThis as any).fetch as typeof fetch;
    const resp = await fetchFn(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model || 'deepseek-chat',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              `你是待办解析器。从用户输入提取完整字段，并以 JSON 返回：` +
              `title(必填字符串，简要描述待办内容), ` +
              `priority(必填，1高/2中/3低整数，依据"急/马上/尽快"等紧急词判断，无明确提示时默认2), ` +
              `importance(必填，1高/2中/3低整数，表示该事项的重要程度：影响目标/健康/考核/交付的给1，日常杂事给3，其余2), ` +
              `category(必填，必须从[${CATEGORY_HINT}]中选择一项，禁止省略), ` +
              `due_time(必填，精确到日期和时间的 ISO8601，若用户未明确时间请根据语义给出合理默认时间，如"今天"默认18:00、"明天"默认09:00，尽量不要返回null), ` +
              `remind_at(ISO8601 或 null), ` +
              `notes(必填，用1-2句话补充说明任务背景、执行要点或注意事项，禁止返回空串), ` +
              `recurrence(重复规则, 从[none/daily/weekly/monthly/yearly]选一, 识别"每天/每周/每月/每年"等重复需求, 没有则省略)。` +
              `重要规则：用户输入的时间均视为本地时间（东八区 / Asia/Shanghai，当前偏移 ${TZ_OFFSET}）。` +
              `例如用户说"15:30"就是指北京时间 15:30。` +
              `due_time 和 remind_at 必须返回带时区偏移的 ISO8601 字符串，格式如 "2026-07-22T15:30:00${TZ_OFFSET}"，不要返回 UTC 的 "Z"。` +
              `当前时间（Asia/Shanghai）：${nowInShanghai()}。只输出 JSON，不要其它文字。`,
          },
          { role: 'user', content: text },
        ],
      }),
    });
    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '{}';
    const obj = JSON.parse(content);
    const draft: TaskDraft = {
      title: String(obj.title || text).slice(0, 200),
      priority: normalizePriority(obj.priority),
      importance: normalizeImportance(obj.importance),
      category: String(obj.category || '').trim() || '其他',
      due_time: parseTime(obj.due_time),
      remind_at: parseTime(obj.remind_at),
      notes: String(obj.notes || '').trim() || '暂无备注',
      recurrence: normalizeRecurrence(obj.recurrence),
    };
    return { draft, usedAI: true };
  } catch {
    return { draft: localParse(text), usedAI: false };
  }
}

export interface TestResult {
  ok: boolean;
  message: string;
}

/**
 * AI 把大任务拆解成可执行的子步骤。返回 SubTask[]（默认未完成）。
 * 离线 / 无 Key 时：尝试用 notes 里的换行拆分作为兜底，否则返回空。
 */
export async function breakdownTask(title: string, notes?: string): Promise<SubTask[]> {
  const settings = loadSettings();
  const base: SubTask[] = (notes || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => ({ id: (globalThis as any).crypto.randomUUID(), title: s.replace(/^[-*]\s*/, ''), done: false }));
  if (settings.localOnly || !settings.apiKey) return base;

  try {
    const fetchFn = (globalThis as any).fetch as typeof fetch;
    const resp = await fetchFn(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model || 'deepseek-chat',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '你是任务拆解专家。把一个任务拆成 3-8 个具体、可执行、无歧义的子步骤。' +
              '以 JSON 返回：{ "steps": ["步骤1", "步骤2", ...] }。步骤要 actionable，避免空话。只输出 JSON。',
          },
          {
            role: 'user',
            content: `任务标题：${title}\n${notes ? '补充信息：' + notes : ''}`,
          },
        ],
      }),
    });
    const data = await resp.json();
    const obj = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
    const steps: string[] = Array.isArray(obj.steps) ? obj.steps : [];
    const cleaned = steps.map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
    return cleaned.length
      ? cleaned.map((s) => ({ id: (globalThis as any).crypto.randomUUID(), title: s, done: false }))
      : base;
  } catch {
    return base;
  }
}

/** 测试 AI 接口连接是否可用；支持传入当前未保存的输入项 */
export async function testConnection(opts?: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): Promise<TestResult> {
  const s = loadSettings();
  const apiKey = opts?.apiKey ?? s.apiKey;
  const baseUrl = ((opts?.baseUrl ?? s.baseUrl) || '').replace(/\/+$/, '');
  const model = (opts?.model ?? s.model) || 'deepseek-chat';

  if (s.localOnly) {
    return { ok: true, message: '当前为「仅本地模式」，不调用 AI，无需测试连接。' };
  }
  if (!apiKey) {
    return { ok: false, message: '未填写 API Key，无法测试。请在上方填写后重试。' };
  }
  if (!baseUrl) {
    return { ok: false, message: '未填写 Base URL。' };
  }
  try {
    const fetchFn = (globalThis as any).fetch as typeof fetch;
    const resp = await fetchFn(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
    if (!resp.ok) {
      let detail = '';
      try {
        const err = await resp.json();
        detail = err?.error?.message || JSON.stringify(err);
      } catch {
        /* ignore */
      }
      return { ok: false, message: `连接失败（HTTP ${resp.status}）：${detail || resp.statusText}` };
    }
    return { ok: true, message: '连接成功，API 可用 ✅' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `连接失败：${msg}` };
  }
}

/** 执行顺序推荐：紧急度 + 优先级加权，未完成任务排序 */
export function recommendOrder(): Task[] {
  const { listTasks } = require('../db/tasks');
  const tasks: Task[] = listTasks().filter((t: Task) => t.status === 'todo');
  const now = Date.now();
  return tasks
    .map((t) => {
      const pScore = t.priority === 1 ? 30 : t.priority === 2 ? 15 : 5;
      let urgency = 0;
      if (t.due_time) {
        const diff = t.due_time - now;
        if (diff < 0) urgency = 40;
        else if (diff < 3_600_000) urgency = 30;
        else if (diff < 86_400_000) urgency = 20;
        else urgency = 10;
      }
      return { task: t, score: pScore + urgency };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.task);
}

// ---------- 通用对话：多轮自由问答 ----------
const CHAT_SYSTEM =
  '你是「笃行」，一个本地优先的个人 AI 助手。你可以回答各类问题、帮助解决问题、提供建议与方案，' +
  '也可以指导用户如何记笔记、安排待办（当用户明确要求时）。' +
  '回答原则：直接、有针对性、实用，避免空话套话；能用要点就用要点。' +
  '你会结合对话历史理解用户的追问和补充——如果用户用了"上面/刚才/它/这个"等指代，请根据上下文推断指代对象。' +
  '如果用户只是在询问或讨论，就直接解答；只有当用户明确要求"记下来/建一个待办"时才提示其使用对应功能，不要擅自创建数据。';

/** 内部：基于历史做一轮通用问答（多模态 + 多轮），返回纯文本，永不抛异常。 */
async function generalAnswer(
  userText: string,
  history: ChatMessage[],
  images: string[] | undefined,
  settings: { baseUrl?: string; apiKey?: string; model?: string }
): Promise<string> {
  const fetchFn = (globalThis as any).fetch as typeof fetch;
  const hasImages = !!images?.length;
  const userContent: any = hasImages
    ? [{ type: 'text', text: userText }, ...images!.map((url) => ({ type: 'image_url', image_url: { url } }))]
    : userText;

  // 历史仅保留文本，避免把每轮图片都重复带入上下文；最多取最近 20 轮
  const historyMsgs = (history || [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  const messages: any[] = [
    { role: 'system', content: CHAT_SYSTEM },
    ...historyMsgs,
    { role: 'user', content: userContent },
  ];

  try {
    const resp = await fetchFn(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model || 'deepseek-chat',
        temperature: 0.7,
        max_tokens: 2000,
        messages,
      }),
    });
    if (!resp.ok) {
      let detail = '';
      try {
        const err = await resp.json();
        detail = err?.error?.message || JSON.stringify(err);
      } catch {
        /* ignore */
      }
      return `（对话请求失败：HTTP ${resp.status} ${detail || resp.statusText}）`;
    }
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim();
    return text || '（AI 返回为空，请换个说法再试）';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `（对话出错：${msg}）`;
  }
}

/**
 * 通用对话（对外）：基于完整历史做多轮自由问答，支持图片（多模态）。
 * 永不抛出未捕获异常——无 Key / 仅本地模式 / 网络错误时都返回明确的文字提示。
 */
export async function chatTurn(
  userText: string,
  history: ChatMessage[],
  images?: string[]
): Promise<string> {
  const settings = loadSettings();
  if (settings.localOnly || !settings.apiKey) {
    return '当前是「仅本地模式」或未配置 AI 的 API Key，暂时无法自由对话。请到「设置」中填写 API Key 与 Base URL 后重试；也可以切换到「提问」模式查询已记录的知识库。';
  }
  return generalAnswer(userText, history, images, settings);
}

// ---------- 混合问答：知识库优先 + AI 通用兜底 ----------
export interface HybridResult {
  answer: string;
  sources: Note[];
  grounded: boolean; // true=源自你的笔记；false=AI 通用知识（非来自笔记）
  usedAI: boolean;
}

/**
 * 混合问答：先查本地知识库，命中则用笔记作答（标注来源）；
 * 未命中或笔记作答失败时，自动回退到 AI 通用问答（保留多轮上下文）。
 * 无 Key / 仅本地模式时降级为「列出相关笔记」或明确提示，保证一定有回应。
 */
export async function askHybrid(
  userText: string,
  history?: ChatMessage[],
  images?: string[]
): Promise<HybridResult> {
  const settings = loadSettings();
  let hits: { note: Note }[] = [];
  try {
    hits = searchNotes(userText, 6);
  } catch {
    hits = [];
  }
  const sources: Note[] = hits.map((h) => h.note);

  // 知识库命中 + 可用 AI → 优先基于笔记作答
  if (sources.length > 0 && !settings.localOnly && settings.apiKey) {
    try {
      const answer = await answerWithNotes(userText, sources, images);
      return { answer, sources, grounded: true, usedAI: true };
    } catch {
      // 笔记作答失败（如模型不支持图片），继续走通用兜底
    }
  }

  // 兜底：通用 AI（带多轮历史）
  if (settings.localOnly || !settings.apiKey) {
    if (sources.length > 0) {
      const list = sources.map((n) => `• ${n.title}`).join('\n');
      return { answer: `（未连接 AI，以下是相关知识库笔记）\n${list}`, sources, grounded: true, usedAI: false };
    }
    return {
      answer: '当前是「仅本地模式」或未配置 AI 的 API Key，暂时无法回答。请到「设置」中填写 API Key 与 Base URL 后重试。',
      sources: [],
      grounded: false,
      usedAI: false,
    };
  }

  const answer = await generalAnswer(userText, history || [], images, settings);
  return { answer, sources: [], grounded: false, usedAI: true };
}

// ---------- 统一智能输入：自动分辨 todo / note / query ----------

async function callAISmart(text: string, images?: string[]): Promise<any[]> {
  const s = loadSettings();
  const fetchFn = (globalThis as any).fetch as typeof fetch;
  const hasImages = !!images?.length;
  const userContent: any = hasImages
    ? [{ type: 'text', text }, ...images!.map((url) => ({ type: 'image_url', image_url: { url } }))]
    : text;
  const body: any = {
    model: s.model || 'deepseek-chat',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          '你是智能助理，判断用户输入属于以下哪几类（可多选）：' +
          'todo(待办事项), note(需要记录的笔记/知识), query(向已有知识库提问)。' +
          '以 JSON 返回：{ "intents": [ { "type": ..., ... } ] }。' +
          '若 type="todo"，必须附带完整字段：' +
          'title(必填字符串，简要描述待办内容), ' +
          'priority(必填，1高/2中/3低整数，依据紧急程度判断，无明确提示时默认2), ' +
          'importance(必填，1高/2中/3低整数，表示重要程度：影响目标/健康/考核/交付的给1，日常杂事给3，其余2), ' +
          'category(必填，必须从[工作/生活/学习/健康/其他]中选择一个，禁止省略), ' +
          'due_time(必填，精确到日期和时间的 ISO8601，若用户未明确时间请根据语义给出合理默认时间，如"今天"默认18:00、"明天"默认09:00，尽量不要返回null), ' +
          'remind_at(ISO8601或null), ' +
          'notes(必填，用1-2句话补充说明任务背景、执行要点或注意事项，禁止返回空串), ' +
          'recurrence(重复规则, 从[none/daily/weekly/monthly/yearly]选一, 识别"每天/每周/每月/每年"等, 没有则省略)。' +
          '若 type="note"，附带 title(标题), content(内容)。' +
          '若 type="query"，附带 question(用户想问的问题原文)。' +
          '时间规则：用户输入的时间均视为本地时间（东八区/Asia/Shanghai，偏移' +
          TZ_OFFSET +
          '），例如"15:30"即北京时间15:30；due_time/remind_at 必须返回带时区偏移的 ISO8601，' +
          '格式如 "2026-07-22T15:30:00' +
          TZ_OFFSET +
          '"，不要返回 UTC 的 "Z"。' +
          '当前时间（Asia/Shanghai）：' +
          nowInShanghai() +
          '。' +
          (hasImages
            ? '用户可能附带了图片，请结合图片内容理解其意图并分类（例如图片里是商品/账单/文档/截图，可记为笔记或待办）。'
            : '') +
          '只输出 JSON，不要其它文字。',
      },
      { role: 'user', content: userContent },
    ],
  };
  // 带图片时不强制 json_object，避免部分模型在「视觉 + JSON 模式」下报错；改用宽松解析兜底
  if (!hasImages) body.response_format = { type: 'json_object' };

  const resp = await fetchFn(`${s.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? '{}';
  let obj: any;
  try {
    obj = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    obj = m ? JSON.parse(m[0]) : {};
  }
  return Array.isArray(obj.intents) ? obj.intents : [];
}

async function askLocal(q: string, images?: string[]) {
  return askQuestion(q, images);
}

function attachImages<T extends SmartIntent>(intent: T, images?: string[]): T {
  if (!images?.length) return intent;
  if (intent.type === 'todo') {
    return { ...intent, draft: { ...intent.draft, images } } as T;
  }
  if (intent.type === 'note') {
    return { ...intent, images } as T;
  }
  if (intent.type === 'query') {
    return { ...intent, images } as T;
  }
  return intent;
}

async function fillLocal(text: string, images?: string[]): Promise<SmartIntent[]> {
  const isQuestion = /[?？]|怎么|什么|为什么|为何|如何|哪|谁|多少|区别|定义|含义/.test(text);
  const isNote = /记(一下|下来|住|录)?|备忘|笔记|存(一下|起来)?|记录|写下/.test(text);
  if (isNote && !isQuestion) {
    const title = text.replace(/^(记(一下|下来|住|录)?|备忘|笔记|记录|写下)[：:\s]*/, '').slice(0, 30) || text.slice(0, 30);
    return [attachImages({ type: 'note', title, content: text }, images)];
  }
  if (isQuestion) {
    const r = await askLocal(text, images);
    return [attachImages({ type: 'query', question: text, answer: r.answer, sources: r.sources }, images)];
  }
  return [attachImages({ type: 'todo', draft: localParse(text) }, images)];
}

/** 强制指定类型时，直接构造对应 intent（跳过分类，保证快捷指令确定性强） */
async function buildForced(
  text: string,
  images: string[] | undefined,
  type: 'todo' | 'note' | 'query'
): Promise<SmartIntent> {
  if (type === 'todo') {
    const draft = await parseTask(text).then((r) => r.draft);
    return attachImages({ type: 'todo', draft }, images);
  }
  if (type === 'note') {
    const firstLine = text.split(/[\n]/)[0].trim();
    const title = firstLine.slice(0, 30) || text.slice(0, 30);
    return attachImages({ type: 'note', title, content: text }, images);
  }
  // query：走混合问答，命中笔记则标来源，未命中用 AI 通用知识兜底
  const r = await askHybrid(text, [], images);
  return attachImages({ type: 'query', question: text, answer: r.answer, sources: r.sources, grounded: r.grounded }, images);
}

/** 统一入口：一句话自动分辨 待办/知识/提问，多意图可同时返回。支持附带图片与强制类型。 */
export async function smartProcess(
  text: string,
  images?: string[],
  forcedType?: 'todo' | 'note' | 'query'
): Promise<SmartResult> {
  const settings = loadSettings();
  if (forcedType) {
    try {
      const intent = await buildForced(text, images, forcedType);
      return { intents: [intent], usedAI: !settings.localOnly && !!settings.apiKey };
    } catch {
      // 强制类型分支异常（如知识库提问检索失败）时，降级为本地处理，绝不应抛到调用方
      return { intents: await fillLocal(text, images), usedAI: false };
    }
  }
  if (settings.localOnly || !settings.apiKey) {
    return { intents: await fillLocal(text, images), usedAI: false };
  }
  try {
    const raw = await callAISmart(text, images);
    const intents: SmartIntent[] = [];
    for (const it of raw) {
      if (it.type === 'todo') {
        intents.push(
          attachImages(
            {
              type: 'todo',
              draft:               {
                title: String(it.title || text).slice(0, 200),
                priority: normalizePriority(it.priority),
                importance: normalizeImportance(it.importance),
                category: String(it.category || '').trim() || '其他',
                due_time: parseTime(it.due_time),
                remind_at: parseTime(it.remind_at),
                notes: String(it.notes || '').trim() || '暂无备注',
                recurrence: normalizeRecurrence(it.recurrence),
              },
            },
            images
          )
        );
      } else if (it.type === 'note') {
        intents.push(
          attachImages(
            {
              type: 'note',
              title: String(it.title || '').slice(0, 200) || text.slice(0, 30),
              content: String(it.content || text),
            },
            images
          )
        );
      } else if (it.type === 'query') {
        const q = String(it.question || text);
        const r = await askHybrid(q, [], images);
        intents.push(attachImages({ type: 'query', question: q, answer: r.answer, sources: r.sources, grounded: r.grounded }, images));
      }
    }
    if (intents.length === 0) intents.push(attachImages({ type: 'todo', draft: localParse(text) }, images));
    return { intents, usedAI: true };
  } catch {
    return { intents: await fillLocal(text, images), usedAI: false };
  }
}

// ---------- 每日简报 ----------

function fmtBrief(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

/** 本地降级：根据聚合数据拼出可读的中文简报 */
export function buildBriefingText(b: Briefing): string {
  const lines: string[] = [];
  lines.push(`📅 ${b.date} 今日概览`);
  lines.push('');
  lines.push(`• 未完成任务：${b.totalActive} 项`);
  if (b.overdue.length) lines.push(`• ⚠️ 已逾期 ${b.overdue.length} 项，建议优先处理`);
  lines.push(`• 今日截止 ${b.dueToday.length} 项（高优先级 ${b.highPriorityToday} 项）`);
  if (b.dueThisWeek.length) lines.push(`• 未来 7 天还有 ${b.dueThisWeek.length} 项待办`);
  if (b.remindersToday.length) lines.push(`• 今天有 ${b.remindersToday.length} 个提醒已设置`);
  if (b.completedToday) lines.push(`• 今日已完成 ${b.completedToday} 项，继续保持 👍`);
  if (b.overdue.length) {
    lines.push('');
    lines.push('逾期清单：');
    for (const t of b.overdue) lines.push(`  - ${t.title}（${fmtBrief(t.due_time!)}）`);
  }
  if (b.dueToday.length) {
    lines.push('');
    lines.push('今日待办：');
    for (const t of b.dueToday) lines.push(`  - ${t.title}（${fmtBrief(t.due_time!)}）`);
  }
  if (!b.overdue.length && !b.dueToday.length && !b.dueThisWeek.length) {
    lines.push('');
    lines.push('今天没什么硬性安排，适合做点长期重要的事 🌱');
  }
  return lines.join('\n');
}

function buildBriefingPrompt(b: Briefing): string {
  const lines: string[] = [];
  lines.push(`日期：${b.date}`);
  lines.push(`未完成任务总数：${b.totalActive}`);
  lines.push(`今日截止：${b.dueToday.length} 项（其中高优先级 ${b.highPriorityToday} 项）`);
  lines.push(`未来 7 天截止：${b.dueThisWeek.length} 项`);
  lines.push(`已逾期：${b.overdue.length} 项`);
  lines.push(`今日有提醒：${b.remindersToday.length} 项`);
  lines.push(`今日已完成：${b.completedToday} 项`);
  if (b.overdue.length)
    lines.push('逾期任务：' + b.overdue.map((t) => `${t.title}(${fmtBrief(t.due_time!)}优先级${t.priority})`).join('、'));
  if (b.dueToday.length)
    lines.push('今日任务：' + b.dueToday.map((t) => `${t.title}(${fmtBrief(t.due_time!)}优先级${t.priority})`).join('、'));
  return lines.join('\n');
}

/** 生成今日简报：AI 写一段鼓励性、可执行的中文摘要；失败/离线降级为本地模板 */
export async function generateDailyBriefing(): Promise<BriefingText> {
  const b = getBriefing();
  const local = buildBriefingText(b);
  const settings = loadSettings();
  if (settings.localOnly || !settings.apiKey) return { text: local, usedAI: false };
  try {
    const fetchFn = (globalThis as any).fetch as typeof fetch;
    const resp = await fetchFn(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model || 'deepseek-chat',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content:
              '你是个人效率助理。根据用户今天的待办统计，写一段简短（180 字以内）的「今日简报」：' +
              '先给一句鼓励/提醒，再点出今天最该聚焦的 1-3 件事（优先逾期和高优先级），最后给一个可执行的小建议。' +
              '语气自然、像朋友，不要列编号堆数据，不要使用 Markdown 标题。',
          },
          { role: 'user', content: buildBriefingPrompt(b) },
        ],
      }),
    });
    if (!resp.ok) return { text: local, usedAI: false };
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() || local;
    return { text, usedAI: true };
  } catch {
    return { text: local, usedAI: false };
  }
}

// ---------- 目标路线图：AI 拆解阶段 ----------
export async function planGoal(title: string, description?: string, brief?: string): Promise<PlanStage[]> {
  const settings = loadSettings();
  if (settings.localOnly || !settings.apiKey) return localPlanGoal(title, brief);
  try {
    const fetchFn = (globalThis as any).fetch as typeof fetch;
    const resp = await fetchFn(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model || 'deepseek-chat',
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '你是目标规划专家。把一个长期目标拆成 3-8 个可执行的阶段/里程碑/任务。' +
              '以 JSON 返回：{ "stages": [ { "title": 阶段标题, "kind": "stage"|"milestone"|"task", ' +
              '"offset_days": 该阶段相对今天的天数偏移(整数，用于推算计划完成日), "weight": 权重(1-3整数，越重要越大) } ] }。' +
              '阶段应从早到晚排序，最后一个是收尾/交付。只输出 JSON。',
          },
          {
            role: 'user',
            content:
              `目标：${title}\n` +
              `${description ? '补充说明：' + description + '\n' : ''}` +
              `${brief ? '用户的额外要求/思路：' + brief + '\n' : ''}` +
              '请根据以上信息（尤其是用户的额外要求）规划合适的阶段。',
          },
        ],
      }),
    });
    const data = await resp.json();
    const obj = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
    const stages: PlanStage[] = Array.isArray(obj.stages) ? obj.stages : [];
    return stages
      .map((s: any) => ({
        title: String(s.title || '').trim(),
        kind: (s.kind as PlanStage['kind']) || 'stage',
        offset_days: Number(s.offset_days) || 0,
        weight: Math.max(1, Math.min(3, Number(s.weight) || 1)),
      }))
      .filter((s: PlanStage) => s.title)
      .slice(0, 8);
  } catch {
    return localPlanGoal(title, brief);
  }
}

function localPlanGoal(title: string, brief?: string): PlanStage[] {
  const base = ['明确目标与成功标准', '拆解关键步骤', '制定时间表', '执行与复盘'];
  const stages: PlanStage[] = base.map((t, i) => ({ title: t, kind: i === base.length - 1 ? 'milestone' : 'stage', offset_days: (i + 1) * 7, weight: 1 }));
  if (brief && brief.trim()) {
    stages.unshift({ title: `根据设想起步：${brief.trim().slice(0, 40)}`, kind: 'task', offset_days: 1, weight: 2 });
  }
  return stages;
}

// ---------- AI 记忆库：提炼要点 + 可选向量化 ----------
export interface ExtractedMemory {
  content: string;
  type: MemoryType;
  importance: 1 | 2 | 3;
}

/** 可选：调用 OpenAI 兼容的 /embeddings 端点生成向量（多数国内模型不支持，失败返回 null） */
export async function embed(text: string): Promise<number[] | null> {
  const settings = loadSettings();
  if (!settings.apiKey || !settings.baseUrl) return null;
  try {
    const fetchFn = (globalThis as any).fetch as typeof fetch;
    const resp = await fetchFn(`${settings.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({ input: text, model: settings.embedModel || 'text-embedding-3-small' }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const vec = data?.data?.[0]?.embedding;
    return Array.isArray(vec) ? (vec as number[]) : null;
  } catch {
    return null;
  }
}

/** 从一段文本中提炼结构化记忆要点；离线降级为拆句 */
export async function extractMemories(text: string, source: 'note' | 'task' | 'manual' | 'conversation' = 'manual'): Promise<ExtractedMemory[]> {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const settings = loadSettings();
  if (settings.localOnly || !settings.apiKey) return localExtract(clean);

  try {
    const fetchFn = (globalThis as any).fetch as typeof fetch;
    const resp = await fetchFn(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model || 'deepseek-chat',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '你是个人记忆提炼助手。从用户的文本中抽取值得长期记住的事实/偏好/项目/人物/规则。' +
              '以 JSON 返回：{ "memories": [ { "content": 一句话要点(简洁、去口语、可独立理解), ' +
              '"type": "fact"|"preference"|"project"|"person"|"rule", ' +
              '"importance": 1|2|3(1最关键) } ] }。最多 5 条，没有可记的返回空数组。只输出 JSON。',
          },
          { role: 'user', content: clean },
        ],
      }),
    });
    const data = await resp.json();
    const obj = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
    const mems: ExtractedMemory[] = Array.isArray(obj.memories) ? obj.memories : [];
    const out = mems
      .map((m: any) => ({
        content: String(m.content || '').trim(),
        type: (m.type as MemoryType) || 'fact',
        importance: ([1, 2, 3].includes(Number(m.importance)) ? Number(m.importance) : 2) as 1 | 2 | 3,
      }))
      .filter((m: ExtractedMemory) => m.content)
      .slice(0, 5);
    // 尝试向量化（若模型支持 embeddings），失败不影响结果
    for (const m of out) {
      const vec = await embed(m.content);
      if (vec) (m as any).embedding = vec;
    }
    return out;
  } catch {
    return localExtract(clean);
  }
}

function localExtract(text: string): ExtractedMemory[] {
  const sentences = text
    .split(/[。.!?！？\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6)
    .slice(0, 3);
  return sentences.map((s) => ({ content: s, type: 'fact' as MemoryType, importance: 2 as 1 | 2 | 3 }));
}
