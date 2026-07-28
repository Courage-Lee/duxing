/**
 * 渲染进程根组件：根据 store 中的 view 切换八大视图
 * （待办 / 知识库 / 简报 / 日历 / 统计 / 四象限 / 目标 / 记忆），
 * 并挂载智能输入框、任务编辑器、设置面板与完成庆祝动画。
 */

import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import Sidebar from './components/Sidebar';
import TodayOverview from './components/TodayOverview';
import TaskList from './components/TaskList';
import TaskEditor from './components/TaskEditor';
import Settings from './components/Settings';
import ThemeToggle from './components/ThemeToggle';
import KnowledgePage from './components/KnowledgePage';
import DailyBriefing from './components/DailyBriefing';
import SmartInput from './components/SmartInput';
import TodoToolbar from './components/TodoToolbar';
import CalendarView from './components/CalendarView';
import StatsView from './components/StatsView';
import QuadrantView from './components/QuadrantView';
import GoalsView from './components/GoalsView';
import MemoryView from './components/MemoryView';
import Celebration from './components/Celebration';

export default function App() {
  const init = useStore((s) => s.init);
  const view = useStore((s) => s.view);
  const editorOpen = useStore((s) => s.editorOpen);
  const editorTask = useStore((s) => s.editorTask);
  const loadGoals = useStore((s) => s.loadGoals);
  const loadMemories = useStore((s) => s.loadMemories);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    init();
    loadGoals();
    loadMemories();
  }, [init, loadGoals, loadMemories]);

  return (
    <div className="app-grid">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="main">
        {view === 'todo' ? (
          <>
            <header className="topbar">
              <TodayOverview />
              <div className="topbar-actions">
                <ThemeToggle />
                <button className="btn" onClick={() => setSettingsOpen(true)}>
                  设置
                </button>
              </div>
            </header>
            <TodoToolbar />
            <TaskList />
          </>
        ) : view === 'calendar' ? (
          <CalendarView />
        ) : view === 'stats' ? (
          <StatsView />
        ) : view === 'briefing' ? (
          <DailyBriefing />
        ) : view === 'quadrant' ? (
          <QuadrantView />
        ) : view === 'goals' ? (
          <GoalsView />
        ) : view === 'memory' ? (
          <MemoryView />
        ) : (
          <KnowledgePage />
        )}
        {(view === 'todo' || view === 'briefing') && <SmartInput />}
        {editorOpen && <TaskEditor key={editorTask?.id ?? 'new'} />}
        {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
        <Celebration />
      </main>
    </div>
  );
}
