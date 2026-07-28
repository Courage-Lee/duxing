/**
 * 渲染进程通用工具：优先级配色、时间输入控件与 epoch 互转、
 * 日期/相对时间格式化、今天/逾期判断等纯函数。
 */

import { Task } from '../../shared/types';

export const PRIORITY: Record<number, { label: string; color: string }> = {
  1: { label: '高', color: '#ef4444' },
  2: { label: '中', color: '#f59e0b' },
  3: { label: '低', color: '#9ca3af' },
};

/** epoch -> datetime-local 输入值（本地时区） */
export function toLocalInput(ts?: number | null): string {
  if (!ts) return '';
  const d = new Date(ts - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return isNaN(t) ? null : t;
}

/** epoch -> date 输入值（本地时区，YYYY-MM-DD） */
export function toDateInput(ts?: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** date 输入值 -> epoch（本地 00:00） */
export function fromDateInput(v: string): number | null {
  if (!v) return null;
  const t = new Date(v + 'T00:00:00').getTime();
  return isNaN(t) ? null : t;
}

export function fmt(ts?: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

export function isToday(ts?: number | null): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function isOverdue(t: Task): boolean {
  return t.status === 'todo' && !!t.due_time && t.due_time < Date.now();
}
