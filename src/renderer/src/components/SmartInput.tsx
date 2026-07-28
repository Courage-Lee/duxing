import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';

interface Cmd {
  key: 'todo' | 'note' | 'query';
  icon: string;
  label: string;
  desc: string;
}

const COMMANDS: Cmd[] = [
  { key: 'todo', icon: '📌', label: '创建待办', desc: '新建一条待办事项' },
  { key: 'note', icon: '📝', label: '记录知识', desc: '保存到知识库' },
  { key: 'query', icon: '❓', label: '提问', desc: '向知识库提问' },
];

function readImageFiles(files: FileList | null): Promise<string[]> {
  return new Promise((resolve) => {
    const items = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (items.length === 0) {
      resolve([]);
      return;
    }
    const result: string[] = [];
    let done = 0;
    for (const file of items) {
      const reader = new FileReader();
      reader.onload = (e) => {
        result.push(String(e.target?.result || ''));
        done++;
        if (done === items.length) resolve(result);
      };
      reader.onerror = () => {
        done++;
        if (done === items.length) resolve(result);
      };
      reader.readAsDataURL(file);
    }
  });
}

export default function SmartInput() {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [forced, setForced] = useState<'todo' | 'note' | 'query' | null>(null);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const smartToast = useStore((s) => s.smartToast);
  const smartLoading = useStore((s) => s.smartLoading);
  const runSmart = useStore((s) => s.runSmart);
  const createTask = useStore((s) => s.createTask);
  const setView = useStore((s) => s.setView);
  const selectNote = useStore((s) => s.selectNote);
  const clearSmartToast = useStore((s) => s.clearSmartToast);

  // 文本框自适应高度
  useEffect(() => {
    const ta = taRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [text]);

  // 结果提示自动消失
  useEffect(() => {
    if (!smartToast) return;
    const t = setTimeout(() => clearSmartToast(), 7000);
    return () => clearTimeout(t);
  }, [smartToast, clearSmartToast]);

  const filtered = slashQuery
    ? COMMANDS.filter((c) => c.label.includes(slashQuery) || c.key.includes(slashQuery))
    : COMMANDS;

  const onTextChange = (v: string) => {
    setText(v);
    if (v.startsWith('/')) {
      setSlashOpen(true);
      setSlashQuery(v.slice(1));
      setSlashIndex(0);
    } else {
      setSlashOpen(false);
    }
  };

  const selectCommand = (cmd: Cmd) => {
    setForced(cmd.key);
    setText('');
    setSlashOpen(false);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const submit = async () => {
    if ((!text.trim() && images.length === 0) || smartLoading) return;
    await runSmart(text, images, forced ?? undefined);
    setText('');
    setImages([]);
    setForced(null);
  };

  const quickAdd = async () => {
    if (!text.trim() && images.length === 0) return;
    await createTask(
      { title: text.slice(0, 200) || '图片待办', priority: 2, images: images.length ? images : undefined },
      'manual'
    );
    setText('');
    setImages([]);
  };

  const handleFiles = async (files: FileList | null) => {
    const urls = await readImageFiles(files);
    if (urls.length) setImages((prev) => [...prev, ...urls]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files: File[] = [];
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(f);
      handleFiles(dt.files);
    }
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen && filtered.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectCommand(filtered[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashOpen(false);
        setText('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const forcedLabel = forced === 'todo' ? '添加待办' : forced === 'note' ? '保存笔记' : forced === 'query' ? '提问' : '智能识别';
  const placeholder = forced
    ? `（${forced === 'todo' ? '待办' : forced === 'note' ? '知识' : '提问'}模式）输入内容…  支持图片`
    : '输入待办、记录知识，或向知识库提问…（输入 / 唤起快捷指令，可粘贴/上传图片）';

  return (
    <div className="smartinput">
      {forced && (
        <div className="forced-chip">
          <span>
            {forced === 'todo' ? '📌' : forced === 'note' ? '📝' : '❓'} {forced === 'todo' ? '待办' : forced === 'note' ? '知识' : '提问'}模式
          </span>
          <button className="forced-clear" onClick={() => setForced(null)} title="取消指定类型">
            ×
          </button>
        </div>
      )}

      <div className="smartinput-bar">
        {slashOpen && filtered.length > 0 && (
          <div className="slash-menu">
            {filtered.map((c, i) => (
              <div
                key={c.key}
                className={i === slashIndex ? 'slash-item active' : 'slash-item'}
                onMouseEnter={() => setSlashIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCommand(c);
                }}
              >
                <span className="slash-icon">{c.icon}</span>
                <span className="slash-text">
                  <b>{c.label}</b>
                  <span className="slash-desc">{c.desc}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={taRef}
          className="smart-textarea"
          value={text}
          placeholder={placeholder}
          rows={2}
          onChange={(e) => onTextChange(e.target.value)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
        />
        <button
          className="icon-btn attach"
          title="添加图片"
          onClick={() => fileRef.current?.click()}
          disabled={smartLoading}
        >
          🖼️
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button className="btn primary" onClick={submit} disabled={smartLoading}>
          {smartLoading ? '处理中…' : forcedLabel}
        </button>
        <button className="btn" onClick={quickAdd} disabled={smartLoading}>
          快速待办
        </button>
      </div>

      {images.length > 0 && (
        <div className="image-thumbs">
          {images.map((url, i) => (
            <div key={i} className="thumb">
              <img src={url} alt="" />
              <button className="thumb-remove" onClick={() => removeImage(i)} title="移除">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {smartToast && (
        <div className={`smart-toast ${smartToast.kind}`}>
          <div className="toast-main">
            <span>{smartToast.text}</span>
            <button className="toast-close" onClick={clearSmartToast}>
              ×
            </button>
          </div>
          {smartToast.answers?.map((a, i) => (
            <div key={i} className="toast-answer">
              <div className="toast-q">问：{a.question}</div>
              <div className="toast-a">{a.answer}</div>
              {a.sources && a.sources.length > 0 && (
                <div className="toast-sources">
                  来源：
                  {a.sources.map((s) => (
                    <span
                      key={s.id}
                      className="tag link"
                      onClick={() => {
                        selectNote(s.id);
                        setView('kb');
                      }}
                    >
                      {s.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
