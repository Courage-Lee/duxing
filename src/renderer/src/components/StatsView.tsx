import { useStore } from '../store/useStore';
import { isOverdue } from '../utils';
import { Icon } from './icons';

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function StatsView() {
  const tasks = useStore((s) => s.tasks);

  const all = tasks;
  const done = all.filter((t) => t.status === 'done');
  const active = all.filter((t) => t.status === 'todo');
  const overdue = active.filter(isOverdue);

  const totalAll = all.length || 1;
  const rate = Math.round((done.length / totalAll) * 100);

  const now = Date.now();
  const DAY = 86_400_000;
  const last7 = Array.from({ length: 7 }, (_, i) => startOfDay(now) - (6 - i) * DAY);
  const perDay = last7.map((d0) => {
    const d1 = d0 + DAY;
    return done.filter((t) => t.completed_at != null && t.completed_at >= d0 && t.completed_at < d1).length;
  });
  const maxPerDay = Math.max(1, ...perDay);
  const done7 = perDay.reduce((a, b) => a + b, 0);
  const done30 = done.filter((t) => t.completed_at != null && t.completed_at >= startOfDay(now) - 29 * DAY).length;

  const Stat = ({ num, label, danger }: { num: number | string; label: string; danger?: boolean }) => (
    <div className={`ov-card${danger ? ' danger' : ''}`}>
      <div className="ov-num">{num}</div>
      <div className="ov-label">{label}</div>
    </div>
  );

  return (
    <div className="stats">
      <header className="bf-head">
        <div>
          <h2><Icon name="stats" size={18} className="h-ico" />生产力统计</h2>
          <div className="muted">基于本地任务数据，实时计算</div>
        </div>
      </header>

      <div className="overview">
        <Stat num={all.length} label="任务总数" />
        <Stat num={done.length} label="已完成" />
        <Stat num={active.length} label="活跃" />
        <Stat num={overdue.length} label="逾期" danger={overdue.length > 0} />
        <Stat num={`${rate}%`} label="完成率" />
      </div>

      <div className="panel stats-chart">
        <div className="bf-col-title">近 7 天每日完成（{done7} 项）</div>
        <div className="bars">
          {perDay.map((n, i) => {
            const d = new Date(last7[i]);
            return (
              <div key={i} className="bar-col">
                <div className="bar-wrap">
                  <div className="bar" style={{ height: `${(n / maxPerDay) * 100}%` }} title={`${n} 项`}>
                    {n > 0 && <span className="bar-num">{n}</span>}
                  </div>
                </div>
                <div className="bar-label">
                  {d.getMonth() + 1}/{d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          近 30 天共完成 <b>{done30}</b> 项
        </div>
      </div>
    </div>
  );
}
