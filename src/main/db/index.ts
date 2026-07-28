/**
 * SQLite 数据库连接与初始化（better-sqlite3，单文件，存于用户数据目录）。
 * 启动时建表并做幂等字段迁移；另含 goals / goal_stages / memories 三张业务表。
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(app.getPath('userData'), 'ai-todo');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'tasks.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  notes       TEXT,
  category    TEXT,
  priority    INTEGER,
  status      TEXT DEFAULT 'todo',
  due_time    INTEGER,
  remind_at   INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER,
  completed_at INTEGER,
  source      TEXT,
  notified    INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY,
  color TEXT,
  is_smart INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  action TEXT,
  at INTEGER
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER
);
`);

// 旧库迁移：新增 recurrence 相关字段（幂等，列已存在则忽略）
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN recurrence TEXT DEFAULT 'none'`);
} catch {
  /* 列已存在 */
}
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_end INTEGER`);
} catch {
  /* 列已存在 */
}
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN images TEXT`);
} catch {
  /* 列已存在 */
}
try {
  db.exec(`ALTER TABLE notes ADD COLUMN images TEXT`);
} catch {
  /* 列已存在 */
}
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN subtasks TEXT`);
} catch {
  /* 列已存在 */
}
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN snoozed INTEGER`);
} catch {
  /* 列已存在 */
}
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN importance INTEGER DEFAULT 2`);
} catch {
  /* 列已存在 */
}

// 目标路线图
db.exec(`
CREATE TABLE IF NOT EXISTS goals (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  success_criteria TEXT,
  start_date    INTEGER,
  target_date   INTEGER,
  status        TEXT DEFAULT 'active',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER
);
CREATE TABLE IF NOT EXISTS goal_stages (
  id          TEXT PRIMARY KEY,
  goal_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  kind        TEXT DEFAULT 'stage',
  planned_end_at INTEGER,
  weight      REAL DEFAULT 1,
  done        INTEGER DEFAULT 0,
  sort_order  INTEGER DEFAULT 0,
  parent_id   TEXT
);
`);

// AI 记忆库
db.exec(`
CREATE TABLE IF NOT EXISTS memories (
  id          TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  type        TEXT DEFAULT 'fact',
  importance  INTEGER DEFAULT 2,
  source      TEXT DEFAULT 'manual',
  source_id   TEXT,
  access_count INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  embedding   TEXT
);
`);

export default db;
