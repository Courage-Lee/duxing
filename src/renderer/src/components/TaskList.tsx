import { useStore } from '../store/useStore';
import { isToday } from '../utils';
import TaskCard from './TaskCard';

export default function TaskList() {
  const tasks = useStore((s) => s.tasks);
  const filter = useStore((s) => s.filter);
  const search = useStore((s) => s.search);
  const showDone = useStore((s) => s.showDone);
  const priorityFilter = useStore((s) => s.priorityFilter);

  const q = search.trim().toLowerCase();

  let list = tasks.filter((t) => {
    if (!showDone && t.status === 'done') return false;
    if (filter === 'today') {
      if (!isToday(t.due_time)) return false;
    } else if (filter !== 'all') {
      if (t.category !== filter) return false;
    }
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (q) {
      const hay = `${t.title} ${t.notes ?? ''} ${t.category ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // 排序：未完成优先；同状态按截止时间升序（无日期排最后），再按优先级
  list = [...list].sort((a, b) => {
    const ad = a.status === 'done' ? 1 : 0;
    const bd = b.status === 'done' ? 1 : 0;
    if (ad !== bd) return ad - bd;
    const at = a.due_time ?? Infinity;
    const bt = b.due_time ?? Infinity;
    if (at !== bt) return at - bt;
    return a.priority - b.priority;
  });

  return (
    <div className="task-list">
      {list.length === 0 && <div className="empty">没有匹配的任务，换个筛选条件，或在下方输入框试试 AI 识别。</div>}
      {list.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}
    </div>
  );
}
