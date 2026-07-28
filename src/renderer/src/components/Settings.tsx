import { useRef, useState } from 'react';
import { useStore } from '../store/useStore';

export default function Settings({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const saveSettings = useStore((s) => s.saveSettings);
  const exportData = useStore((s) => s.exportData);
  const exportAll = useStore((s) => s.exportAll);
  const exportNotesMarkdown = useStore((s) => s.exportNotesMarkdown);
  const importData = useStore((s) => s.importData);
  const refresh = useStore((s) => s.refresh);
  const loadNotes = useStore((s) => s.loadNotes);
  const testConnection = useStore((s) => s.testConnection);

  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl || 'https://api.deepseek.com/v1');
  const [model, setModel] = useState(settings.model || 'deepseek-chat');
  const [localOnly, setLocalOnly] = useState(!!settings.localOnly);
  const [dailyBriefing, setDailyBriefing] = useState(settings.dailyBriefing !== false);
  const [briefingTime, setBriefingTime] = useState(settings.briefingTime || '09:00');
  const [theme, setTheme] = useState(settings.theme || 'system');
  const [snoozeMinutes, setSnoozeMinutes] = useState(settings.snoozeMinutes || 30);
  const [embedModel, setEmbedModel] = useState(settings.embedModel || '');
  const [msg, setMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState<{ ok: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    await saveSettings({ apiKey, baseUrl, model, localOnly, dailyBriefing, briefingTime, theme: theme as any, snoozeMinutes, embedModel: embedModel.trim() || undefined });
    setMsg('设置已保存');
  };

  const doExport = async (fmt: 'json' | 'csv') => {
    try {
      const file = await exportData(fmt);
      setMsg('已导出：' + file);
    } catch (e) {
      setMsg('导出失败：' + String(e));
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestRes(null);
    try {
      const res = await testConnection({ apiKey, baseUrl, model });
      setTestRes(res);
      setMsg('');
    } catch (e) {
      setTestRes({ ok: false, message: '测试异常：' + String(e) });
    } finally {
      setTesting(false);
    }
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await importData(text);
      await refresh();
      await loadNotes();
      setMsg(`导入成功：任务 ${res.tasks} 条，笔记 ${res.notes} 条`);
    } catch (err) {
      setMsg('导入失败：' + String(err));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <h3>设置</h3>
        <label>API Key（DeepSeek / OpenAI 兼容）</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
        <label>Base URL</label>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        <label>模型</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} />
        <label>语义向量模型（可选）</label>
        <input
          value={embedModel}
          onChange={(e) => setEmbedModel(e.target.value)}
          placeholder="如 text-embedding-3-small，留空则自动降级为关键词检索"
        />
        <div className="muted" style={{ fontSize: 12 }}>
          AI 记忆库的语义检索依赖此模型的 /embeddings 接口；不填则使用关键词匹配，仍可正常检索。
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={localOnly}
            onChange={(e) => setLocalOnly(e.target.checked)}
          />
          仅本地模式（不调用 AI，使用关键词规则解析）
        </label>

        <div className="sep" />
        <label>每日简报</label>
        <label className="check">
          <input
            type="checkbox"
            checked={dailyBriefing}
            onChange={(e) => setDailyBriefing(e.target.checked)}
          />
          每天定时推送「今日简报」系统通知
        </label>
        <label>推送时间</label>
        <input type="time" value={briefingTime} onChange={(e) => setBriefingTime(e.target.value)} />
        <div className="muted" style={{ fontSize: 12 }}>
          应用需在后台运行（最小化为托盘）才能收到通知；每天的简报也可在「每日简报」页随时查看。
        </div>

        <div className="sep" />
        <label>主题</label>
        <div className="segmented">
          {[
            { value: 'system', label: '跟随系统' },
            { value: 'light', label: '浅色' },
            { value: 'dark', label: '深色' },
          ].map((opt) => (
            <button
              key={opt.value}
              className={theme === opt.value ? 'segment-btn active' : 'segment-btn'}
              onClick={() => setTheme(opt.value as 'light' | 'dark' | 'system')}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label>稍后提醒时长（分钟）</label>
        <input
          type="number"
          min={5}
          max={1440}
          value={snoozeMinutes}
          onChange={(e) => setSnoozeMinutes(Math.max(1, Number(e.target.value) || 30))}
        />

        <div className="test-row">
          <button className="btn" onClick={runTest} disabled={testing || localOnly}>
            {testing ? '测试中…' : '测试连接'}
          </button>
          {testRes && (
            <span className={testRes.ok ? 'test-ok' : 'test-fail'}>
              {testRes.message}
            </span>
          )}
          {localOnly && <span className="test-hint">仅本地模式无需测试</span>}
        </div>

        <div className="sep" />
        <label>数据备份</label>
        <div className="modal-actions">
          <button className="btn" onClick={() => fileRef.current?.click()}>
            导入备份
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={onImportFile}
          />
          <button className="btn" onClick={() => exportAll().then((f) => setMsg('已导出：' + f)).catch((e) => setMsg('失败：' + e))}>
            全量备份
          </button>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={() => doExport('json')}>导出 JSON</button>
          <button className="btn" onClick={() => doExport('csv')}>导出 CSV</button>
          <button className="btn" onClick={() => exportNotesMarkdown().then((f) => setMsg('已导出：' + f)).catch((e) => setMsg('失败：' + e))}>
            笔记导出 MD
          </button>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>关闭</button>
          <button className="btn primary" onClick={save}>保存</button>
        </div>
        {msg && <div className="msg">{msg}</div>}
      </div>
    </div>
  );
}
