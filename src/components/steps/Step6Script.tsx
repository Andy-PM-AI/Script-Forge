import { useState, useEffect, useRef, useCallback } from 'react';
import WorkflowShell from '../ui/WorkflowShell';
import { useApp } from '../../context/AppContext';
import type { Script } from '../../api/types';
import * as step6Api from '../../api/step6';
import { streamSSE } from '../../api/sse';

/* Render the episode script as read-only formatted text */
function ScriptReadView({ rawText }: { rawText: string }) {
  return (
    <div
      className="flex-1 overflow-y-auto px-10 py-6"
      style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--color-bg-base)' }}
    >
      {rawText.split('\n').map((line, i) => {
        const isSceneHeading = /^\d+-\d+\s/.test(line.trim());
        const isAction = line.trim().startsWith('△');
        const isDialogue = /^[一-龥A-Za-z\s]+：/.test(line.trim()) && !isSceneHeading;

        if (!line.trim()) return <div key={i} className="h-3" />;

        if (isSceneHeading) {
          return (
            <div key={i} className="mb-3 mt-6 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>{line}</div>
            </div>
          );
        }
        if (line.trim().startsWith('人物：')) {
          return <div key={i} className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>{line}</div>;
        }
        if (isAction) {
          return <p key={i} className="text-sm italic leading-relaxed mb-3" style={{ color: 'rgba(232,232,240,0.75)' }}>{line}</p>;
        }
        if (isDialogue) {
          const colonIdx = line.indexOf('：');
          const speaker = line.slice(0, colonIdx);
          const speech = line.slice(colonIdx + 1);
          return (
            <div key={i} className="mb-4 flex flex-col items-center">
              <div className="w-full max-w-lg text-center">
                <div className="text-sm font-bold uppercase mb-1" style={{ color: 'var(--color-text)' }}>{speaker}</div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>{speech}</p>
              </div>
            </div>
          );
        }
        return <p key={i} className="text-sm leading-relaxed mb-2" style={{ color: 'var(--color-text)' }}>{line}</p>;
      })}
    </div>
  );
}

/* Per-episode feedback box */
function FeedbackBox({ epLabel, onSubmit, loading }: { epLabel: string; onSubmit: (t: string) => void; loading?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <div className="px-4 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>修改意见 · {epLabel}</div>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={`对「${epLabel}」的修改方向…`}
        rows={3}
        disabled={loading}
        className="w-full text-xs resize-none focus:outline-none rounded-lg p-3 disabled:opacity-50"
        style={{
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-mono)',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
      />
      {loading && (
        <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: '#a29bfe' }}>
          <div className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          AI 正在处理修改意见…
        </div>
      )}
      <button
        onClick={() => { if (value.trim()) { onSubmit(value.trim()); setValue(''); } }}
        disabled={!value.trim() || loading}
        className="mt-2 w-full gradient-primary text-white text-xs py-2 rounded-lg font-medium disabled:opacity-40"
      >
        {loading ? 'AI 处理中…' : '提交给 AI'}
      </button>
    </div>
  );
}

