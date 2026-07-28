import { useMemo } from 'react';
import { useStore } from '../store/useStore';

const PRAISE = [
  '太棒了，又搞定一件！',
  '保持节奏，稳！',
  '干得漂亮 💪',
  '离目标更近一步～',
  '优秀的执行力！',
  '这就是专注的力量 ✨',
  '一件一件来，靠谱！',
  '今天的你很高效 🔥',
];

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function Celebration() {
  const celebrate = useStore((s) => s.celebrate);
  const clear = useStore((s) => s.clearCelebrate);

  const pieces = useMemo(() => {
    if (!celebrate) return [];
    return Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      dur: 1.1 + Math.random() * 0.9,
      color: COLORS[i % COLORS.length],
      round: Math.random() > 0.5,
      size: 6 + Math.random() * 8,
    }));
  }, [celebrate]);

  if (!celebrate) return null;
  const msg = PRAISE[Math.floor(Math.random() * PRAISE.length)];

  return (
    <div className="celebrate" onClick={clear}>
      <div className="confetti-layer">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="confetti"
            style={{
              left: `${p.left}%`,
              background: p.color,
              width: p.size,
              height: p.size,
              borderRadius: p.round ? '50%' : 2,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          />
        ))}
      </div>
      <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-emoji">🎉</div>
        <div className="celebrate-title">完成！</div>
        <div className="celebrate-task">{celebrate.title}</div>
        <div className="celebrate-msg">{msg}</div>
        <button className="btn" onClick={clear}>
          好的
        </button>
      </div>
    </div>
  );
}
