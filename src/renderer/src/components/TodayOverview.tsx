import { useStore } from '../store/useStore';
import { isToday, isOverdue } from '../utils';

export default function TodayOverview() {
  const tasks = useStore((s) => s.tasks);
  const recommendations = useStore((s) => s.recommendations);

  const todo = tasks.filter((t) => t.status === 'todo');
  const todayCount = todo.filter((t) => isToday(t.due_time)).length;
  const overdue = todo.filter(isOverdue).length;

  return (
    <div className="overview">
      <div className="ov-card">
        <div className="ov-num">{todo.length}</div>
        <div className="ov-label">待办</div>
      </div>
      <div className="ov-card">
        <div className="ov-num">{todayCount}</div>
        <div className="ov-label">今日到期</div>
      </div>
      <div className="ov-card danger">
        <div className="ov-num">{overdue}</div>
        <div className="ov-label">已逾期</div>
      </div>
      <div className="ov-rec">
        <div className="ov-rec-title">AI 推荐执行顺序</div>
        <ol className="ov-rec-list">
          {recommendations.slice(0, 5).map((t) => (
            <li key={t.id}>{t.title}</li>
          ))}
          {recommendations.length === 0 && <li className="muted">暂无任务</li>}
        </ol>
      </div>
    </div>
  );
}
