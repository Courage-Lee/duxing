import { useState } from 'react';
import { useStore } from '../store/useStore';
import { fmt, isOverdue } from '../utils';
import { Task } from '../../../shared/types';
import { Icon } from './icons';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a?: number | null | undefined, b?: number | null | undefined): boolean {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export default function CalendarView() {
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);
  const setView = useStore((s) => s.setView);
  const openEditor = useStore((s) => s.openEditor);
  const toggleDone = useStore((s) => s.toggleDone);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<number>(startOfDay(now).getTime());
  const [dragOver, setDragOver] = useState<number | null>(null);

  const first = new Date(year, month, 1);
  const lead = first.getDay(); // 0=周日
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d).getTime());
  while (cells.length % 7 !== 0) cells.push(null);

  const tasksByDay = (ts: number) => tasks.filter((t) => t.status === 'todo' && sameDay(t.due_time, ts));
  const selectedTasks = tasks
    .filter((t) => sameDay(t.due_time, selected))
    .sort((a, b) => (a.due_time ?? 0) - (b.due_time ?? 0));

  const prev = () => {
    const m = month - 1;
    if (m < 0) {
      setYear(year - 1);
      setMonth(11);
    } else setMonth(m);
  };
  const next = () => {
    const m = month + 1;
    if (m > 11) {
      setYear(year + 1);
      setMonth(0);
    } else setMonth(m);
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelected(startOfDay(now).getTime());
  };

  // 拖拽排期：把待办落到某天，设置其截止日期（保留原时刻，无则默认 09:00）
  const onDropDay = async (ts: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/task-id');
    if (!id) return;
    const t = tasks.find((x) => x.id === id);
    const d = new Date(ts);
    if (t?.due_time) {
      const ot = new Date(t.due_time);
      d.setHours(ot.getHours(), ot.getMinutes(), 0, 0);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    await updateTask(id, { due_time: d.getTime() });
    setSelected(ts);
  };

  return (
    <div className="calendar">
      <header className="bf-head">
        <div>
          <h2><Icon name="calendar" size={18} className="h-ico" />日历</h2>
          <div className="muted">点击日期查看当天待办，点击任务可完成或编辑</div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={prev}>‹</button>
          <b>{year} 年 {month + 1} 月</b>
          <button className="btn" onClick={next}>›</button>
          <button className="btn" onClick={goToday}>今天</button>
        </div>
      </header>

      <div className="cal-grid">
        {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
          <div key={w} className="cal-weekday">{w}</div>
        ))}
        {cells.map((ts, i) => {
          if (ts == null) return <div key={i} className="cal-cell empty" />;
          const dayTasks = tasksByDay(ts);
          const isSel = sameDay(ts, selected);
          const isPast = ts < startOfDay(now).getTime();
          const isOver = dragOver === ts;
          return (
            <div
              key={i}
              className={`cal-cell${isSel ? ' selected' : ''}${isPast ? ' past' : ''}${isOver ? ' drag-over' : ''}`}
              onClick={() => setSelected(ts)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOver !== ts) setDragOver(ts);
              }}
              onDragLeave={() => setDragOver((cur) => (cur === ts ? null : cur))}
              onDrop={(e) => onDropDay(ts, e)}
            >
              <div className="cal-date">{new Date(ts).getDate()}</div>
              <div className="cal-dots">
                {dayTasks.slice(0, 3).map((t: Task) => (
                  <span
                    key={t.id}
                    className="cal-dot"
                    style={{ background: isOverdue(t) ? '#ef4444' : t.priority === 1 ? '#f59e0b' : '#3b82f6' }}
                    title={t.title}
                  />
                ))}
                {dayTasks.length > 3 && <span className="cal-more">+{dayTasks.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="cal-detail panel">
        <div className="bf-col-title">
          {new Date(selected).getMonth() + 1}/{new Date(selected).getDate()} 的待办（{selectedTasks.length}）
        </div>
        {selectedTasks.length === 0 && <div className="muted bf-empty">这一天没有待办 🎉</div>}
        {selectedTasks.map((t) => (
          <div key={t.id} className="bf-row">
            <button
              className="bf-check"
              onClick={() => toggleDone(t)}
              title="标记完成"
            />
            <div className="bf-row-body">
              <div className="bf-row-title" onClick={() => openEditor(t)} style={{ cursor: 'pointer' }}>
                {t.title}
              </div>
              <div className="card-meta">
                {t.due_time && <span className={isOverdue(t) ? 'due overdue' : ''}>⏰ {fmt(t.due_time)}</span>}
                {t.category && <span className="tag">{t.category}</span>}
              </div>
            </div>
          </div>
        ))}
        {selectedTasks.length > 0 && (
          <button className="link-btn" onClick={() => setView('todo')}>在待办页查看全部 →</button>
        )}
      </div>
    </div>
  );
}
