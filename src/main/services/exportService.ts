/**
 * 数据导出 / 导入层：任务导出 JSON/CSV（CSV 带 BOM 防 Excel 乱码）、
 * 全量备份与合并导入、笔记导出 Markdown。文件统一落盘到系统「下载」目录。
 */

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { listTasks } from '../db/tasks';
import { listNotes } from '../db/notes';
import { loadSettings, saveSettings } from '../db/settings';
import db from '../db';
import { ExportFormat, AppBackup } from '../../shared/types';

export function exportData(format: ExportFormat): string {
  const tasks = listTasks();
  const dir = app.getPath('downloads');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  if (format === 'json') {
    const file = path.join(dir, `ai-todo-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(tasks, null, 2), 'utf-8');
    return file;
  }
  const rows = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    notes: t.notes,
    category: t.category || '',
    priority: t.priority,
    status: t.status,
    due_time: t.due_time ? new Date(t.due_time).toISOString() : '',
    remind_at: t.remind_at ? new Date(t.remind_at).toISOString() : '',
    created_at: new Date(t.created_at).toISOString(),
    source: t.source,
  }));
  const csv = Papa.unparse(rows);
  const file = path.join(dir, `ai-todo-${stamp}.csv`);
  fs.writeFileSync(file, '﻿' + csv, 'utf-8'); // BOM 防 Excel 中文乱码
  return file;
}

/** 全量备份：任务 + 笔记 + 设置，导出为单个 JSON 文件 */
export function exportAll(): string {
  const backup: AppBackup = {
    version: 1,
    exportedAt: Date.now(),
    tasks: listTasks(),
    notes: listNotes(),
    settings: loadSettings(),
  };
  const dir = app.getPath('downloads');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = path.join(dir, `ai-todo-backup-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2), 'utf-8');
  return file;
}

/**
 * 导入全量备份：按 id 合并写入（已存在的覆盖，不存在的新增），不删除现有数据。
 * 返回导入的任务/笔记数量。
 */
export function importData(json: string): { tasks: number; notes: number } {
  const data = JSON.parse(json) as AppBackup;
  if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.notes)) {
    throw new Error('备份文件格式不正确');
  }
  let tasksCount = 0;
  for (const t of data.tasks) {
    const imagesJson = t.images?.length ? JSON.stringify(t.images) : null;
    const subtasksJson = t.subtasks?.length ? JSON.stringify(t.subtasks) : null;
    db.prepare(
      `INSERT OR REPLACE INTO tasks
       (id,title,notes,category,priority,status,due_time,remind_at,created_at,updated_at,completed_at,source,notified,recurrence,recurrence_end,images,subtasks,snoozed)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      t.id,
      t.title,
      t.notes ?? '',
      t.category ?? null,
      t.priority ?? 2,
      t.status ?? 'todo',
      t.due_time ?? null,
      t.remind_at ?? null,
      t.created_at ?? Date.now(),
      t.updated_at ?? null,
      t.completed_at ?? null,
      t.source ?? 'manual',
      t.notified ?? 0,
      t.recurrence ?? 'none',
      t.recurrence_end ?? null,
      imagesJson,
      subtasksJson,
      t.snoozed ?? null
    );
    tasksCount++;
  }
  let notesCount = 0;
  for (const n of data.notes) {
    const imagesJson = n.images?.length ? JSON.stringify(n.images) : null;
    db.prepare(
      `INSERT OR REPLACE INTO notes (id,title,content,created_at,updated_at,images) VALUES (?,?,?,?,?,?)`
    ).run(
      n.id,
      n.title,
      n.content,
      n.created_at ?? Date.now(),
      n.updated_at ?? null,
      imagesJson
    );
    notesCount++;
  }
  if (data.settings) saveSettings(data.settings);
  return { tasks: tasksCount, notes: notesCount };
}

/** 把所有笔记导出为一个 Markdown 文件（按标题分节），便于分享/归档 */
export function exportNotesMarkdown(): string {
  const notes = listNotes();
  const dir = app.getPath('downloads');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = path.join(dir, `ai-todo-notes-${stamp}.md`);
  const md = notes
    .map((n) => {
      const head = `## ${n.title}`;
      const meta = `_更新于 ${new Date(n.updated_at ?? n.created_at).toLocaleString('zh-CN')}_${
        n.images?.length ? ` · 🖼️ ${n.images.length} 张图` : ''
      }`;
      return [head, meta, '', n.content, ''].join('\n');
    })
    .join('\n');
  fs.writeFileSync(file, `# 我的笔记导出（${notes.length} 篇）\n\n` + md, 'utf-8');
  return file;
}
