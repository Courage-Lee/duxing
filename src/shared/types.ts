/**
 * 共享类型定义（主进程 / 预加载 / 渲染进程共用）。
 * 涵盖任务、笔记、目标路线图、AI 记忆库、每日简报、统一智能输入等核心数据模型。
 */

export type Priority = 1 | 2 | 3; // 1=高 2=中 3=低
export type TaskStatus = 'todo' | 'done';
export type TaskSource = 'manual' | 'nl';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  category?: string;
  priority: Priority;
  importance?: 1 | 2 | 3; // 重要程度 1高/2中/3低（四象限视图用，缺省按 2）
  status: TaskStatus;
  due_time?: number | null;
  remind_at?: number | null;
  created_at: number;
  updated_at?: number | null;
  completed_at?: number | null;
  source: TaskSource;
  notified?: number;
  recurrence?: Recurrence;
  recurrence_end?: number | null;
  images?: string[]; // base64 data URL 数组，作为附件
  subtasks?: SubTask[]; // 子任务清单
  snoozed?: number; // 最近一次「稍后提醒」的时间戳
}

export interface TaskDraft {
  title: string;
  notes?: string;
  category?: string;
  priority: Priority;
  importance?: 1 | 2 | 3;
  due_time?: number | null;
  remind_at?: number | null;
  recurrence?: Recurrence;
  recurrence_end?: number | null;
  images?: string[];
  subtasks?: SubTask[];
}

export interface Settings {
  apiKey?: string;
  baseUrl?: string; // OpenAI 兼容 base url
  model?: string;
  defaultCategory?: string;
  localOnly?: boolean; // 仅本地模式（不调用 AI）
  dailyBriefing?: boolean; // 是否启用每日简报定时通知
  briefingTime?: string; // 每日简报推送时间，HH:mm，默认 09:00
  snoozeMinutes?: number; // 稍后提醒的分钟数，默认 30
  theme?: 'light' | 'dark' | 'system'; // 主题，默认 system 跟随系统
  embedModel?: string; // 语义向量模型（可选，如 text-embedding-3-small），用于记忆语义检索
}

export type ExportFormat = 'json' | 'csv';

/** 全量备份结构（任务 + 笔记 + 设置），用于导出/导入 */
export interface AppBackup {
  version: number;
  exportedAt: number;
  tasks: Task[];
  notes: Note[];
  settings: Settings;
}

export interface SnoozeResult {
  ok: boolean;
  message: string;
}

export interface ParseResult {
  draft: TaskDraft;
  usedAI: boolean;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

// ---------- 知识库 ----------
export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number | null;
  images?: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Note[]; // AI 回答时引用的来源笔记
  images?: string[]; // 用户消息附带图片
}

export interface AskResult {
  answer: string;
  sources: Note[];
  usedAI: boolean; // 是否真正调用了 AI（false 表示离线降级为匹配列表）
}

// ---------- 统一智能输入 ----------
export type SmartIntentType = 'todo' | 'note' | 'query';
export interface SmartTodoIntent {
  type: 'todo';
  draft: TaskDraft;
}
export interface SmartNoteIntent {
  type: 'note';
  title: string;
  content: string;
  images?: string[];
}
export interface SmartQueryIntent {
  type: 'query';
  question: string;
  answer?: string;
  sources?: Note[];
  images?: string[];
}
export type SmartIntent = SmartTodoIntent | SmartNoteIntent | SmartQueryIntent;
export interface SmartResult {
  intents: SmartIntent[];
  usedAI: boolean;
}

// ---------- 每日简报 ----------
export interface Briefing {
  date: string; // YYYY-MM-DD
  totalActive: number; // 未完成任务总数
  overdue: Task[]; // 已逾期（截止日 < 今天）
  dueToday: Task[]; // 今天截止
  dueThisWeek: Task[]; // 未来 7 天截止（不含今天）
  remindersToday: Task[]; // 今天有提醒时间
  highPriorityToday: number; // 今天截止中的高优先级数量
  completedToday: number; // 今天已完成数量
  generatedAt: number; // 聚合时间戳
}

export interface BriefingText {
  text: string;
  usedAI: boolean;
}

// ---------- 目标路线图（Goal） ----------
export type GoalStatus = 'active' | 'done' | 'archived';
export type StageKind = 'stage' | 'milestone' | 'task';

/** 目标下的阶段 / 里程碑 / 执行任务节点 */
export interface GoalStage {
  id: string;
  title: string;
  kind: StageKind; // stage 阶段 / milestone 里程碑 / task 执行任务
  planned_end_at?: number | null; // 计划完成日期
  weight: number; // 加权进度权重（默认 1）
  done: boolean;
  sort_order: number;
  parent_id?: string | null; // 支持层级嵌套
}

export interface GoalStageDraft {
  title: string;
  kind?: StageKind;
  planned_end_at?: number | null;
  weight?: number;
  parent_id?: string | null;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  success_criteria?: string; // 成功标准
  start_date?: number | null;
  target_date?: number | null;
  status: GoalStatus;
  created_at: number;
  updated_at?: number | null;
  stages: GoalStage[]; // 前端聚合，数据库存 JSON
}

export interface GoalDraft {
  title: string;
  description?: string;
  success_criteria?: string;
  start_date?: number | null;
  target_date?: number | null;
  stages?: GoalStageDraft[];
}

/** AI 规划返回的阶段（planGoal） */
export interface PlanStage {
  title: string;
  kind: StageKind;
  offset_days?: number; // 相对今天的天数偏移，用于推算 planned_end_at
  weight: number;
}

// ---------- AI 记忆库（Memory） ----------
export type MemoryType = 'fact' | 'preference' | 'project' | 'person' | 'rule';

export interface Memory {
  id: string;
  content: string; // 提炼出的记忆要点
  type: MemoryType; // 记忆类别
  importance: 1 | 2 | 3; // 重要程度
  source: 'note' | 'task' | 'manual' | 'conversation'; // 来源
  source_id?: string | null; // 关联的原记录 id
  access_count: number; // 被访问次数
  created_at: number;
  embedding?: number[] | null; // 可选向量（语义检索用，未配置 embeddings 时为空）
}

export interface MemoryDraft {
  content: string;
  type?: MemoryType;
  importance?: 1 | 2 | 3;
  source?: MemoryType extends never ? never : 'note' | 'task' | 'manual' | 'conversation';
  source_id?: string | null;
}

export interface MemorySearchResult {
  memory: Memory;
  score: number; // 相似度或关键词得分
}

// ---------- 笔记检索结果 ----------
export interface SearchHit {
  note: Note;
  snippet: string;
}
