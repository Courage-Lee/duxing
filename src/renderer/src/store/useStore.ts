/**
 * 全局状态（Zustand）：聚合任务/笔记/目标/记忆/简报/设置/主题/视图等状态，
 * 并封装对 window.api 的所有调用。所有写操作后统一 refresh，保证 UI 与本地数据库一致。
 */

import { create } from 'zustand';
import { Task, Settings, TaskDraft, TestResult, Note, SearchHit, SmartResult, Briefing, BriefingText, SubTask, Goal, GoalDraft, GoalStage, GoalStageDraft, Memory, MemoryDraft, PlanStage, MemoryType } from '../../../shared/types';

type Theme = 'light' | 'dark' | 'system';
type View = 'home' | 'todo' | 'kb' | 'briefing' | 'calendar' | 'stats' | 'quadrant' | 'goals' | 'memory';
type PriorityFilter = 1 | 2 | 3 | 'all';

// 首页对话消息（持久化到 localStorage，切视图/重启不丢）
export type ChatMode = 'chat' | 'auto' | 'todo' | 'note' | 'query';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  sources?: Note[];
  grounded?: boolean; // true=来自你的笔记；false/undefined=AI 通用回答（非来自笔记）
  pending?: boolean;
  error?: boolean;
}

const CHAT_KEY = 'duxing.chat.v1';
function loadChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}
function persistChat(ms: ChatMessage[]) {
  try {
    // localStorage 有容量上限，最多保留最近 100 条（含图片的 base64 可能较大）
    const trimmed = ms.slice(-100);
    localStorage.setItem(CHAT_KEY, JSON.stringify(trimmed));
  } catch {
    /* 配额超限时忽略，保留内存态即可 */
  }
}

interface Store {
  tasks: Task[];
  settings: Settings;
  theme: Theme;
  filter: string; // 'all' | 'today' | 具体分类
  search: string; // 全局搜索关键词
  showDone: boolean; // 是否显示已完成
  priorityFilter: PriorityFilter;
  recommendations: Task[];
  editorOpen: boolean;
  editorTask: Task | null;
  editorDraft: TaskDraft | null;
  view: View;
  notes: Note[];
  kbSelectedId: string | null;
  smartLoading: boolean;
  smartToast: {
    kind: 'success' | 'info' | 'error';
    text: string;
    answers?: { question: string; answer: string; sources?: Note[] }[];
  } | null;

  // 每日简报
  briefing: Briefing | null;
  briefingText: BriefingText | null;
  briefingLoading: boolean;

  // 完成庆祝
  celebrate: { title: string } | null;

  // 目标路线图
  goals: Goal[];
  selectedGoalId: string | null;

  // AI 记忆库
  memories: Memory[];

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  applyTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setFilter: (f: string) => void;
  setView: (v: View) => void;
  setSearch: (s: string) => void;
  setShowDone: (v: boolean) => void;
  setPriorityFilter: (p: PriorityFilter) => void;
  createTask: (draft: TaskDraft, source?: 'manual' | 'nl') => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  openEditor: (t?: Task, draft?: TaskDraft) => void;
  closeEditor: () => void;
  loadRecommendations: () => Promise<void>;
  saveSettings: (s: Partial<Settings>) => Promise<void>;
  exportData: (format: 'json' | 'csv') => Promise<string>;
  exportAll: () => Promise<string>;
  importData: (json: string) => Promise<{ tasks: number; notes: number }>;
  exportNotesMarkdown: () => Promise<string>;
  testConnection: (opts?: { apiKey?: string; baseUrl?: string; model?: string }) => Promise<TestResult>;
  loadNotes: () => Promise<void>;
  createNote: (title: string, content: string, images?: string[]) => Promise<Note>;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'images'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  runSmart: (text: string, images?: string[], forcedIntent?: 'todo' | 'note' | 'query') => Promise<void>;
  selectNote: (id: string | null) => void;
  clearSmartToast: () => void;
  breakdownTask: (id: string, title: string, notes?: string) => Promise<void>;
  rescheduleOverdue: () => Promise<number>;
  snoozeTask: (id: string, minutes: number) => Promise<void>;

  // 每日简报
  loadBriefing: () => Promise<void>;
  generateBriefing: () => Promise<void>;

  // 完成庆祝
  toggleDone: (task: Task) => Promise<void>;
  clearCelebrate: () => void;

