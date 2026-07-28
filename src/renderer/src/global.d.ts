import { Task, TaskDraft, Settings, ExportFormat, ParseResult, TestResult, Note, AskResult, SearchHit, SmartResult, Briefing, BriefingText, SubTask, Goal, GoalDraft, GoalStage, GoalStageDraft, Memory, MemoryDraft, PlanStage } from '../../shared/types';

declare global {
  interface Window {
    api: {
      listTasks: () => Promise<Task[]>;
      createTask: (draft: TaskDraft, source?: 'manual' | 'nl') => Promise<Task>;
      updateTask: (id: string, patch: Partial<Task>) => Promise<Task | null>;
      deleteTask: (id: string) => Promise<boolean>;
      parseTask: (text: string) => Promise<ParseResult>;
      recommend: () => Promise<Task[]>;
      breakdownTask: (title: string, notes?: string) => Promise<SubTask[]>;
      rescheduleOverdue: () => Promise<number>;
      snoozeTask: (id: string, minutes: number) => Promise<boolean>;
      testAIConnection: (opts?: { apiKey?: string; baseUrl?: string; model?: string }) => Promise<TestResult>;
      getSettings: () => Promise<Settings>;
      saveSettings: (s: Partial<Settings>) => Promise<Settings>;
      exportData: (format: ExportFormat) => Promise<string>;
      exportAll: () => Promise<string>;
      importData: (json: string) => Promise<{ tasks: number; notes: number }>;
      exportNotesMarkdown: () => Promise<string>;
      showWindow: () => void;
      // 每日简报
      getBriefing: () => Promise<Briefing>;
      generateBriefing: () => Promise<BriefingText>;
      // 知识库
      listNotes: () => Promise<Note[]>;
      getNote: (id: string) => Promise<Note | null>;
      createNote: (title: string, content: string, images?: string[]) => Promise<Note>;
      updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'content'>>) => Promise<Note | null>;
      deleteNote: (id: string) => Promise<boolean>;
      searchNotes: (q: string) => Promise<SearchHit[]>;
      askNotes: (q: string, images?: string[]) => Promise<AskResult>;
      smartProcess: (text: string, images?: string[], forcedIntent?: 'todo' | 'note' | 'query') => Promise<SmartResult>;
      chatTurn: (userText: string, history: ChatMessage[], images?: string[]) => Promise<string>;
      // 目标路线图
      listGoals: () => Promise<Goal[]>;
      getGoal: (id: string) => Promise<Goal | null>;
      createGoal: (draft: GoalDraft) => Promise<Goal>;
      updateGoal: (id: string, patch: Partial<Pick<Goal, 'title' | 'description' | 'success_criteria' | 'start_date' | 'target_date' | 'status'>>) => Promise<Goal | null>;
      deleteGoal: (id: string) => Promise<boolean>;
      addGoalStage: (goalId: string, draft: GoalStageDraft) => Promise<GoalStage>;
      updateGoalStage: (stageId: string, patch: Partial<Pick<GoalStage, 'title' | 'kind' | 'planned_end_at' | 'weight' | 'done' | 'parent_id'>>) => Promise<boolean>;
      deleteGoalStage: (stageId: string) => Promise<boolean>;
      planGoal: (title: string, description?: string, brief?: string) => Promise<PlanStage[]>;
      // AI 记忆库
      listMemories: () => Promise<Memory[]>;
      createMemory: (draft: MemoryDraft) => Promise<Memory>;
      deleteMemory: (id: string) => Promise<boolean>;
      extractMemories: (text: string, source?: any) => Promise<Memory[]>;
      searchMemories: (q: string, embedding?: number[] | null) => Promise<Memory[]>;
    };
  }
}

export {};
