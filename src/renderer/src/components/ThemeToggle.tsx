import { useStore } from '../store/useStore';

export default function ThemeToggle() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const label =
    theme === 'light' ? '🌙 深色' : theme === 'dark' ? '🖥️ 跟随系统' : '☀️ 浅色';
  return (
    <button className="btn" onClick={toggleTheme} title={`当前：${theme}`}>
      {label}
    </button>
  );
}
