import * as tasksDb from '../src/main/db/tasks';
import * as goalsDb from '../src/main/db/goals';
import * as memoriesDb from '../src/main/db/memories';
import * as notesDb from '../src/main/db/notes';

let failed = 0;
function assert(cond: any, msg: string) {
  if (cond) {
    console.log('  PASS  ' + msg);
  } else {
    console.error('  FAIL  ' + msg);
    failed++;
  }
}

// ---------- 0. 笔记：中文长词/子串召回 ----------
notesDb.createNote(
  '一表通表名中文校验任务分配表',
  '股东或关联方信息表：张三\n资产负债表：李四\n利润表：王五'
);
const noteHits = notesDb.searchNotes('一表通中股东或关联方信息表 谁负责的', 5);
assert(noteHits.length >= 1, '中文长词查询应召回包含子串的笔记');
assert(
  noteHits.some((h) => h.note.title === '一表通表名中文校验任务分配表'),
  '应召回「一表通表名中文校验任务分配表」'
);

// ---------- 1. 任务：重要程度 + 日历拖拽改期 ----------
const due = Date.now() + 86400000;
const t = tasksDb.createTask({ title: '上线发布 v1', priority: 1, importance: 1, due_time: due } as any, 'manual');
assert(t.importance === 1, 'createTask 持久化 importance=1');
const t2 = tasksDb.getTask(t.id);
assert(!!t2 && t2.importance === 1, 'getTask 返回 importance=1');
const moved = tasksDb.updateTask(t.id, { due_time: Date.now() + 2 * 86400000, priority: 2 });
assert(!!moved && moved.priority === 2 && typeof moved.due_time === 'number', 'updateTask 改期+改优先级（日历拖拽场景）');

// 四象限靠 priority x importance 划分，确认两者可独立写入
const q = tasksDb.createTask({ title: '随手回邮件', priority: 3, importance: 3 } as any, 'manual');
assert(q.priority === 3 && q.importance === 3, '低重要低紧急任务可写入（四象限 Q4）');

// ---------- 2. 目标：加权进度 + 自动完成 ----------
const g = goalsDb.createGoal({ title: 'Q3 OKR', target_date: Date.now() + 30 * 86400000 });
const s1 = goalsDb.addStage(g.id, { title: '设计', weight: 3 });
const s2 = goalsDb.addStage(g.id, { title: '开发', weight: 1 });
assert(goalsDb.goalProgress(g) === 0, '初始加权进度 = 0%');
goalsDb.updateStage(s1.id, { done: 1 } as any);
const g1 = goalsDb.getGoal(g.id)!;
assert(Math.abs(goalsDb.goalProgress(g1) - 75) < 0.01, 's1(权重3)完成 → 进度 75%');
assert(g1.status === 'active', '还差一个阶段，目标仍 active');
goalsDb.updateStage(s2.id, { done: 1 } as any);
const g2 = goalsDb.getGoal(g.id)!;
assert(g2.status === 'done', '全部阶段完成 → 目标自动 status=done');

// ---------- 3. 记忆：关键词检索 + 访问计数 ----------
const m1 = memoriesDb.createMemory({ content: '用户偏好深色主题', type: 'preference', source: 'conversation' } as any);
memoriesDb.createMemory({ content: '项目使用 electron + react', type: 'fact', source: 'note' } as any);
const res = memoriesDb.searchMemories('深色主题', 10);
assert(res.length >= 1 && res[0].id === m1.id, '关键词检索命中“深色主题”记忆');
const before = memoriesDb.getMemory(m1.id)!.access_count;
memoriesDb.searchMemories('深色主题', 1);
const after = memoriesDb.getMemory(m1.id)!.access_count;
assert(after === before + 1, 'searchMemories 命中后 bump access_count');

console.log('\n' + (failed === 0 ? 'ALL SMOKE TESTS PASSED' : failed + ' TEST(S) FAILED'));
process.exit(failed === 0 ? 0 : 1);
