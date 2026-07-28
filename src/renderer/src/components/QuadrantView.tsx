import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Task, Priority } from '../../../shared/types';
import TaskCard from './TaskCard';
import { Icon } from './icons';

type QuadKey = 'q1' | 'q2' | 'q3' | 'q4';

interface QuadCfg {
  key: QuadKey;
  title: string;
  sub: string;
  imp: 1 | 2 | 3;
  pri: Priority;
}

const QUADS: QuadCfg[] = [
  { key: 'q1', title: '重要且紧急', sub: '立即做', imp: 1, pri: 1 },
  { key: 'q2', title: '重要不紧急', sub: '计划做', imp: 1, pri: 3 },
  { key: 'q3', title: '紧急不重要', sub: '委托 / 快速处理', imp: 3, pri: 1 },
  { key: 'q4', title: '不重要不紧急', sub: '减少 / 删除', imp: 3, pri: 3 },
];

function quadOf(t: Task): QuadKey {
  const urgent = t.priority === 1;
  const important = (t.importance ?? 2) === 1;
  if (important && urgent) return 'q1';
  if (important && !urgent) return 'q2';
  if (!important && urgent) return 'q3';
  return 'q4';
}

export default function QuadrantView() {
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);
  const [over, setOver] = useState<QuadKey | null>(null);

  const active = tasks.filter((t) => t.status === 'todo');
  const grouped: Record<QuadKey, Task[]> = { q1: [], q2: [], q3: [], q4: [] };
  for (const t of active) grouped[quadOf(t)].push(t);

  const onDrop = async (cfg: QuadCfg, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/task-id');
    if (!id) return;
    await updateTask(id, { importance: cfg.imp, priority: cfg.pri });
  };

  return (
    <div className="quadrant">
      <header className="bf-head">
        <div>
          <h2><Icon name="quadrant" size={18} className="h-ico" />四象限（艾森豪威尔）</h2>
          <div className="muted">按「重要程度 × 紧急程度」分类；拖动待办卡片到对应象限即可重排优先级与重要度。</div>
        </div>
      </header>
      <div className="quad-grid">
        {QUADS.map((q) => (
          <section
            key={q.key}
            className={`quad quad-${q.key}${over === q.key ? ' drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (over !== q.key) setOver(q.key);
            }}
            onDragLeave={() => setOver((cur) => (cur === q.key ? null : cur))}
            onDrop={(e) => onDrop(q, e)}
          >
            <div className="quad-head">
              <b>{q.title}</b>
              <span className="quad-sub">{q.sub}</span>
              <span className="quad-count">{grouped[q.key].length}</span>
            </div>
            <div className="quad-list">
              {grouped[q.key].length === 0 && <div className="muted quad-empty">拖拽待办到此处</div>}
              {grouped[q.key].map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
