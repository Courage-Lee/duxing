import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Goal, PlanStage, StageKind } from '../../../shared/types';
import { toDateInput, fromDateInput } from '../utils';
import { Icon } from './icons';

function progressOf(g: Goal): number {
  if (!g.stages.length) return 0;
  const total = g.stages.reduce((s, x) => s + (x.weight || 1), 0);
  const done = g.stages.filter((x) => x.done).reduce((s, x) => s + (x.weight || 1), 0);
  return total ? Math.round((done / total) * 100) : 0;
}

const KIND_LABEL: Record<StageKind, string> = { stage: '阶段', milestone: '里程碑', task: '任务' };

export default function GoalsView() {
  const goals = useStore((s) => s.goals);
  const selectedGoalId = useStore((s) => s.selectedGoalId);
  const selectGoal = useStore((s) => s.selectGoal);
  const createGoal = useStore((s) => s.createGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const addGoalStage = useStore((s) => s.addGoalStage);
  const updateGoalStage = useStore((s) => s.updateGoalStage);
  const deleteGoalStage = useStore((s) => s.deleteGoalStage);
  const planGoal = useStore((s) => s.planGoal);

  const [showNew, setShowNew] = useState(false);
  const [nt, setNt] = useState('');
  const [nd, setNd] = useState('');
  const [ntd, setNtd] = useState('');
  const [stageTitle, setStageTitle] = useState('');
  const [planning, setPlanning] = useState(false);
  const [planList, setPlanList] = useState<PlanStage[]>([]);
  const [planBrief, setPlanBrief] = useState('');
  const [busy, setBusy] = useState(false);

  const goal = goals.find((g) => g.id === selectedGoalId) || null;

  const submitNew = async () => {
    if (!nt.trim()) return;
    await createGoal({ title: nt.trim(), description: nd || undefined, target_date: fromDateInput(ntd) });
    setNt('');
    setNd('');
    setNtd('');
    setShowNew(false);
  };

  const onPlan = async () => {
    if (!goal) return;
    setPlanning(true);
    setBusy(true);
    try {
      const stages = await planGoal(goal.title, goal.description, planBrief);
      setPlanList(stages);
    } finally {
      setBusy(false);
    }
  };

  const applyPlan = async () => {
    if (!goal) return;
    for (const s of planList) {
      const planned = s.offset_days ? Date.now() + s.offset_days * 86_400_000 : null;
      await addGoalStage(goal.id, { title: s.title, kind: s.kind, weight: s.weight, planned_end_at: planned });
    }
    setPlanList([]);
    setPlanning(false);
    setPlanBrief('');
  };

  const cancelPlan = () => {
    setPlanning(false);
    setPlanList([]);
    setPlanBrief('');
  };

  const addManualStage = async () => {
    if (!goal || !stageTitle.trim()) return;
    await addGoalStage(goal.id, { title: stageTitle.trim(), kind: 'task', weight: 1 });
    setStageTitle('');
  };

  return (
    <div className="goals">
      <header className="bf-head">
        <div>
          <h2><Icon name="goals" size={18} className="h-ico" />目标路线图</h2>
          <div className="muted">把长期目标拆成阶段与执行任务，按权重计算进度；可让 AI 帮你规划。</div>
        </div>
        <div className="topbar-actions">
          <button className="btn primary" onClick={() => setShowNew((v) => !v)}>
            ＋ 新建目标
          </button>
        </div>
      </header>

      <div className="goals-body">
        <aside className="goals-list panel">
          {showNew && (
            <div className="goal-new">
              <input value={nt} onChange={(e) => setNt(e.target.value)} placeholder="目标标题，如：备考雅思" autoFocus />
              <textarea value={nd} onChange={(e) => setNd(e.target.value)} rows={2} placeholder="补充说明（可选）" />
              <label>目标日期</label>
              <input type="date" value={ntd} onChange={(e) => setNtd(e.target.value)} />
              <div className="modal-actions">
                <button className="btn" onClick={() => setShowNew(false)}>取消</button>
                <button className="btn primary" onClick={submitNew}>创建</button>
              </div>
            </div>
          )}
          {goals.length === 0 && !showNew && <div className="muted bf-empty">还没有目标，点「新建目标」开始。</div>}
          {goals.map((g) => {
            const p = progressOf(g);
            return (
              <div
                key={g.id}
                className={`goal-item${g.id === selectedGoalId ? ' active' : ''}`}
                onClick={() => selectGoal(g.id)}
              >
                <div className="goal-item-title">{g.title}</div>
                <div className="goal-item-meta">
                  <span className={`goal-status s-${g.status}`}>
                    {g.status === 'done' ? '已完成' : g.status === 'archived' ? '已归档' : '进行中'}
                  </span>
                  <span>{p}%</span>
                </div>
                <div className="goal-mini">
                  <div className="goal-mini-fill" style={{ width: `${p}%` }} />
                </div>
              </div>
            );
          })}
        </aside>

        <section className="goals-detail panel">
          {!goal && <div className="muted bf-empty" style={{ margin: 'auto' }}>选择一个目标查看路线图</div>}
          {goal && (
            <>
              <div className="goal-detail-head">
                <div>
                  <input
                    className="goal-title-edit"
                    value={goal.title}
                    onChange={(e) => updateGoal(goal.id, { title: e.target.value })}
                  />
                  <div className="goal-detail-meta">
                    <label>目标日期</label>
                    <input
                      type="date"
                      value={toDateInput(goal.target_date)}
                      onChange={(e) => updateGoal(goal.id, { target_date: fromDateInput(e.target.value) })}
                    />
                    <label>状态</label>
                    <select
                      value={goal.status}
                      onChange={(e) => updateGoal(goal.id, { status: e.target.value as Goal['status'] })}
                    >
                      <option value="active">进行中</option>
                      <option value="done">已完成</option>
                      <option value="archived">已归档</option>
                    </select>
                  </div>
                </div>
                <button className="icon-btn danger" onClick={() => deleteGoal(goal.id)}>删除目标</button>
              </div>

              <div className="goal-progress">
                <div className="goal-progress-bar">
                  <div className="goal-progress-fill" style={{ width: `${progressOf(goal)}%` }} />
                </div>
                <span>{progressOf(goal)}%</span>
              </div>

              {planning ? (
                <div className="goal-plan">
                  <div className="bf-col-title">AI 规划预览（勾选要加入的阶段）</div>
                  {planList.length === 0 && <div className="muted">{busy ? '规划中…' : '没有可生成的阶段，换种描述试试。'}</div>}
                  {planList.map((s, i) => (
                    <div key={i} className="plan-row">
                      <span className={`tag p${s.kind === 'milestone' ? 1 : 2}`}>{KIND_LABEL[s.kind]}</span>
                      <span className="plan-title">{s.title}</span>
                      <span className="muted">权重 {s.weight} · 约 {s.offset_days} 天后</span>
                    </div>
                  ))}
                  <div className="modal-actions">
                    <button className="btn" onClick={cancelPlan}>取消</button>
                    <button className="btn primary" onClick={applyPlan} disabled={planList.length === 0}>加入这些阶段</button>
                  </div>
                </div>
              ) : (
                <div className="goal-plan-input">
                  <textarea
                    value={planBrief}
                    onChange={(e) => setPlanBrief(e.target.value)}
                    rows={3}
                    placeholder="补充说明你的思路，让 AI 更贴合实际，例如：分 4 个阶段、前两月打基础、每周一个里程碑、侧重技术学习……（留空则按目标标题默认规划）"
                  />
                  <button className="btn" onClick={onPlan} disabled={busy}>✨ 让 AI 帮我规划</button>
                </div>
              )}

              <div className="goal-stages">
                {goal.stages.length === 0 && <div className="muted bf-empty">还没有阶段，添加或让 AI 规划。</div>}
                {goal.stages
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((st) => (
                    <div key={st.id} className={`stage-row${st.done ? ' done' : ''}`}>
                      <input
                        type="checkbox"
                        checked={st.done}
                        onChange={(e) => updateGoalStage(st.id, { done: e.target.checked })}
                      />
                      <input
                        className="stage-title-edit"
                        value={st.title}
                        onChange={(e) => updateGoalStage(st.id, { title: e.target.value })}
                      />
                      <select
                        value={st.kind}
                        onChange={(e) => updateGoalStage(st.id, { kind: e.target.value as StageKind })}
                      >
                        <option value="stage">阶段</option>
                        <option value="milestone">里程碑</option>
                        <option value="task">任务</option>
                      </select>
                      <input
                        type="date"
                        className="stage-date"
                        value={toDateInput(st.planned_end_at)}
                        onChange={(e) => updateGoalStage(st.id, { planned_end_at: fromDateInput(e.target.value) })}
                      />
                      <input
                        type="number"
                        className="stage-weight"
                        min={1}
                        max={3}
                        value={st.weight}
                        title="权重"
                        onChange={(e) => updateGoalStage(st.id, { weight: Math.max(1, Math.min(3, Number(e.target.value) || 1)) })}
                      />
                      <button className="icon-btn danger" onClick={() => deleteGoalStage(st.id)}>×</button>
                    </div>
                  ))}
              </div>

              <div className="stage-add">
                <input
                  value={stageTitle}
                  onChange={(e) => setStageTitle(e.target.value)}
                  placeholder="添加阶段 / 执行任务，回车确认"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualStage(); } }}
                />
                <button className="btn" onClick={addManualStage}>＋ 添加</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
