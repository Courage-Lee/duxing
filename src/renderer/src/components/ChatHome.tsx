import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store/useStore';
import type { ChatMessage, ChatMode } from '../store/useStore';
import { Note } from '../../../shared/types';

/** 对话式首页：ChatGPT 风格。顶部模块选择 + 底部输入框（支持 / 命令与图片），
 *  提问直接走知识库问答、待办/知识分别落库，统一以气泡呈现结果。 */

type Mode = ChatMode;

interface Cmd {
  key: Mode;
  label: string;
  desc: string;
}

const MODES: Cmd[] = [
  { key: 'chat', label: '对话', desc: '自由问答 / 多轮对话' },
  { key: 'auto', label: '智能', desc: '自动识别意图' },
  { key: 'todo', label: '待办', desc: '创建一条待办' },
  { key: 'note', label: '知识', desc: '保存到知识库' },
  { key: 'query', label: '提问', desc: '向知识库提问' },
];

const SUGGESTIONS: { text: string; mode: Mode }[] = [
  { text: '用通俗的话讲讲什么是「复利」', mode: 'chat' },
  { text: '帮我列一个周末大扫除的步骤清单', mode: 'chat' },
  { text: '明天上午 10 点前提交设计稿', mode: 'todo' },
  { text: '记一下：周报模板在团队共享盘', mode: 'note' },
  { text: '我之前记的服务器密码是什么？', mode: 'query' },
];

const uid = () => Math.random().toString(36).slice(2);

function readImageFiles(files: FileList | null): Promise<string[]> {
  return new Promise((resolve) => {
    const items = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (items.length === 0) return resolve([]);
    const result: string[] = [];
    let done = 0;
    for (const file of items) {
      const reader = new FileReader();
      reader.onload = (e) => {
        result.push(String(e.target?.result || ''));
        if (++done === items.length) resolve(result);
      };
      reader.onerror = () => {
        if (++done === items.length) resolve(result);
      };
      reader.readAsDataURL(file);
    }
  });
}

