import React from 'react';

/**
 * 统一线性图标体系（基于 Feather 设计语言：24×24 网格、圆角线帽/连接、统一描边）。
 * 使用 currentColor，自动跟随文字颜色（active 态高亮）。
 */
export type IconName =
  | 'logo'
  | 'todo'
  | 'kb'
  | 'briefing'
  | 'calendar'
  | 'stats'
  | 'quadrant'
  | 'goals'
  | 'memory'
  | 'settings';

const PATHS: Record<IconName, React.ReactNode> = {
  // 品牌标记：环 + 对勾（与应用图标同源）
  logo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5" />
    </>
  ),
  // 待办：勾选方框
  todo: (
    <>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      <polyline points="9 11 12 14 22 4" />
    </>
  ),
  // 知识库：翻开的书
  kb: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  // 每日简报：朝阳（清晨）
  briefing: (
    <>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1.5" x2="12" y2="3.5" />
      <line x1="12" y1="20.5" x2="12" y2="22.5" />
      <line x1="4.2" y1="4.2" x2="5.6" y2="5.6" />
      <line x1="18.4" y1="18.4" x2="19.8" y2="19.8" />
      <line x1="1.5" y1="12" x2="3.5" y2="12" />
      <line x1="20.5" y1="12" x2="22.5" y2="12" />
      <line x1="4.2" y1="19.8" x2="5.6" y2="18.4" />
      <line x1="18.4" y1="5.6" x2="19.8" y2="4.2" />
    </>
  ),
  // 日历
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2.5" ry="2.5" />
      <line x1="16" y1="2.5" x2="16" y2="6.5" />
      <line x1="8" y1="2.5" x2="8" y2="6.5" />
      <line x1="3" y1="10.5" x2="21" y2="10.5" />
    </>
  ),
  // 统计：柱状图
  stats: (
    <>
      <line x1="18" y1="20" x2="18" y2="11" />
      <line x1="12" y1="20" x2="12" y2="4.5" />
      <line x1="6" y1="20" x2="6" y2="14.5" />
    </>
  ),
  // 四象限：2×2 网格
  quadrant: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  // 目标：靶心
  goals: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="1.8" />
    </>
  ),
  // 记忆库：数据库
  memory: (
    <>
      <ellipse cx="12" cy="5.5" rx="8.5" ry="3" />
      <path d="M20.5 12c0 1.66-3.8 3-8.5 3s-8.5-1.34-8.5-3" />
      <path d="M3.5 5.5v13c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3v-13" />
    </>
  ),
  // 设置：滑块
  settings: (
    <>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1.5" y1="14" x2="6.5" y2="14" />
      <line x1="9.5" y1="8" x2="14.5" y2="8" />
      <line x1="17.5" y1="16" x2="22.5" y2="16" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
