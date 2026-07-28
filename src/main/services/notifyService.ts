/**
 * 通知调度层：每分钟轮询到期提醒与每日简报定时推送，弹出原生通知（点击唤起窗口）。
 * lastBriefingDate 为进程内存态，避免同一天重复推送。
 */

import { BrowserWindow, Notification } from 'electron';
import db from '../db';
import { loadSettings } from '../db/settings';
import { getBriefing } from '../db/briefing';

function fmt(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 当天已推送过每日简报的日期，避免重复（进程内存态，关掉 App 即重置） */
let lastBriefingDate: string | null = null;

/** 轮询到期提醒（remind_at <= now 且未提醒且未完成）并弹出系统通知 */
export function checkReminders(win?: BrowserWindow): void {
  const rows = db
    .prepare(
      `SELECT * FROM tasks WHERE remind_at IS NOT NULL AND remind_at <= ? AND notified = 0 AND status = 'todo'`
    )
    .all(Date.now()) as any[];
  for (const r of rows) {
    let body = r.title;
    if (r.due_time) body += `（截止 ${fmt(r.due_time)}）`;
    const n = new Notification({ title: '⏰ 待办提醒', body });
    n.on('click', () => {
      if (win) {
        win.show();
        win.focus();
      }
    });
    n.show();
    db.prepare('UPDATE tasks SET notified = 1 WHERE id = ?').run(r.id);
  }
}

/** 每日简报定时推送：到达/超过设定时间且当天尚未推送过，则弹通知（点击打开窗口） */
export function checkDailyBriefing(win?: BrowserWindow): void {
  const s = loadSettings();
  if (!s.dailyBriefing) return;
  const now = new Date();
  const target = (s.briefingTime || '09:00').split(':');
  const th = Number(target[0]) || 9;
  const tm = Number(target[1]) || 0;
  const curH = now.getHours();
  const curM = now.getMinutes();
  // 已到设定时间（含之后打开 App 的补推），且今天还没推过
  const passed = curH > th || (curH === th && curM >= tm);
  const today = dateStr(now);
  if (passed && lastBriefingDate !== today) {
    lastBriefingDate = today;
    const b = getBriefing();
    const tail = b.overdue.length ? `，${b.overdue.length} 项已逾期` : '';
    const body = `今日 ${b.dueToday.length} 项待办（高优先级 ${b.highPriorityToday} 项）${tail}。点击查看今日简报 →`;
    const n = new Notification({ title: '📋 今日简报', body });
    n.on('click', () => {
      if (win) {
        win.show();
        win.focus();
      }
    });
    n.show();
  }
}

/** 统一调度：每分钟同时检查任务提醒与每日简报 */
export function schedulerTick(win?: BrowserWindow): void {
  checkReminders(win);
  checkDailyBriefing(win);
}
