/**
 * 每日简报聚合：从活跃/已完成任务中统计逾期、今日截止、未来 7 天、今日提醒、已完成等维度，
 * 供通知与 AI 摘要使用。
 */

import { Task, Briefing } from '../../shared/types';
import { listTasks } from './tasks';

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

const MAX_LIST = 12;

/** 聚合「今日简报」所需的全部统计数据 */
export function getBriefing(): Briefing {
  const now = Date.now();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = todayEnd + 7 * 86_400_000; // 未来 7 天（不含今天）

  const all = listTasks();
  const active = all.filter((t: Task) => t.status === 'todo');

  const overdue = active
    .filter((t) => t.due_time != null && t.due_time < todayStart)
    .sort((a, b) => (a.due_time || 0) - (b.due_time || 0));

  const dueToday = active
    .filter((t) => t.due_time != null && t.due_time >= todayStart && t.due_time <= todayEnd)
    .sort((a, b) => (a.due_time || 0) - (b.due_time || 0));

  const dueThisWeek = active
    .filter((t) => t.due_time != null && t.due_time > todayEnd && t.due_time <= weekEnd)
    .sort((a, b) => (a.due_time || 0) - (b.due_time || 0));

  const remindersToday = active
    .filter((t) => t.remind_at != null && t.remind_at >= todayStart && t.remind_at <= todayEnd)
    .sort((a, b) => (a.remind_at || 0) - (b.remind_at || 0));

  const completedToday = all.filter(
    (t) => t.status === 'done' && t.completed_at != null && t.completed_at >= todayStart
  );

  const highPriorityToday = dueToday.filter((t) => t.priority === 1).length;

  return {
    date: new Date(now).toISOString().slice(0, 10),
    totalActive: active.length,
    overdue: overdue.slice(0, MAX_LIST),
    dueToday: dueToday.slice(0, MAX_LIST),
    dueThisWeek: dueThisWeek.slice(0, MAX_LIST),
    remindersToday: remindersToday.slice(0, MAX_LIST),
    highPriorityToday,
    completedToday: completedToday.length,
    generatedAt: now,
  };
}
