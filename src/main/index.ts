/**
 * 主进程入口。
 * 负责创建窗口与系统托盘、注册全局快捷键、挂载全部 IPC 通道，
 * 并把渲染进程的请求路由到 db / services 层。AI 生成的任务/笔记会在此处静默提炼进记忆库。
 */

import { app, BrowserWindow, Tray, Menu, globalShortcut, Notification, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { listTasks, createTask, updateTask, deleteTask, rescheduleOverdue, snoozeTask } from './db/tasks';
import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  searchNotes,
  askQuestion,
} from './db/notes';
import { getBriefing } from './db/briefing';
import { loadSettings, saveSettings } from './db/settings';
import {
  parseTask,
  recommendOrder,
  testConnection,
  smartProcess,
  chatTurn,
  askHybrid,
  generateDailyBriefing,
  breakdownTask,
  planGoal,
  extractMemories,
} from './services/aiService';
import {
  listGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  addStage,
  updateStage,
  deleteStage,
} from './db/goals';
import {
  listMemories,
  createMemory,
  deleteMemory,
  searchMemories as searchMemoriesDb,
} from './db/memories';
import { exportData, exportAll, importData, exportNotesMarkdown } from './services/exportService';
import { schedulerTick, checkReminders, checkDailyBriefing } from './services/notifyService';

// 兜底：1x1 透明 PNG
const ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function loadAppIcon() {
  const candidates = [
    path.join(__dirname, '../../assets/icon.png'),
    path.join(__dirname, '../../../assets/icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return nativeImage.createFromPath(p);
    }
  }
  return nativeImage.createFromDataURL(ICON_DATA_URL);
}

let win: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  const icon = loadAppIcon();
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    icon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = process.env.ELECTRON_RENDERER_URL;
  if (url) win.loadURL(url);
  else win.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 关闭窗口 = 最小化到托盘，不退出
  win.on('close', (e) => {
    e.preventDefault();
    win?.hide();
  });

  // 提醒 + 每日简报 统一调度（每分钟一次）
  setInterval(() => schedulerTick(win!), 60_000);
  schedulerTick(win!);
}

function createTray() {
  const icon = loadAppIcon();
  tray = new Tray(icon);
  tray.setToolTip('笃行');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示窗口', click: () => win?.show() },
      { type: 'separator' },
      { label: '退出', click: () => app.exit() },
    ])
  );
  tray.on('double-click', () => win?.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // 全局快捷键唤起：Ctrl+Shift+T
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (!win) return;
    if (win.isVisible()) win.focus();
    else {
      win.show();
      win.focus();
    }
  });
});

// 保证托盘常驻时应用不退出（不调用 app.quit()，由托盘管理生命周期）
app.on('window-all-closed', () => {
  // 托盘常驻：保留后台进程，不退出
});

// ---------- IPC ----------
ipcMain.handle('tasks:list', () => listTasks());
ipcMain.handle('tasks:create', (_e, draft, source) => {
  const t = createTask(draft, source);
  // AI 生成的待办自动提炼到记忆库（静默、失败不影响主流程）
  if (source === 'nl' && draft) {
    const txt = `${draft.title || ''}\n${draft.notes || ''}`;
    extractMemories(txt, 'task')
      .then((mems) => mems.forEach((m: any) => createMemory({ ...m, source: 'task', source_id: t.id })))
      .catch(() => {});
  }
  return t;
});
ipcMain.handle('tasks:update', (_e, id, patch) => updateTask(id, patch));
ipcMain.handle('tasks:delete', (_e, id) => {
  deleteTask(id);
  return true;
});
ipcMain.handle('ai:parse', (_e, text) => parseTask(text));
ipcMain.handle('ai:recommend', () => recommendOrder());
ipcMain.handle('ai:breakdown', (_e, title, notes) => breakdownTask(title, notes));
ipcMain.handle('ai:test', (_e, opts) => testConnection(opts));
ipcMain.handle('ai:smart', (_e, text, images, forcedIntent) => smartProcess(text, images, forcedIntent));
ipcMain.handle('ai:chat', (_e, userText, history, images) => chatTurn(userText, history, images));
ipcMain.handle('ai:hybrid', (_e, userText, history, images) => askHybrid(userText, history, images));
ipcMain.handle('briefing:get', () => getBriefing());
ipcMain.handle('briefing:generate', () => generateDailyBriefing());
ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:save', (_e, s) => saveSettings(s));
ipcMain.handle('data:export', (_e, format) => exportData(format));
ipcMain.handle('data:exportAll', () => exportAll());
ipcMain.handle('data:import', (_e, json) => importData(json));
ipcMain.handle('tasks:rescheduleOverdue', () => rescheduleOverdue());
ipcMain.handle('tasks:snooze', (_e, id, minutes) => snoozeTask(id, minutes));
ipcMain.on('app:show', () => win?.show());

// ---------- 知识库 IPC ----------
ipcMain.handle('notes:list', () => listNotes());
ipcMain.handle('notes:get', (_e, id) => getNote(id));
ipcMain.handle('notes:create', (_e, title, content, images) => {
  const n = createNote(title, content, images);
  // 记录知识时自动提炼记忆要点（静默、失败不影响主流程）
  const txt = `${title}\n${content}`;
  extractMemories(txt, 'note')
    .then((mems) => mems.forEach((m: any) => createMemory({ ...m, source: 'note', source_id: n.id })))
    .catch(() => {});
  return n;
});
ipcMain.handle('notes:update', (_e, id, patch) => updateNote(id, patch));
ipcMain.handle('notes:delete', (_e, id) => {
  deleteNote(id);
  return true;
});
ipcMain.handle('notes:search', (_e, q) => searchNotes(q));
ipcMain.handle('notes:ask', (_e, q, images) => askQuestion(q, images));
ipcMain.handle('notes:exportMarkdown', () => exportNotesMarkdown());

// ---------- 目标路线图 IPC ----------
ipcMain.handle('goals:list', () => listGoals());
ipcMain.handle('goals:get', (_e, id) => getGoal(id));
ipcMain.handle('goals:create', (_e, draft) => createGoal(draft));
ipcMain.handle('goals:update', (_e, id, patch) => updateGoal(id, patch));
ipcMain.handle('goals:delete', (_e, id) => {
  deleteGoal(id);
  return true;
});
ipcMain.handle('goals:addStage', (_e, goalId, draft) => addStage(goalId, draft));
ipcMain.handle('goals:updateStage', (_e, stageId, patch) => {
  updateStage(stageId, patch);
  return true;
});
ipcMain.handle('goals:deleteStage', (_e, stageId) => {
  deleteStage(stageId);
  return true;
});
ipcMain.handle('ai:planGoal', (_e, title, description, brief) => planGoal(title, description, brief));

// ---------- AI 记忆库 IPC ----------
ipcMain.handle('memories:list', () => listMemories());
ipcMain.handle('memories:create', (_e, draft) => createMemory(draft));
ipcMain.handle('memories:delete', (_e, id) => {
  deleteMemory(id);
  return true;
});
ipcMain.handle('memories:extract', (_e, text, source) =>
  extractMemories(text, source).then((mems) => mems.map((m) => createMemory({ ...m, source })))
);
ipcMain.handle('memories:search', (_e, q, embedding) => searchMemoriesDb(q, 20, embedding));

// 防止未使用告警（Notification 在 notifyService 中使用）
void Notification;
