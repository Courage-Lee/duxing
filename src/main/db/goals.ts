/**
 * 目标路线图（Goal + GoalStage）数据访问层：目标与阶段/里程碑/任务的增删改查、
 * 层级嵌套、加权进度计算，以及阶段全部完成时自动收尾目标。
 */

import db from './index';
import { Goal, GoalDraft, GoalStage, GoalStageDraft, StageKind } from '../../shared/types';

function rowToStage(r: any): GoalStage {
  return {
    id: r.id,
    title: r.title,
    kind: (r.kind as StageKind) || 'stage',
    planned_end_at: r.planned_end_at ?? null,
    weight: typeof r.weight === 'number' ? r.weight : Number(r.weight) || 1,
    done: !!r.done,
    sort_order: r.sort_order ?? 0,
    parent_id: r.parent_id ?? null,
  };
}

function loadStages(goalId: string): GoalStage[] {
  return (db.prepare('SELECT * FROM goal_stages WHERE goal_id=? ORDER BY sort_order ASC, id ASC').all(goalId) as any[]).map(rowToStage);
}

function rowToGoal(r: any): Goal {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    success_criteria: r.success_criteria ?? '',
    start_date: r.start_date ?? null,
    target_date: r.target_date ?? null,
    status: (r.status as Goal['status']) || 'active',
    created_at: r.created_at,
    updated_at: r.updated_at ?? null,
    stages: loadStages(r.id),
  };
}

export function listGoals(): Goal[] {
  const rows = db.prepare('SELECT * FROM goals ORDER BY created_at DESC').all() as any[];
  return rows.map(rowToGoal);
}

export function getGoal(id: string): Goal | null {
  const r = db.prepare('SELECT * FROM goals WHERE id=?').get(id) as any;
  return r ? rowToGoal(r) : null;
}

const uid = () => (globalThis as any).crypto.randomUUID();

export function createGoal(draft: GoalDraft): Goal {
  const now = Date.now();
  const id = uid();
  db.prepare(
    `INSERT INTO goals (id,title,description,success_criteria,start_date,target_date,status,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    draft.title,
    draft.description ?? '',
    draft.success_criteria ?? '',
    draft.start_date ?? null,
    draft.target_date ?? null,
    'active',
    now,
    now
  );
  if (draft.stages && draft.stages.length) {
    draft.stages.forEach((s, i) => addStage(id, s, i));
  }
  return getGoal(id)!;
}

export function updateGoal(
  id: string,
  patch: Partial<Pick<Goal, 'title' | 'description' | 'success_criteria' | 'start_date' | 'target_date' | 'status'>>
): Goal | null {
  const g = getGoal(id);
  if (!g) return null;
  const merged = { ...g, ...patch, updated_at: Date.now() };
  db.prepare(
    `UPDATE goals SET title=?,description=?,success_criteria=?,start_date=?,target_date=?,status=?,updated_at=? WHERE id=?`
  ).run(
    merged.title,
    merged.description ?? '',
    merged.success_criteria ?? '',
    merged.start_date ?? null,
    merged.target_date ?? null,
    merged.status,
    merged.updated_at,
    id
  );
  return getGoal(id);
}

export function deleteGoal(id: string): void {
  db.prepare('DELETE FROM goal_stages WHERE goal_id=?').run(id);
  db.prepare('DELETE FROM goals WHERE id=?').run(id);
}

export function addStage(goalId: string, draft: GoalStageDraft, sortOrder?: number): GoalStage {
  const id = uid();
  const order = sortOrder ?? (db.prepare('SELECT COUNT(*) c FROM goal_stages WHERE goal_id=?').get(goalId) as any).c;
  db.prepare(
    `INSERT INTO goal_stages (id,goal_id,title,kind,planned_end_at,weight,done,sort_order,parent_id)
     VALUES (?,?,?,?,?,?,0,?,?)`
  ).run(
    id,
    goalId,
    draft.title,
    draft.kind || 'stage',
    draft.planned_end_at ?? null,
    draft.weight ?? 1,
    order,
    draft.parent_id ?? null
  );
  return rowToStage(db.prepare('SELECT * FROM goal_stages WHERE id=?').get(id));
}

export function updateStage(
  stageId: string,
  patch: Partial<Pick<GoalStage, 'title' | 'kind' | 'planned_end_at' | 'weight' | 'done' | 'parent_id'>>
): void {
  const r = db.prepare('SELECT * FROM goal_stages WHERE id=?').get(stageId) as any;
  if (!r) return;
  const merged = { ...rowToStage(r), ...patch };
  db.prepare(
    `UPDATE goal_stages SET title=?,kind=?,planned_end_at=?,weight=?,done=?,parent_id=? WHERE id=?`
  ).run(
    merged.title,
    merged.kind,
    merged.planned_end_at ?? null,
    merged.weight,
    merged.done ? 1 : 0,
    merged.parent_id ?? null,
    stageId
  );
  // 阶段全部完成时，自动把目标标记为完成
  if (merged.done) {
    const goalId = r.goal_id;
    const stages = loadStages(goalId);
    if (stages.length > 0 && stages.every((s) => s.done)) {
      db.prepare(`UPDATE goals SET status='done', updated_at=? WHERE id=?`).run(Date.now(), goalId);
    }
  }
}

export function deleteStage(stageId: string): void {
  db.prepare('DELETE FROM goal_stages WHERE id=?').run(stageId);
}

/** 加权进度：已完成阶段权重之和 / 总权重 */
export function goalProgress(goal: Goal): number {
  if (!goal.stages.length) return 0;
  const total = goal.stages.reduce((s, x) => s + (x.weight || 1), 0);
  const done = goal.stages.filter((s) => s.done).reduce((s, x) => s + (x.weight || 1), 0);
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
