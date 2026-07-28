import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Task, TaskDraft, Recurrence, SubTask } from '../../../shared/types';
import { PRIORITY, toLocalInput, fromLocalInput, toDateInput, fromDateInput } from '../utils';

const RECUR_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
];

const uid = () => (globalThis as any).crypto.randomUUID();

export default function TaskEditor() {
  const editorTask = useStore((s) => s.editorTask);
  const editorDraft = useStore((s) => s.editorDraft);
  const closeEditor = useStore((s) => s.closeEditor);
  const createTask = useStore((s) => s.createTask);
  const updateTask = useStore((s) => s.updateTask);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [importance, setImportance] = useState<1 | 2 | 3>(2);
  const [due, setDue] = useState('');
  const [remind, setRemind] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [subInput, setSubInput] = useState('');

  useEffect(() => {
    const src: Task | TaskDraft | null = editorTask || editorDraft;
    setTitle(src?.title || '');
    setNotes((src as any)?.notes || '');
    setCategory((src as any)?.category || '');
    setPriority(((src as any)?.priority as 1 | 2 | 3) || 2);
    setImportance(((src as any)?.importance as 1 | 2 | 3) || 2);
    setDue(toLocalInput((src as any)?.due_time));
    setRemind(toLocalInput((src as any)?.remind_at));
    setRecurrence((src as any)?.recurrence || 'none');
    setRecurrenceEnd(toDateInput((src as any)?.recurrence_end));
    setSubtasks((src as any)?.subtasks || []);
    setSubInput('');
  }, [editorTask, editorDraft]);

  const addSub = () => {
    const t = subInput.trim();
    if (!t) return;
    setSubtasks((prev) => [...prev, { id: uid(), title: t, done: false }]);
    setSubInput('');
  };

  const toggleSub = (id: string) =>
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));

  const removeSub = (id: string) => setSubtasks((prev) => prev.filter((s) => s.id !== id));

  const save = async () => {
    if (!title.trim()) return;
    const draft: TaskDraft = {
      title: title.trim(),
      notes,
      category: category || undefined,
      priority,
      importance,
      due_time: fromLocalInput(due),
      remind_at: fromLocalInput(remind),
      recurrence: recurrence || 'none',
      recurrence_end: recurrence !== 'none' ? fromDateInput(recurrenceEnd) : null,
      subtasks: subtasks.length ? subtasks : undefined,
    };
    if (editorTask) await updateTask(editorTask.id, draft);
    else await createTask(draft, editorDraft ? 'nl' : 'manual');
    closeEditor();
  };

  return (
    <div className="modal-mask" onClick={closeEditor}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <h3>{editorTask ? '编辑任务' : editorDraft ? '新建任务' : '新建任务'}</h3>
        <label>标题</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <label>备注</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <label>分类（标签）</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="工作 / 生活 / 学习 / 健康…"
        />
        <label>优先级</label>
        <select value={priority} onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}>
          <option value={1}>{PRIORITY[1].label}</option>
          <option value={2}>{PRIORITY[2].label}</option>
          <option value={3}>{PRIORITY[3].label}</option>
        </select>
        <label>重要程度（四象限用）</label>
        <select value={importance} onChange={(e) => setImportance(Number(e.target.value) as 1 | 2 | 3)}>
          <option value={1}>高（重要）</option>
          <option value={2}>中</option>
          <option value={3}>低（次要）</option>
        </select>
        <label>截止时间</label>
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        <label>提醒时间</label>
        <input type="datetime-local" value={remind} onChange={(e) => setRemind(e.target.value)} />
        <label>重复</label>
        <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
          {RECUR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {recurrence !== 'none' && (
          <>
            <label>重复截止日期（可选）</label>
            <input type="date" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} />
          </>
        )}

        <label>子任务</label>
        <div className="subtasks-edit">
          {subtasks.map((s) => (
            <div key={s.id} className="subtask-edit-row">
              <input type="checkbox" checked={s.done} onChange={() => toggleSub(s.id)} />
              <input className="sub-input" value={s.title} onChange={(e) => setSubtasks((prev) => prev.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} />
              <button className="icon-btn danger" onClick={() => removeSub(s.id)}>×</button>
            </div>
          ))}
          <div className="subtask-edit-row">
            <input
              className="sub-input"
              placeholder="添加子步骤，回车确认"
              value={subInput}
              onChange={(e) => setSubInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSub();
                }
              }}
            />
            <button className="icon-btn" onClick={addSub}>＋</button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={closeEditor}>取消</button>
          <button className="btn primary" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  );
}
