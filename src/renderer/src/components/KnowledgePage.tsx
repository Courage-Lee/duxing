import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Note } from '../../../shared/types';
import { fmt } from '../utils';

function ImageStrip({ images }: { images?: string[] }) {
  if (!images?.length) return null;
  return (
    <div className="image-thumbs small">
      {images.map((url, i) => (
        <div key={i} className="thumb">
          <img src={url} alt="" />
        </div>
      ))}
    </div>
  );
}

export default function KnowledgePage() {
  const notes = useStore((s) => s.notes);
  const loadNotes = useStore((s) => s.loadNotes);
  const createNote = useStore((s) => s.createNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const kbSelectedId = useStore((s) => s.kbSelectedId);
  const selectNote = useStore((s) => s.selectNote);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [leftWidth, setLeftWidth] = useState(() => Number(localStorage.getItem('kbLeftWidth')) || 300);

  const kbRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const widthRef = useRef(leftWidth);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    widthRef.current = leftWidth;
  }, [leftWidth]);

  const onSplitterDown = (e: React.MouseEvent) => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !kbRef.current) return;
      const rect = kbRef.current.getBoundingClientRect();
      let w = e.clientX - rect.left;
      w = Math.min(Math.max(w, 200), rect.width - 300);
      setLeftWidth(w);
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        localStorage.setItem('kbLeftWidth', String(widthRef.current));
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const selected: Note | null = notes.find((n) => n.id === kbSelectedId) || null;

  const choose = (n: Note) => {
    selectNote(n.id);
    setEditing(false);
  };

  const openNew = () => {
    selectNote(null);
    setDraft({ title: '', content: '' });
    setEditing(true);
  };

  const startEdit = () => {
    if (!selected) return;
    setDraft({ title: selected.title, content: selected.content });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!draft.title.trim()) return;
    if (selected) {
      await updateNote(selected.id, { title: draft.title, content: draft.content });
    } else {
      const n = await createNote(draft.title, draft.content);
      selectNote(n.id);
    }
    setEditing(false);
  };

  const removeNote = async () => {
    if (!selected) return;
    if (!window.confirm('确定删除这条笔记？')) return;
    await deleteNote(selected.id);
    selectNote(null);
  };

  return (
    <div className="kb" ref={kbRef}>
      <div className="kb-notes" style={{ width: leftWidth, flex: 'none' }}>
        <div className="kb-notes-head">
          <span>笔记</span>
          <button className="btn" onClick={openNew}>
            ＋ 新建
          </button>
        </div>
        <div className="kb-notes-list">
          {notes.length === 0 && (
            <div className="muted" style={{ padding: 12 }}>
              还没有笔记，用底部输入框说「记一下…」即可自动保存
            </div>
          )}
          {notes.map((n) => (
            <div
              key={n.id}
              className={n.id === kbSelectedId ? 'kb-note-item active' : 'kb-note-item'}
              onClick={() => choose(n)}
            >
              <div className="kb-note-title">{n.title}</div>
              <div className="kb-note-meta">
                {fmt(n.updated_at ?? n.created_at)}
                {n.images && n.images.length > 0 && <span className="tag">🖼️ {n.images.length}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="kb-splitter" onMouseDown={onSplitterDown} title="拖动调整宽度" />

      <div className="kb-detail">
        {!selected && !editing && (
          <div className="kb-detail-empty muted">从左侧选择一条笔记查看详情，或点击「＋ 新建」</div>
        )}

        {(selected || editing) && (
          <div className="kb-detail-inner">
            {editing ? (
              <>
                <label>标题</label>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="一句话概括"
                  autoFocus
                />
                <label>内容</label>
                <textarea
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  rows={14}
                  placeholder="记录任何内容…"
                />
                <div className="modal-actions">
                  <button className="btn" onClick={cancelEdit}>
                    取消
                  </button>
                  <button className="btn primary" onClick={saveEdit}>
                    保存
                  </button>
                </div>
              </>
            ) : (
              selected && (
                <>
                  <div className="kb-detail-head">
                    <h2>{selected.title}</h2>
                    <div className="kb-detail-meta muted">
                      {fmt(selected.updated_at ?? selected.created_at)}
                      {selected.images && selected.images.length > 0 && ` · 🖼️ ${selected.images.length}`}
                    </div>
                  </div>
                  {selected.images && selected.images.length > 0 && <ImageStrip images={selected.images} />}
                  <div className="kb-detail-content">
                    {selected.content || '（无内容）'}
                  </div>
                  <div className="kb-detail-actions">
                    <button className="btn" onClick={startEdit}>
                      修改
                    </button>
                    <button className="btn danger" onClick={removeNote}>
                      删除
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
