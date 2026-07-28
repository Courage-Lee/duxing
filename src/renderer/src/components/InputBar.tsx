import { useState } from 'react';
import { useStore } from '../store/useStore';
import { TaskDraft } from '../../../shared/types';

export default function InputBar() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const createTask = useStore((s) => s.createTask);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await window.api.parseTask(text);
      const draft: TaskDraft = {
        title: res.draft.title,
        priority: res.draft.priority,
        category: res.draft.category,
        due_time: res.draft.due_time,
        remind_at: res.draft.remind_at,
        notes: res.draft.notes || '',
      };
      await createTask(draft, 'nl');
      setText('');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = async () => {
    if (!text.trim()) return;
    await createTask({ title: text.slice(0, 200), priority: 2 }, 'manual');
    setText('');
  };

  return (
    <div className="inputbar">
      <input
        value={text}
        placeholder='说点什么，例如「明天下午3点给客户王总打电话，挺急的」'
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleParse();
          }
        }}
      />
      <button className="btn primary" onClick={handleParse} disabled={loading}>
        {loading ? '解析中…' : 'AI 解析'}
      </button>
      <button className="btn" onClick={handleQuickAdd} disabled={loading}>
        直接添加
      </button>
    </div>
  );
}
