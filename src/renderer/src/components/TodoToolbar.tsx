import { useStore } from '../store/useStore';
import { PRIORITY } from '../utils';

export default function TodoToolbar() {
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const priorityFilter = useStore((s) => s.priorityFilter);
  const setPriorityFilter = useStore((s) => s.setPriorityFilter);
  const showDone = useStore((s) => s.showDone);
  const setShowDone = useStore((s) => s.setShowDone);
  const openEditor = useStore((s) => s.openEditor);

  return (
    <div className="toolbar">
      <input
        className="toolbar-search"
        placeholder="🔍 搜索任务（标题/备注/标签）"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="toolbar-filters">
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 1 | 2 | 3))}
          title="优先级筛选"
        >
          <option value="all">全部优先级</option>
          <option value={1}>{PRIORITY[1].label}</option>
          <option value={2}>{PRIORITY[2].label}</option>
          <option value={3}>{PRIORITY[3].label}</option>
        </select>
        <label className="check" title="显示已完成">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          已完成
        </label>
        <button className="btn primary" onClick={() => openEditor()}>
          ＋ 新建
        </button>
      </div>
    </div>
  );
}
