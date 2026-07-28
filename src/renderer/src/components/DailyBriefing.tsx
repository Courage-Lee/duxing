import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { PRIORITY, fmt } from '../utils';
import { Task } from '../../../shared/types';
import { Icon } from './icons';

function Stat({ num, label, danger }: { num: number; label: string; danger?: boolean }) {
  return (
    <div className={`ov-card${danger ? ' danger' : ''}`}>
      <div className="ov-num">{num}</div>
      <div className="ov-label">{label}</div>
    </div>
  );
}

function TaskRow({ t, onToggle }: { t: Task; onToggle: (t: Task) => void }) {
  const done = t.status === 'done';
  return (
    <div className="bf-row">
      <button
        className={`bf-check${done ? ' done' : ''}`}
        onClick={() => onToggle(t)}
        title={done ? '标记为未完成' : '标记完成'}
      >
        {done ? '✓' : ''}
      </button>
      <div className="bf-row-body">
        <div className={`bf-row-title${done ? ' strike' : ''}`}>{t.title}</div>
        <div className="card-meta">
          <span className={`tag p${t.priority}`}>{PRIORITY[t.priority].label}</span>
          {t.category && <span className="tag">{t.category}</span>}
          {t.due_time && <span className={t.due_time < Date.now() ? 'due overdue' : ''}>⏰ {fmt(t.due_time)}</span>}
          {t.remind_at && <span>🔔 {fmt(t.remind_at)}</span>}
        </div>
      </div>
    </div>
  );
}

export default function DailyBriefing() {
  const briefing = useStore((s) => s.briefing);
  const briefingText = useStore((s) => s.briefingText);
  const briefingLoading = useStore((s) => s.briefingLoading);
  const settings = useStore((s) => s.settings);
  const loadBriefing = useStore((s) => s.loadBriefing);
  const generateBriefing = useStore((s) => s.generateBriefing);
  const updateTask = useStore((s) => s.updateTask);
  const setView = useStore((s) => s.setView);
  const rescheduleOverdue = useStore((s) => s.rescheduleOverdue);
  const toggleDone = useStore((s) => s.toggleDone);

  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadBriefing();
    // 首次进入且已配置 AI：自动生成一次简报
    if (settings.apiKey && !settings.localOnly && !briefingText) {
      generateBriefing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (t: Task) => {
    await toggleDone(t);
    await loadBriefing();
  };

  const onReschedule = async () => {
    const moved = await rescheduleOverdue();
    setMsg(moved > 0 ? `已将 ${moved} 项逾期任务顺延到今天/明天` : '当前没有逾期任务');
    await loadBriefing();
    setTimeout(() => setMsg(''), 3000);
  };

  const overdue = briefing?.overdue ?? [];
  const dueToday = briefing?.dueToday ?? [];
  const dueWeek = briefing?.dueThisWeek ?? [];
  const reminders = briefing?.remindersToday ?? [];

  return (
    <div className="bf">
      <header className="bf-head">
        <div>
          <h2><Icon name="briefing" size={18} className="h-ico" />每日简报</h2>
          <div className="muted">{briefing?.date} · 用一分钟看清今天</div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => loadBriefing()}>
            刷新
          </button>
          {overdue.length > 0 && (
            <button className="btn" onClick={onReschedule} title="把逾期任务顺延到今天/明天">
              ⏩ 顺延逾期
            </button>
          )}
          <button className="btn primary" onClick={() => generateBriefing()} disabled={briefingLoading}>
            {briefingLoading ? '生成中…' : briefingText ? '重新生成' : '生成 AI 简报'}
          </button>
        </div>
      </header>
      {msg && <div className="msg">{msg}</div>}

      <div className="overview">
        <Stat num={briefing?.totalActive ?? 0} label="待办总数" />
        <Stat num={dueToday.length} label="今日截止" />
        <Stat num={briefing?.highPriorityToday ?? 0} label="高优先级" danger={!!briefing?.highPriorityToday} />
        <Stat num={overdue.length} label="已逾期" danger={overdue.length > 0} />
        <Stat num={dueWeek.length} label="未来7天" />
        <Stat num={briefing?.completedToday ?? 0} label="今日完成" />
      </div>

      {briefingText && (
        <div className="bf-ai panel">
          <div className="bf-ai-head">
            <span>✨ {briefingText.usedAI ? 'AI 生成的今日简报' : '今日简报（本地生成）'}</span>
          </div>
          <div className="bf-ai-text">{briefingText.text}</div>
        </div>
      )}

      <div className="bf-cols">
        <section className="bf-col panel">
          <div className="bf-col-title danger">⚠️ 已逾期（{overdue.length}）</div>
          {overdue.length === 0 && <div className="muted bf-empty">没有逾期任务，很好 🎉</div>}
          {overdue.map((t) => (
            <TaskRow key={t.id} t={t} onToggle={toggle} />
          ))}
        </section>

        <section className="bf-col panel">
          <div className="bf-col-title">🎯 今日待办（{dueToday.length}）</div>
          {dueToday.length === 0 && <div className="muted bf-empty">今天没有硬性截止的任务</div>}
          {dueToday.map((t) => (
            <TaskRow key={t.id} t={t} onToggle={toggle} />
          ))}
        </section>

        <section className="bf-col panel">
          <div className="bf-col-title">🔔 今日提醒（{reminders.length}）</div>
          {reminders.length === 0 && <div className="muted bf-empty">今天没有设置提醒</div>}
          {reminders.map((t) => (
            <TaskRow key={t.id} t={t} onToggle={toggle} />
          ))}
          {reminders.length > 0 && dueWeek.length > 0 && (
            <>
              <div className="bf-col-title" style={{ marginTop: 8 }}>
                🗓️ 未来 7 天（{dueWeek.length}）
              </div>
              {dueWeek.map((t) => (
                <TaskRow key={t.id} t={t} onToggle={toggle} />
              ))}
            </>
          )}
        </section>
      </div>

      <div className="muted" style={{ fontSize: 12 }}>
        点击左侧复选框可标记完成；点击标题在待办页查看与编辑 →{' '}
        <button className="link-btn" onClick={() => setView('todo')}>
          前往待办
        </button>
      </div>
    </div>
  );
}