  // 目标路线图
  loadGoals: () => Promise<void>;
  createGoal: (draft: GoalDraft) => Promise<void>;
  updateGoal: (id: string, patch: Partial<Pick<Goal, 'title' | 'description' | 'success_criteria' | 'start_date' | 'target_date' | 'status'>>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addGoalStage: (goalId: string, draft: GoalStageDraft) => Promise<void>;
  updateGoalStage: (stageId: string, patch: Partial<Pick<GoalStage, 'title' | 'kind' | 'planned_end_at' | 'weight' | 'done' | 'parent_id'>>) => Promise<void>;
  deleteGoalStage: (stageId: string) => Promise<void>;
  planGoal: (title: string, description?: string, brief?: string) => Promise<PlanStage[]>;
  selectGoal: (id: string | null) => void;

  // AI 记忆库
  loadMemories: () => Promise<void>;
  createMemory: (draft: MemoryDraft) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  extractMemories: (text: string, source?: MemoryType extends never ? never : 'note' | 'task' | 'manual' | 'conversation') => Promise<void>;
  searchMemories: (q: string, embedding?: number[] | null) => Promise<void>;

  // 首页对话历史（持久化）
  chatMessages: ChatMessage[];
  chatMode: ChatMode;
  pushChatMessages: (ms: ChatMessage[]) => void;
  updateChatMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setChatMessages: (ms: ChatMessage[]) => void;
  setChatMode: (m: ChatMode) => void;
  clearChat: () => void;
}

export const useStore = create<Store>((set, get) => ({
  tasks: [],
  settings: {},
  theme: 'system',
  filter: 'all',
  search: '',
  showDone: false,
  priorityFilter: 'all',
  recommendations: [],
  editorOpen: false,
  editorTask: null,
  editorDraft: null,
  view: 'home',
  notes: [],
  kbSelectedId: null,
  smartLoading: false,
  smartToast: null,

  briefing: null,
  briefingText: null,
  briefingLoading: false,

  celebrate: null,

  goals: [],
  selectedGoalId: null,

  memories: [],

  chatMessages: loadChat(),
  chatMode: 'chat',

  pushChatMessages: (ms) => {
    const next = [...get().chatMessages, ...ms];
    set({ chatMessages: next });
    persistChat(next);
  },
  updateChatMessage: (id, patch) => {
    const next = get().chatMessages.map((m) => (m.id === id ? { ...m, ...patch } : m));
    set({ chatMessages: next });
    persistChat(next);
  },
  setChatMessages: (ms) => {
    set({ chatMessages: ms });
    persistChat(ms);
  },
  setChatMode: (m) => set({ chatMode: m }),
  clearChat: () => {
    set({ chatMessages: [] });
    persistChat([]);
  },

  init: async () => {
    const theme = (localStorage.getItem('theme') as Theme) || 'system';
    get().applyTheme(theme);
    const settings = await window.api.getSettings();
    set({ settings });
    if (settings.theme) get().applyTheme(settings.theme);
    await get().refresh();
  },

  refresh: async () => {
    const tasks = await window.api.listTasks();
    set({ tasks });
    await get().loadRecommendations();
  },

  applyTheme: (t) => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const resolved = t === 'system' ? (mq?.matches ? 'dark' : 'light') : t;
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem('theme', t);
    set({ theme: t });
    // 跟随系统变化时实时切换
    if (t === 'system' && mq) {
      const handler = (e: MediaQueryListEvent) => {
        if (get().theme === 'system') document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
      };
      mq.removeEventListener?.('change', handler);
      mq.addEventListener?.('change', handler);
    }
  },

  toggleTheme: () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(get().theme) + 1) % order.length];
    get().applyTheme(next);
  },

  setFilter: (f) => set({ filter: f }),

  setView: (v) => set({ view: v }),

  setSearch: (s) => set({ search: s }),

  setShowDone: (v) => set({ showDone: v }),

  setPriorityFilter: (p) => set({ priorityFilter: p }),

  createTask: async (draft, source = 'manual') => {
    await window.api.createTask(draft, source);
    await get().refresh();
  },

  updateTask: async (id, patch) => {
    await window.api.updateTask(id, patch);
    await get().refresh();
  },

  deleteTask: async (id) => {
    await window.api.deleteTask(id);
    await get().refresh();
  },

  openEditor: (t, draft) => set({ editorOpen: true, editorTask: t || null, editorDraft: draft || null }),
  closeEditor: () => set({ editorOpen: false, editorTask: null, editorDraft: null }),

  loadRecommendations: async () => {
    try {
      const rec = await window.api.recommend();
      set({ recommendations: rec });
    } catch {
      /* ignore */
    }
  },

  saveSettings: async (s) => {
    const settings = await window.api.saveSettings(s);
    set({ settings });
    if (s.theme) get().applyTheme(s.theme);
  },

  exportData: (format) => window.api.exportData(format),

  exportAll: () => window.api.exportAll(),

  importData: (json) => window.api.importData(json),

  exportNotesMarkdown: () => window.api.exportNotesMarkdown(),

  testConnection: (opts) => window.api.testAIConnection(opts),

  loadNotes: async () => {
    const notes = await window.api.listNotes();
    set({ notes });
  },

  createNote: async (title, content, images) => {
    const n = await window.api.createNote(title, content, images);
    await get().loadNotes();
    return n;
  },

  updateNote: async (id, patch) => {
    await window.api.updateNote(id, patch);
    await get().loadNotes();
  },

  deleteNote: async (id) => {
    await window.api.deleteNote(id);
    await get().loadNotes();
  },

  runSmart: async (text, images, forcedIntent) => {
    if (!text.trim() && !images?.length) return;
    set({ smartLoading: true });
    try {
      const res = await window.api.smartProcess(text, images, forcedIntent);
      const taskIds: string[] = [];
      const noteIds: string[] = [];
      const answers: { question: string; answer: string; sources?: Note[] }[] = [];
      for (const it of res.intents) {
        if (it.type === 'todo') {
          const t = await window.api.createTask(it.draft, 'nl');
          taskIds.push(t.id);
        } else if (it.type === 'note') {
          const n = await window.api.createNote(it.title, it.content, it.images);
          noteIds.push(n.id);
        } else if (it.type === 'query') {
          answers.push({ question: it.question || text, answer: it.answer || '（无回答）', sources: it.sources });
        }
      }
      const parts: string[] = [];
      if (taskIds.length) parts.push(`待办 ${taskIds.length} 条`);
      if (noteIds.length) parts.push(`笔记 ${noteIds.length} 条`);
      const summary =
        answers.length > 0
          ? '已自动回答你的问题'
          : parts.length
            ? `✅ 已自动保存：${parts.join('、')}`
            : '已处理';
      set({
        smartLoading: false,
        smartToast: { kind: answers.length ? 'info' : 'success', text: summary, answers },
      });
      await get().refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误';
      set({ smartLoading: false, smartToast: { kind: 'error', text: `处理失败：${msg}` } });
    }
  },

  selectNote: (id) => set({ kbSelectedId: id }),

  clearSmartToast: () => set({ smartToast: null }),

  breakdownTask: async (id, title, notes) => {
    const subs = await window.api.breakdownTask(title, notes);
    if (subs.length === 0) return;
    const t = get().tasks.find((x) => x.id === id);
    const merged = [...(t?.subtasks ?? []), ...subs];
    await get().updateTask(id, { subtasks: merged });
  },

  rescheduleOverdue: async () => {
    const moved = await window.api.rescheduleOverdue();
    await get().refresh();
    return moved;
  },

  snoozeTask: async (id, minutes) => {
    await window.api.snoozeTask(id, minutes);
    await get().refresh();
  },

  loadBriefing: async () => {
    const briefing = await window.api.getBriefing();
    set({ briefing });
  },

  generateBriefing: async () => {
    set({ briefingLoading: true });
    try {
      const text = await window.api.generateBriefing();
      set({ briefingText: text, briefingLoading: false });
    } catch {
      set({ briefingLoading: false });
    }
  },

  toggleDone: async (task) => {
    const next = task.status === 'done' ? 'todo' : 'done';
    await get().updateTask(task.id, { status: next });
    if (next === 'done') {
      set({ celebrate: { title: task.title } });
      setTimeout(() => {
        const cur = get().celebrate;
        if (cur && cur.title === task.title) set({ celebrate: null });
      }, 2200);
    }
  },

  clearCelebrate: () => set({ celebrate: null }),

  loadGoals: async () => {
    const goals = await window.api.listGoals();
    set({ goals });
  },

  createGoal: async (draft) => {
    const g = await window.api.createGoal(draft);
    set({ goals: [g, ...get().goals], selectedGoalId: g.id });
  },

  updateGoal: async (id, patch) => {
    const g = await window.api.updateGoal(id, patch);
    set({ goals: get().goals.map((x) => (x.id === id ? (g as Goal) : x)) });
  },

  deleteGoal: async (id) => {
    await window.api.deleteGoal(id);
    set({ goals: get().goals.filter((x) => x.id !== id), selectedGoalId: get().selectedGoalId === id ? null : get().selectedGoalId });
  },

  addGoalStage: async (goalId, draft) => {
    await window.api.addGoalStage(goalId, draft);
    await get().loadGoals();
  },

  updateGoalStage: async (stageId, patch) => {
    // 乐观更新：本地先合并，保证输入框跟手；再异步落库。
    // 不再 loadGoals() 全量重拉——否则快速输入时并发重拉会用旧快照覆盖已输入的内容。
    set({
      goals: get().goals.map((g) => ({
        ...g,
        stages: g.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)),
      })),
    });
    await window.api.updateGoalStage(stageId, patch);
  },

  deleteGoalStage: async (stageId) => {
    await window.api.deleteGoalStage(stageId);
    await get().loadGoals();
  },

  planGoal: async (title, description, brief) => {
    return await window.api.planGoal(title, description, brief);
  },

  selectGoal: (id) => set({ selectedGoalId: id }),

  loadMemories: async () => {
    const memories = await window.api.listMemories();
    set({ memories });
  },

  createMemory: async (draft) => {
    await window.api.createMemory(draft);
    await get().loadMemories();
  },

  deleteMemory: async (id) => {
    await window.api.deleteMemory(id);
    await get().loadMemories();
  },

  extractMemories: async (text, source) => {
    await window.api.extractMemories(text, source);
    await get().loadMemories();
  },

  searchMemories: async (q, embedding) => {
    const memories = await window.api.searchMemories(q, embedding);
    set({ memories });
  },
}));
