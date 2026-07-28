import { useStore } from '../store/useStore';
import { isToday } from '../utils';
import { Icon } from './icons';

export default function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

  const todo = tasks.filter((t) => t.status === 'todo');
  const allCount = todo.length;
  const todayCount = todo.filter((t) => isToday(t.due_time)).length;
  const categories = Array.from(new Set(todo.map((t) => t.category).filter(Boolean))) as string[];

  return (
    <aside className="sidebar">
      <div className="brand">
        <Icon name="logo" size={22} className="brand-logo" />
        <span>笃行</span>
      </div>

      <button
        className={view === 'home' ? 'nav-item active' : 'nav-item'}
        onClick={() => setView('home')}
      >
        <Icon name="home" />
        <span>首页</span>
      </button>
      <button
        className={view === 'todo' ? 'nav-item active' : 'nav-item'}
        onClick={() => setView('todo')}
      >
        <Icon name="todo" />
        <span>待办</span>
      </button>
      <button
        className={view === 'kb' ? 'nav-item active' : 'nav-item'}
        onClick={() => setView('kb')}
      >
        <Icon name="kb" />
        <span>知识库</span>
      </button>
      <button
        className={view === 'briefing' ? 'nav-item active' : 'nav-item'}
        onClick={() => setView('briefing')}
      >
        <Icon name="briefing" />
        <span>每日简报</span>
      </button>
      <button
        className={view === 'calendar' ? 'nav-item active' : 'nav-item'}
        onClick={() => setView('calendar')}
      >
        <Icon name="calendar" />
        <span>日历</span>
      </button>
      <button
        className={view === 'stats' ? 'nav-item active' : 'nav-item'}
        onClick={() => setView('stats')}
      >
        <Icon name="stats" />
        <span>统计</span>
      </button>
      <button
        className={view === 'quadrant' ? 'nav-item active' : 'nav-item'}
        onClick={() => setView('quadrant')}
      >
        <Icon name="quadrant" />
        <span>四象限</span>
      </button>
      <button
        className={view === 'goals' ? 'nav-item active' : 'nav-item'}
        onClick={() => setView('goals')}
      >
        <Icon name="goals" />
        <span>目标</span>
      </button>
      <button
        className={view === 'memory' ? 'nav-item active' : 'nav-item'}
        onClick={() => setView('memory')}
      >
        <Icon name="memory" />
        <span>记忆</span>
      </button>

      {view === 'todo' && (
        <>
          <button
            className={filter === 'all' ? 'nav-item active' : 'nav-item'}
            onClick={() => setFilter('all')}
          >
            <span>全部</span>
            <span className="nav-count">{allCount}</span>
          </button>
          <button
            className={filter === 'today' ? 'nav-item active' : 'nav-item'}
            onClick={() => setFilter('today')}
          >
            <span>今日</span>
            <span className="nav-count">{todayCount}</span>
          </button>
          <div className="nav-sep">分类</div>
          {categories.map((c) => (
            <button
              key={c}
              className={filter === c ? 'nav-item active' : 'nav-item'}
              onClick={() => setFilter(c)}
            >
              <span>{c}</span>
            </button>
          ))}
        </>
      )}

      <button className="btn nav-settings" onClick={onOpenSettings}>
        <Icon name="settings" />
        <span>设置</span>
      </button>
    </aside>
  );
}