export default function ChatHome() {
  const messages = useStore((s) => s.chatMessages);
  const mode = useStore((s) => s.chatMode);
  const pushChatMessages = useStore((s) => s.pushChatMessages);
  const updateChatMessage = useStore((s) => s.updateChatMessage);
  const setMode = useStore((s) => s.setChatMode);
  const clearChat = useStore((s) => s.clearChat);
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const setView = useStore((s) => s.setView);
  const selectNote = useStore((s) => s.selectNote);
  const refresh = useStore((s) => s.refresh);
  const createTask = useStore((s) => s.createTask);
  const createNote = useStore((s) => s.createNote);

  useEffect(() => {
    const ta = taRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [text]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 仅在用户已靠近底部时才自动滚动到最新，避免正在翻阅历史时被顶下去
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const updateMsg = (id: string, patch: Partial<ChatMessage>) => updateChatMessage(id, patch);

  const slashFiltered = slashQuery
    ? MODES.filter((c) => c.label.includes(slashQuery) || c.key.includes(slashQuery))
    : MODES;

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

  const pickMode = (m: Mode) => {
    setMode(m);
    setText('');
    setSlashOpen(false);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const handleFiles = async (files: FileList | null) => {
    const urls = await readImageFiles(files);
    if (urls.length) setImages((prev) => [...prev, ...urls]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      handleFiles(dt.files);
    }
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen && slashFiltered.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashFiltered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashFiltered.length) % slashFiltered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMode(slashFiltered[slashIndex].key);
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
      send();
    }
  };

  const send = async () => {
    if ((!text.trim() && images.length === 0) || loading) return;
    const content = text.trim();
    const imgs = images.length ? images : undefined;
    const userMsg: ChatMessage = { id: uid(), role: 'user', text: content, images: imgs };
    const aId = uid();
    pushChatMessages([userMsg, { id: aId, role: 'assistant', text: '', pending: true }]);
    setText('');
    setImages([]);
    setSlashOpen(false);
    setLoading(true);

    const fail = (msg: string) => updateMsg(aId, { pending: false, error: true, text: msg });

    try {
      if (mode === 'chat') {
        // 混合问答：先查知识库，命中用笔记答（标来源）；未命中自动用 AI 通用知识兜底。
        // 历史一并传入，支持连续追问与指代消解。
        const history = messages
          .filter((m) => m.text && !m.pending)
          .map((m) => ({ role: m.role, content: m.text, images: m.images }));
        const r = await window.api.askHybrid(content, history, imgs);
        updateMsg(aId, { pending: false, text: r.answer, sources: r.sources, grounded: r.grounded });
      } else if (mode === 'query') {
        const r = await window.api.askNotes(content, imgs);
        updateMsg(aId, { pending: false, text: r.answer, sources: r.sources });
      } else if (mode === 'note') {
        const title = content.split(/[\n]/)[0].trim().slice(0, 30) || content.slice(0, 30);
        const n = await createNote(title, content, imgs);
        await refresh();
        updateMsg(aId, { pending: false, text: `已保存到知识库：《${n.title}》` });
      } else if (mode === 'todo') {
        const parsed = await window.api.parseTask(content);
        await createTask(parsed.draft, 'nl');
        await refresh();
        updateMsg(aId, { pending: false, text: `已创建待办：${parsed.draft.title}` });
      } else {
        // auto：统一识别待办/知识/提问
        const res = await window.api.smartProcess(content, imgs);
        const lines: string[] = [];
        let sources: Note[] = [];
        let grounded = true; // 只要有一个 query 走了 AI 兜底，就标为 false
        for (const it of res.intents) {
          if (it.type === 'todo') {
            await createTask(it.draft, 'nl');
            lines.push(`✅ 待办：${it.draft.title}`);
          } else if (it.type === 'note') {
            const n = await createNote(it.title, it.content, it.images);
            lines.push(`📝 笔记：${n.title}`);
          } else if (it.type === 'query') {
            lines.push(it.answer || '（无回答）');
            if (it.sources) sources = [...sources, ...it.sources];
            if (it.grounded === false) grounded = false;
          }
        }
        await refresh();
        updateMsg(aId, {
          pending: false,
          text: lines.length ? lines.join('\n') : '已处理',
          sources: sources.length ? sources : undefined,
          grounded,
        });
      }
    } catch (e) {
      fail('处理失败：' + (e instanceof Error ? e.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = (s: { text: string; mode: Mode }) => {
    setMode(s.mode);
    setText(s.text);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const openSource = (n: Note) => {
    selectNote(n.id);
    setView('kb');
  };

  const modeLabel = MODES.find((m) => m.key === mode)?.label ?? '智能';

  return (
    <div className="chathome">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-greet">你好，我是笃行</div>
            <div className="chat-sub">本地优先的 AI 助手。直接问我任何问题——我会先查你记过的知识库，命中就用你的笔记答（带出处）；没记过就用自己的通用知识补上。也能帮你记笔记或安排待办。</div>
            <div className="chat-suggest">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="suggest-chip" onClick={() => applySuggestion(s)}>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'msg user' : 'msg assistant'}>
              {m.images && m.images.length > 0 && (
                <div className="msg-imgs">
                  {m.images.map((u, i) => (
                    <img key={i} src={u} alt="" />
                  ))}
                </div>
              )}
              <div className="bubble">
                {m.pending ? (
                  <span className="typing">思考中…</span>
                ) : m.role === 'assistant' ? (
                  <div className={m.error ? 'bubble-err' : '' + ' md-body'}>
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                ) : (
                  <span className={m.error ? 'bubble-err' : ''}>{m.text}</span>
                )}
                {m.sources && m.sources.length > 0 && (
                  <div className="msg-sources">
                    来源：
                    {m.sources.map((s) => (
                      <span key={s.id} className="tag link" onClick={() => openSource(s)}>
                        {s.title}
                      </span>
                    ))}
                  </div>
                )}
                {!m.pending && !m.error && m.grounded === false && (
                  <div className="msg-ungrounded">AI 通用回答 · 非来自你的笔记</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-input">
        <div className="mode-chips-row">
          <div className="mode-chips">
            {MODES.map((m) => (
              <button
                key={m.key}
                className={mode === m.key ? 'chip active' : 'chip'}
                title={m.desc}
                onClick={() => pickMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          {messages.length > 0 && (
            <button
              className="chip clear"
              title="清空对话记录"
              onClick={() => {
                if (window.confirm('确定清空当前对话记录？此操作不可撤销。')) clearChat();
              }}
            >
              清空
            </button>
          )}
        </div>

        {slashOpen && slashFiltered.length > 0 && (
          <div className="slash-menu">
            {slashFiltered.map((c, i) => (
              <div
                key={c.key}
                className={i === slashIndex ? 'slash-item active' : 'slash-item'}
                onMouseEnter={() => setSlashIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMode(c.key);
                }}
              >
                <span className="slash-text">
                  <b>/{c.key}</b>
                  <span className="slash-desc">{c.label} · {c.desc}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="chat-bar">
          <textarea
            ref={taRef}
            className="chat-textarea"
            value={text}
            placeholder={
              mode === 'chat'
                ? '直接提问，或发图片让我看看…（可连续追问）'
                : mode === 'query'
                ? '向知识库提问…（支持图片）'
                : mode === 'todo'
                ? '描述一条待办…'
                : mode === 'note'
                ? '记录一条知识…'
                : '说点什么，或输入 / 选择功能…'
            }
            rows={2}
            onChange={(e) => onTextChange(e.target.value)}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
          />
          <button className="icon-btn attach" title="添加图片" onClick={() => fileRef.current?.click()} disabled={loading}>
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
          <button className="btn primary" onClick={send} disabled={loading}>
            {loading ? '处理中…' : '发送'}
          </button>
        </div>

        {images.length > 0 && (
          <div className="image-thumbs">
            {images.map((url, i) => (
              <div key={i} className="thumb">
                <img src={url} alt="" />
                <button className="thumb-remove" onClick={() => removeImage(i)} title="移除">×</button>
              </div>
            ))}
          </div>
        )}

        <div className="chat-hint">
          当前模式：<b>{modeLabel}</b>
          {mode === 'chat'
            ? '（先查知识库，未命中再用 AI 通用回答）'
            : mode === 'auto' && '（自动识别待办 / 知识 / 提问）'} · 输入 / 可切换功能
        </div>
      </div>
    </div>
  );
}