export default function Step6Script() {
  const { navigate, consumeGenerate, currentProjectId, project, addHistory } = useApp();
  const eps = project?.episodes ?? 80;
  const durationMin = project?.duration_min ?? 80;

  const [activeEpisode, setActiveEpisode] = useState(1);
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [statuses, setStatuses] = useState<Record<number, string>>({});
  const [genProgress, setGenProgress] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [error, setError] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const isComplete = genProgress >= eps;

  const startGenerate = useCallback(() => {
    if (!currentProjectId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setPaused(false);
    setError('');
    streamSSE<Script>(
      `/projects/${currentProjectId}/scripts/generate`,
      {},
      (event, data) => {
        if (event === 'done') {
          setTexts(t => ({ ...t, [data.episode_number]: data.content }));
          setStatuses(s => ({ ...s, [data.episode_number]: 'done' }));
        } else if (event === 'progress') {
          setGenProgress((data as unknown as { completed: number }).completed);
        } else if (event === 'finish') {
          setGenerating(false);
          setPaused(false);
        } else if (event === 'error') {
          setError((data as unknown as { message?: string }).message ?? '生成失败');
          setGenerating(false);
          setPaused(false);
        }
      },
      controller.signal,
    ).catch(err => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '生成失败');
      setGenerating(false);
      setPaused(false);
    });
  }, [currentProjectId]);

  // Load existing scripts on mount, auto-generate if none done.
  useEffect(() => {
    if (!currentProjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const summaries = await step6Api.getScripts(currentProjectId);
        if (cancelled) return;
        const shouldGenerate = consumeGenerate();
        const st: Record<number, string> = {};
        summaries.forEach(s => { st[s.episode_number] = s.status; });
        setStatuses(st);
        setGenProgress(summaries.filter(s => s.status === 'done').length);
        if (summaries.length > 0) {
          const first = await step6Api.getScript(currentProjectId, 1);
          if (!cancelled) setTexts(t => ({ ...t, [1]: first.content }));
        }
        if (shouldGenerate && summaries.filter(s => s.status === 'done').length === 0 && summaries.length > 0) {
          startGenerate();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      }
    })();
    return () => { cancelled = true; };
  }, [currentProjectId, startGenerate, consumeGenerate]);

  // Abort in-flight generation on unmount.
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  async function loadEpisode(ep: number) {
    if (!currentProjectId || texts[ep] !== undefined) return;
    try {
      const script = await step6Api.getScript(currentProjectId, ep);
      setTexts(t => ({ ...t, [ep]: script.content }));
    } catch {
      /* keep empty */
    }
  }

  function selectEpisode(ep: number) {
    setActiveEpisode(ep);
    setIsEditing(false);
    loadEpisode(ep);
  }

  async function togglePause() {
    if (!currentProjectId) return;
    try {
      if (paused) {
        await step6Api.resumeScripts(currentProjectId);
        setPaused(false);
      } else {
        await step6Api.pauseScripts(currentProjectId);
        setPaused(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  }

  function getEpisodeText(ep: number): string {
    return texts[ep] ?? '';
  }

  function startEdit() {
    setEditDraft(getEpisodeText(activeEpisode));
    setIsEditing(true);
  }

  async function saveEdit() {
    setIsEditing(false);
    setTexts(prev => ({ ...prev, [activeEpisode]: editDraft }));
    setStatuses(prev => ({ ...prev, [activeEpisode]: 'done' }));
    if (!currentProjectId) return;
    try {
      const updated = await step6Api.updateScript(currentProjectId, activeEpisode, editDraft);
      setTexts(prev => ({ ...prev, [activeEpisode]: updated.content }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  async function handleFeedback(text: string) {
    if (!currentProjectId) return;
    const epLabel = `第 ${activeEpisode} 集`;
    addHistory(`[${epLabel}] ${text}`);
    setFeedbackLoading(true);
    try {
      const updated = await step6Api.feedbackScript(currentProjectId, activeEpisode, text);
      setTexts(prev => ({ ...prev, [activeEpisode]: updated.content }));
      setStatuses(prev => ({ ...prev, [activeEpisode]: 'done' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setFeedbackLoading(false);
    }
  }

  const epLabel = `第 ${activeEpisode} 集`;
  const activeIsDone = statuses[activeEpisode] === 'done' || activeEpisode <= genProgress;

  return (
    <WorkflowShell fullHeight hideRightPanel>
      {/* Episode tab bar */}
      <div
        className="flex items-center px-4 overflow-x-auto flex-shrink-0 gap-1 py-2"
        style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}
      >
        <span className="text-xs mr-2 flex-shrink-0 font-semibold" style={{ color: 'var(--color-muted)' }}>集数</span>
        <select
          value={activeEpisode}
          onChange={e => selectEpisode(Number(e.target.value))}
          className="text-xs px-2 py-1.5 rounded-lg flex-shrink-0 focus:outline-none"
          style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          {Array.from({ length: eps }, (_, i) => i + 1).map(ep => (
            <option key={ep} value={ep}>第 {ep} 集</option>
          ))}
        </select>
        {Array.from({ length: eps }, (_, i) => i + 1).map(ep => {
          const isGenerated = statuses[ep] === 'done' || ep <= genProgress;
          return (
            <button
              key={ep}
              onClick={() => selectEpisode(ep)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs flex-shrink-0 transition-all"
              style={{
                backgroundColor: activeEpisode === ep ? 'rgba(108,92,231,0.15)' : 'transparent',
                color: activeEpisode === ep ? 'var(--color-primary)' : 'var(--color-muted)',
                border: activeEpisode === ep ? '1px solid var(--color-primary)' : '1px solid transparent',
              }}
            >
              {isGenerated && <span style={{ color: 'var(--color-success)', fontSize: '8px' }}>●</span>}
              第 {ep} 集
            </button>
          );
        })}
      </div>

      {/* Generation progress banner */}
      {showBanner && (
        <div
          className="flex items-center gap-4 px-6 py-3 flex-shrink-0"
          style={{ backgroundColor: 'rgba(108,92,231,0.1)', borderBottom: '1px solid rgba(108,92,231,0.2)' }}
        >
          {generating && !paused ? (
            <div className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          ) : (
            <span style={{ color: isComplete ? 'var(--color-success)' : 'var(--color-muted)', fontSize: '14px' }}>
              {isComplete ? '✓' : paused ? '⏸' : '▶'}
            </span>
          )}
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1" style={{ color: '#a29bfe' }}>
              <span>{paused ? '已暂停' : generating ? `分镜生成中… 第 ${genProgress}/${eps} 集` : isComplete ? '全部生成完成' : `已生成 ${genProgress} 集`}</span>
              <span>{genProgress}/{eps}</span>
            </div>
            <div className="h-1 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
              <div className="h-full rounded-full gradient-primary transition-all" style={{ width: `${(genProgress / eps) * 100}%` }} />
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {isComplete ? (
              <button onClick={startGenerate} className="text-xs px-3 py-1.5 rounded-lg gradient-primary text-white">
                重新生成全部
              </button>
            ) : generating ? (
              <button onClick={togglePause} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                {paused ? '继续生成' : '暂停'}
              </button>
            ) : (
              <button onClick={startGenerate} className="text-xs px-3 py-1.5 rounded-lg gradient-primary text-white">
                继续生成
              </button>
            )}
            <button onClick={() => setShowBanner(false)} className="p-1.5 hover:opacity-70" style={{ color: 'var(--color-muted)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-6 py-3 flex-shrink-0 text-sm" style={{ backgroundColor: 'rgba(225,112,85,0.1)', borderBottom: '1px solid rgba(225,112,85,0.3)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-6 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}
      >
        <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{epLabel}</span>
        <div className="ml-auto flex gap-2">
          {isEditing ? (
            <>
              <button onClick={saveEdit} className="text-xs px-4 py-1.5 rounded-lg gradient-primary text-white font-medium">保存</button>
              <button onClick={cancelEdit} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>取消</button>
            </>
          ) : (
            <button onClick={startEdit} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              编辑
            </button>
          )}
        </div>
      </div>

      {/* Main: script + right panel */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {isEditing ? (
            <textarea
              value={editDraft}
              onChange={e => setEditDraft(e.target.value)}
              className="flex-1 resize-none focus:outline-none px-10 py-6 text-sm leading-relaxed"
              style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text)', border: 'none' }}
              spellCheck={false}
            />
          ) : activeIsDone ? (
            <ScriptReadView rawText={getEpisodeText(activeEpisode)} />
          ) : (
            <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--color-muted)' }}>
              <div className="text-center">
                <div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto mb-3" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                <p className="text-sm">该集尚未生成</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: info + feedback */}
        <div
          className="w-72 flex-shrink-0 flex flex-col overflow-hidden"
          style={{ borderLeft: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}
        >
          <div className="px-4 py-3 text-xs font-semibold flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
            本集信息 · {epLabel}
          </div>
          <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
            {[
              { label: '预计时长', value: `${Math.round(durationMin * 60 / eps)} 秒` },
              { label: '生成状态', value: activeIsDone ? '已生成' : '未生成' },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-xs py-1">
                <span style={{ color: 'var(--color-muted)' }}>{item.label}</span>
                <span style={{ color: 'var(--color-text)' }}>{item.value}</span>
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            <FeedbackBox epLabel={epLabel} onSubmit={handleFeedback} loading={feedbackLoading} />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}
      >
        <button onClick={() => navigate('step5')} className="text-sm px-4 py-2 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>← 返回上一步</button>
        <button onClick={() => navigate('step7')} className="text-sm px-5 py-2 rounded-lg font-semibold gradient-primary text-white">
          完成创作 →
        </button>
      </div>
    </WorkflowShell>
  );
}
