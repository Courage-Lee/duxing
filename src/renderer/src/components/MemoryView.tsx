import { useState } from 'react';
import { useStore } from '../store/useStore';
import { MemoryType } from '../../../shared/types';
import { fmt } from '../utils';
import { Icon } from './icons';

const TYPE_LABEL: Record<MemoryType, string> = {
  fact: '事实',
  preference: '偏好',
  project: '项目',
  person: '人物',
  rule: '规则',
};

const SOURCE_LABEL: Record<string, string> = {
  note: '知识库',
  task: '待办',
  manual: '手动',
  conversation: '对话',
};

export default function MemoryView() {
  const memories = useStore((s) => s.memories);
  const searchMemories = useStore((s) => s.searchMemories);
  const deleteMemory = useStore((s) => s.deleteMemory);
  const extractMemories = useStore((s) => s.extractMemories);

  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const onSearch = (v: string) => {
    setQ(v);
    searchMemories(v);
  };

  const onExtract = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await extractMemories(text, 'manual');
      setText('');
      searchMemories(q);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="memory">
      <header className="bf-head">
        <div>
          <h2><Icon name="memory" size={18} className="h-ico" />AI 记忆库</h2>
          <div className="muted">自动沉淀你记录的知识与待办要点；记录在「知识库」时会自动提炼。支持关键词检索（语义检索在配置 embeddings 模型后自动启用）。</div>
        </div>
      </header>

      <div className="memory-extract panel">
        <div className="bf-col-title">提炼一段记忆</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="粘贴或输入一段内容，AI 会提炼出可长期记住的要点…"
        />
        <div className="modal-actions">
          <button className="btn primary" onClick={onExtract} disabled={busy || !text.trim()}>
            {busy ? '提炼中…' : '✨ 提炼为记忆'}
          </button>
        </div>
      </div>

      <div className="memory-search">
        <input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索记忆（关键词）…"
        />
      </div>

      <div className="memory-list">
        {memories.length === 0 && <div className="muted bf-empty">还没有记忆。在「知识库」记录笔记，或上方手动提炼。</div>}
        {memories.map((m) => (
          <div key={m.id} className="memory-item panel">
            <div className="memory-item-head">
              <span className={`tag p${m.importance}`}>{TYPE_LABEL[m.type]}</span>
              <span className="muted">{SOURCE_LABEL[m.source] || m.source}</span>
              <span className="muted">{fmt(m.created_at)}</span>
              <button className="icon-btn danger" onClick={() => deleteMemory(m.id)}>×</button>
            </div>
            <div className="memory-content">{m.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
