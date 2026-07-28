/**
 * 任务（Task）数据访问层：增删改查、重复任务滚动生成、逾期顺延、稍后提醒。
 * 行记录中的 images / subtasks 以 JSON 字符串存储，读取时解析回数组。
 */

import db from './index';
import { Task, TaskDraft, TaskSource, Recurrence, SubTask } from '../../shared/types';

function rowToTask(r: any): Task {
  let images: string[] | undefined;
  if (r.images) {
    try {
      images = JSON.parse(r.images);
    } catch {
      images = undefined;
    }
  }
  let subtasks: SubTask[] | undefined;
  if (r.subtasks) {
    try {
      subtasks = JSON.parse(r.subtasks);
    } catch {
      subtasks = undefined;
    }
  }
  return {
    id: r.id,
    title: r.title,
    notes: r.notes ?? '',
    category: r.category ?? undefined,
    priority: r.priority,
    importance: (r.importance as 1 | 2 | 3) || 2,
    status: r.status,
    due_time: r.due_time ?? null,
    remind_at: r.remind_at ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at ?? null,
    completed_at: r.completed_at ?? null,
    source: r.source,
    notified: r.notified ?? 0,
    recurrence: (r.recurrence as Recurrence) || 'none',
    recurrence_end: r.recurrence_end ?? null,
    images,
    subtasks,
    snoozed: r.snoozed ?? null,
  };
}

export function listTasks(): Task[] {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  return rows.map(rowToTask);
}

export function getTask(id: string): Task | null {
  const r = db.prepare('SELECT * FROM tasks WHERE id=?').get(id) as any;
  return r ? rowToTask(r) : null;
}

export function createTask(draft: TaskDraft, source: TaskSource = 'manual'): Task {
  const now = Date.now();
  const id = (globalThis as any).crypto.randomUUID();
  const imagesJson = draft.images?.length ? JSON.stringify(draft.images) : null;
  const subtasksJson = draft.subtasks?.length ? JSON.stringify(draft.subtasks) : null;
  db.prepare(
    `INSERT INTO tasks (id,title,notes,category,priority,importance,status,due_time,remind_at,created_at,source,notified,recurrence,recurrence_end,images,subtasks)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`
  ).run(
    id,
    draft.title,
    draft.notes ?? '',
    draft.category ?? null,
    draft.priority,
    draft.importance ?? 2,
    'todo',
    draft.due_time ?? null,
    draft.remind_at ?? null,
    now,
    source,
    draft.recurrence || 'none',
    draft.recurrence_end ?? null,
    imagesJson,
    subtasksJson
  );
  return getTask(id)!;
}

/** 计算下一周期时间戳（基于 base） */
function advance(base: number, r: Recurrence): number {
  const d = new Date(base);
  if (r === 'daily') return base + 86_400_000;
  if (r === 'weekly') return base + 604_800_000;
  if (r === 'monthly') {
    const day = d.getDate();
    d.setMonth(d.getMonth() + 1);
    if (d.getDate() !== day) d.setDate(0); // 月末兜底，归到目标月最后一天
    return d.getTime();
  }
  if (r === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
    return d.getTime();
  }
  return base;
}

/** 重复任务完成 → 生成下一周期实例；超过 recurrence_end 则不再生成 */
export function spawnNextOccurrence(task: Task): Task | null {
  if (!task.recurrence || task.recurrence === 'none') return null;
  const base = task.due_time ?? task.created_at ?? Date.now();
  const next = advance(base, task.recurrence);
  if (task.recurrence_end && next > task.recurrence_end) return null;
  let remind: number | null = null;
  if (task.remind_at && task.due_time) {
    const offset = task.due_time - task.remind_at;
    remind = next - offset;
  }
  return createTask(
    {
      title: task.title,
      notes: task.notes ?? '',
      category: task.category,
      priority: task.priority,
      due_time: next,
      remind_at: remind,
      recurrence: task.recurrence,
      recurrence_end: task.recurrence_end ?? null,
      images: task.images,
      // 新周期的子任务重置为未完成
      subtasks: task.subtasks?.map((s) => ({ ...s, done: false })),
    },
    task.source
  );
}

export function updateTask(id: string, patch: Partial<Task>): Task | null {
  const existing = getTask(id);
  if (!existing) return null;
  const wasDone = existing.status === 'done';
  const merged: Task = { ...existing, ...patch, updated_at: Date.now() };
  if (merged.status === 'done' && !merged.completed_at) merged.completed_at = Date.now();
  if (merged.status !== 'done') merged.completed_at = null;
  const imagesJson = merged.images?.length ? JSON.stringify(merged.images) : null;
  const subtasksJson = merged.subtasks?.length ? JSON.stringify(merged.subtasks) : null;
  db.prepare(
    `UPDATE tasks SET title=?,notes=?,category=?,priority=?,importance=?,status=?,due_time=?,remind_at=?,updated_at=?,completed_at=?,recurrence=?,recurrence_end=?,images=?,subtasks=? WHERE id=?`
  ).run(
    merged.title,
    merged.notes ?? '',
    merged.category ?? null,
    merged.priority,
    merged.importance ?? 2,
    merged.status,
    merged.due_time ?? null,
    merged.remind_at ?? null,
    merged.updated_at,
    merged.completed_at ?? null,
    merged.recurrence || 'none',
    merged.recurrence_end ?? null,
    imagesJson,
    subtasksJson,
    id
  );
  // 重复任务被新标记为完成时，自动生成下一周期实例
  if (merged.status === 'done' && !wasDone && merged.recurrence && merged.recurrence !== 'none') {
    spawnNextOccurrence(merged);
  }
  return getTask(id);
}

export function deleteTask(id: string): void {
  db.prepare('DELETE FROM tasks WHERE id=?').run(id);
}

/** 稍后提醒：把 remind_at 顺延 minutes 分钟，并记录 snoozed 时间戳 */
export function snoozeTask(id: string, minutes: number): boolean {
  const t = getTask(id);
  if (!t) return false;
  const at = Date.now() + minutes * 60_000;
  db.prepare('UPDATE tasks SET remind_at=?, snoozed=?, notified=0 WHERE id=?').run(at, Date.now(), id);
  return true;
}

/**
 * 一键顺延逾期任务：把截止日 < 今天 0 点的活跃任务，
 * 顺延到「今天原时刻」；若原时刻已过则顺延到「明天原时刻」。
 * 保留原时刻（小时:分钟），让排期更自然。返回被顺延的任务数。
 */
export function rescheduleOverdue(): number {
  const startToday = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const now = Date.now();
  const overdue = (db
    .prepare(`SELECT * FROM tasks WHERE due_time IS NOT NULL AND due_time < ? AND status='todo'`)
    .all(startToday) as any[]).map(rowToTask);
  let moved = 0;
  for (const t of overdue) {
    const orig = new Date(t.due_time!);
    const candidate = new Date();
    candidate.setHours(orig.getHours(), orig.getMinutes(), orig.getSeconds(), 0);
    if (candidate.getTime() <= now) candidate.setDate(candidate.getDate() + 1);
    const remindOffset = t.remind_at && t.due_time ? t.due_time - t.remind_at : 0;
    const remind = remindOffset ? candidate.getTime() - remindOffset : null;
    db.prepare('UPDATE tasks SET due_time=?, remind_at=?, notified=0 WHERE id=?').run(
      candidate.getTime(),
      remind,
      t.id
    );
    moved++;
  }
  return moved;
}
