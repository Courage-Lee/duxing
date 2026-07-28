/**
 * 预加载脚本：通过 contextBridge 把主进程 IPC 封装为 window.api 暴露给渲染进程。
 * 采用 contextIsolation + 关闭 nodeIntegration，渲染进程只能通过此白名单 API 与主进程通信。
 */

import { contextBridge, ipcRenderer } from 'electron';
import {
  Task,
  TaskDraft,
  Settings,
  ExportFormat,
  ParseResult,
  TestResult,
  Note,
  AskResult,
  HybridResult,
  ChatMessage,
  SearchHit,
  SmartResult,
  Briefing,
  BriefingText,
  SubTask,
  AppBackup,
  Goal,
  GoalDraft,
  GoalStageDraft,
  GoalStage,
  Memory,
  MemoryDraft,
  PlanStage,
} from '../shared/types';

const api = {
  listTasks: (): Promise<Task[]> => ipcRenderer.invoke('tasks:list'),
  createTask: (draft: TaskDraft, source?: 'manual' | 'nl'): Promise<Task> =>
    ipcRenderer.invoke('tasks:create', draft, source),
  updateTask: (id: string, patch: Partial<Task>): Promise<Task | null> =>
    ipcRenderer.invoke('tasks:update', id, patch),
  deleteTask: (id: string): Promise<boolean> => ipcRenderer.invoke('tasks:delete', id),
  parseTask: (text: string): Promise<ParseResult> => ipcRenderer.invoke('ai:parse', text),
  recommend: (): Promise<Task[]> => ipcRenderer.invoke('ai:recommend'),
  breakdownTask: (title: string, notes?: string): Promise<SubTask[]> =>
    ipcRenderer.invoke('ai:breakdown', title, notes),
  rescheduleOverdue: (): Promise<number> => ipcRenderer.invoke('tasks:rescheduleOverdue'),
  snoozeTask: (id: string, minutes: number): Promise<boolean> => ipcRenderer.invoke('tasks:snooze', id, minutes),
  testAIConnection: (opts?: { apiKey?: string; baseUrl?: string; model?: string }): Promise<TestResult> =>
    ipcRenderer.invoke('ai:test', opts),
  smartProcess: (text: string, images?: string[], forcedIntent?: 'todo' | 'note' | 'query'): Promise<SmartResult> =>
    ipcRenderer.invoke('ai:smart', text, images, forcedIntent),
  chatTurn: (userText: string, history: ChatMessage[], images?: string[]): Promise<string> =>
    ipcRenderer.invoke('ai:chat', userText, history, images),
  askHybrid: (userText: string, history: ChatMessage[], images?: string[]): Promise<HybridResult> =>
    ipcRenderer.invoke('ai:hybrid', userText, history, images),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (s: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:save', s),
  exportData: (format: ExportFormat): Promise<string> => ipcRenderer.invoke('data:export', format),
  exportAll: (): Promise<string> => ipcRenderer.invoke('data:exportAll'),
  importData: (json: string): Promise<{ tasks: number; notes: number }> =>
    ipcRenderer.invoke('data:import', json),
  exportNotesMarkdown: (): Promise<string> => ipcRenderer.invoke('notes:exportMarkdown'),
  showWindow: (): void => ipcRenderer.send('app:show'),

  // 每日简报
  getBriefing: (): Promise<Briefing> => ipcRenderer.invoke('briefing:get'),
  generateBriefing: (): Promise<BriefingText> => ipcRenderer.invoke('briefing:generate'),

  // 知识库
  listNotes: (): Promise<Note[]> => ipcRenderer.invoke('notes:list'),
  getNote: (id: string): Promise<Note | null> => ipcRenderer.invoke('notes:get', id),
  createNote: (title: string, content: string, images?: string[]): Promise<Note> =>
    ipcRenderer.invoke('notes:create', title, content, images),
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'content'>>): Promise<Note | null> =>
    ipcRenderer.invoke('notes:update', id, patch),
  deleteNote: (id: string): Promise<boolean> => ipcRenderer.invoke('notes:delete', id),
  searchNotes: (q: string): Promise<SearchHit[]> => ipcRenderer.invoke('notes:search', q),
  askNotes: (q: string, images?: string[]): Promise<AskResult> => ipcRenderer.invoke('notes:ask', q, images),

  // 目标路线图
  listGoals: (): Promise<Goal[]> => ipcRenderer.invoke('goals:list'),
  getGoal: (id: string): Promise<Goal | null> => ipcRenderer.invoke('goals:get', id),
  createGoal: (draft: GoalDraft): Promise<Goal> => ipcRenderer.invoke('goals:create', draft),
  updateGoal: (id: string, patch: Partial<Pick<Goal, 'title' | 'description' | 'success_criteria' | 'start_date' | 'target_date' | 'status'>>): Promise<Goal | null> =>
    ipcRenderer.invoke('goals:update', id, patch),
  deleteGoal: (id: string): Promise<boolean> => ipcRenderer.invoke('goals:delete', id),
  addGoalStage: (goalId: string, draft: GoalStageDraft): Promise<GoalStage> => ipcRenderer.invoke('goals:addStage', goalId, draft),
  updateGoalStage: (stageId: string, patch: Partial<Pick<GoalStage, 'title' | 'kind' | 'planned_end_at' | 'weight' | 'done' | 'parent_id'>>): Promise<boolean> =>
    ipcRenderer.invoke('goals:updateStage', stageId, patch),
  deleteGoalStage: (stageId: string): Promise<boolean> => ipcRenderer.invoke('goals:deleteStage', stageId),
  planGoal: (title: string, description?: string, brief?: string): Promise<PlanStage[]> => ipcRenderer.invoke('ai:planGoal', title, description, brief),

  // AI 记忆库
  listMemories: (): Promise<Memory[]> => ipcRenderer.invoke('memories:list'),
  createMemory: (draft: MemoryDraft): Promise<Memory> => ipcRenderer.invoke('memories:create', draft),
  deleteMemory: (id: string): Promise<boolean> => ipcRenderer.invoke('memories:delete', id),
  extractMemories: (text: string, source?: any): Promise<Memory[]> => ipcRenderer.invoke('memories:extract', text, source),
  searchMemories: (q: string, embedding?: number[] | null): Promise<Memory[]> => ipcRenderer.invoke('memories:search', q, embedding),
};

contextBridge.exposeInMainWorld('api', api);
