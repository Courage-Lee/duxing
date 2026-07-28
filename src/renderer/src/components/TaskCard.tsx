import { useState } from 'react';
import { Task } from '../../../shared/types';
import { useStore } from '../store/useStore';
import { PRIORITY, fmt, isOverdue } from '../utils';

const RECUR_LABEL: Record<string, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
};

export default function TaskCard({ task }: { task: Task }) {
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const openEditor = useStore((s) => s.openEditor);
  const breakdownTask = useStore((s) => s.breakdownTask);
  const snoozeTask = useStore((s) => s.snoozeTask);
  const toggleDone = useStore((s) => s.toggleDone);
  const snoozeMinutes = useStore((s) => s.settings.snoozeMinutes ?? 30);

  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const p = PRIORITY[task.priority] ?? PRIORITY[2];
  const imp = task.importance ?? 2;
  const overdue = isOverdue(task);
  const recur = task.recurrence && task.recurrence !== 'none' ? RECUR_LABEL[task.recurrence] : '';
  const subs = task.subtasks ?? [];
  const doneSubs = subs.filter((s) => s.done).length;

  const toggleSub = (subId: string) => {
    const next = subs.map((s) => (s.id === subId ? { ...s, done: !s.done } : s));
    updateTask(task.id, { subtasks: next });
  };

  const onBreakdown = async () => {
    setBusy(true);
    try {
      await breakdownTask(task.id, task.title, task.notes);
      setExpanded(true);
    } finally {
      setBusy(false);
    }
  };

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/task-id', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="card panel" draggable onDragStart={onDragStart}>
      <input
        type="checkbox"
        onChange={() => toggleDone(task)}
        checked={task.status === 'done'}
        title="标记完成 / 取消完成"
      />
      <div className="card-body">
        <div className="card-title">{task.title}</div>
        <div className="card-meta">
          <span className="dot" style={{ background: p.color }} title={`优先级：${p.label}`} />
          {imp === 1 && <span className="tag imp imp-1" title="重要程度：高">★重要</span>}
          {imp === 3 && <span className="tag imp imp-3" title="重要程度：低">○次要</span>}
          {task.category && <span className="tag">{task.category}</span>}
          {recur && <span className="recur" title="重复任务">🔁 {recur}</span>}
          {task.images && task.images.length > 0 && (
            <span className="tag">🖼️ {task.images.length}</span>
          )}
          {subs.length > 0 && (
            <button
              className="tag subtask-toggle"
              onClick={() => setExpanded((v) => !v)}
              title="查看子任务"
            >
              ✓ {doneSubs}/{subs.length}
            </button>
          )}
          {task.due_time && (
            <span className={overdue ? 'due overdue' : 'due'}>📅 {fmt(task.due_time)}</span>
          )}
          {task.remind_at && <span className="remind">🔔 {fmt(task.remind_at)}</span>}
        </div>

        {task.notes && task.notes.trim() && (
          <div className="card-notes">{task.notes}</div>
        )}

        {subs.length > 0 && expanded && (
          <div className="subtasks">
            {subs.map((s) => (
              <label key={s.id} className={`subtask${s.done ? ' done' : ''}`}>
                <input type="checkbox" checked={s.done} onChange={() => toggleSub(s.id)} />
                <span>{s.title}</span>
              </label>
            ))}
          </div>
        )}

        {task.images && task.images.length > 0 && (
          <div className="image-thumbs small">
            {task.images.map((url, i) => (
              <div key={i} className="thumb" onClick={() => setPreview(url)} title="点击放大查看">
                <img src={url} alt="" />
              </div>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <div className="lightbox" onClick={() => setPreview(null)}>
          <img src={preview} alt="" onClick={(e) => e.stopPropagation()} />
          <button
            className="lightbox-close"
            onClick={() => setPreview(null)}
            title="关闭"
          >
            ×
          </button>
        </div>
      )}
      <div className="card-actions">
        <button className="icon-btn" onClick={() => openEditor(task)}>编辑</button>
        <button className="icon-btn" onClick={onBreakdown} disabled={busy} title="AI 拆解成子步骤">
          {busy ? '拆解中…' : 'AI拆解'}
        </button>
        {task.status !== 'done' && (
          <button className="icon-btn" onClick={() => snoozeTask(task.id, snoozeMinutes)} title={`稍后提醒（${snoozeMinutes}分钟）`}>
            💤 稍后
          </button>
        )}
        <button className="icon-btn danger" onClick={() => deleteTask(task.id)}>删除</button>
      </div>
    </div>
  );
}
