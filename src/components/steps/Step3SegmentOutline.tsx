import { useState, useEffect, useCallback } from 'react';
import WorkflowShell from '../ui/WorkflowShell';
import PromptEditorModal from '../ui/PromptEditorModal';
import { useApp } from '../../context/AppContext';
import type { Segment } from '../../api/types';
import * as step3Api from '../../api/step3';
import { streamSSE } from '../../api/sse';

function InlineEditText({
  value,
  onSave,
  multiline = true,
  className = '',
}: {
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className={className}>
        {multiline ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={6}
            className="w-full text-sm rounded-lg p-3 resize-none focus:outline-none"
            style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-primary)', color: 'var(--color-text)', lineHeight: 1.7 }}
            autoFocus
          />
        ) : (
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none"
            style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-primary)', color: 'var(--color-text)' }}
            autoFocus
          />
        )}
        <div className="flex gap-2 mt-2">
          <button onClick={() => { onSave(draft); setEditing(false); }} className="text-xs gradient-primary text-white px-3 py-1.5 rounded-lg">保存</button>
          <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>取消</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative ${className}`}>
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="absolute -top-1 right-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--color-primary)' }}
      >
        编辑
      </button>
      <p className="text-sm leading-relaxed pr-8" style={{ color: 'var(--color-text)' }}>{value}</p>
    </div>
  );
}

function FeedbackBox({ segTitle, onSubmit, loading }: { segTitle: string; onSubmit: (text: string) => void; loading?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>修改意见 · {segTitle}</div>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={`输入对「${segTitle}」的修改方向…`}
        rows={3}
        disabled={loading}
        className="w-full text-xs resize-none focus:outline-none rounded-lg p-3 disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
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
        className="mt-2 gradient-primary text-white text-xs px-4 py-1.5 rounded-lg font-medium disabled:opacity-40"
      >
        {loading ? 'AI 处理中…' : '提交给 AI'}
      </button>
    </div>
  );
}

export default function Step3SegmentOutline() {
  const { navigate, nextStep, consumeGenerate, currentProjectId, project, addHistory } = useApp();
  const eps = project?.episodes ?? 80;
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [genProgress, setGenProgress] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const startGenerate = useCallback(() => {
    if (!currentProjectId) return;
    setGenerating(true);
    setError('');
    streamSSE<Segment & { segment_id: string }>(
      `/projects/${currentProjectId}/segments/generate`,
      {},
      (event, data) => {
        if (event === 'done') {
          setSegments(prev => prev.map(s => (s.id === data.segment_id ? { ...data } : s)));
        } else if (event === 'progress') {
          setGenProgress((data as unknown as { completed: number }).completed);
        } else if (event === 'finish') {
          setGenerating(false);
        } else if (event === 'error') {
          setError((data as unknown as { message?: string }).message ?? '生成失败');
          setGenerating(false);
        }
      },
    ).catch(err => {
      setError(err instanceof Error ? err.message : '生成失败');
      setGenerating(false);
    });
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const segs = await step3Api.getSegments(currentProjectId);
        if (cancelled) return;
        const shouldGenerate = consumeGenerate();
        setSegments(segs);
        const doneCount = segs.filter(s => s.status === 'done').length;
        setGenProgress(doneCount);
        if (shouldGenerate && segs.length > 0) startGenerate();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      }
    })();
    return () => { cancelled = true; };
  }, [currentProjectId, startGenerate, consumeGenerate]);

  if (eps <= 40) {
    return (
      <WorkflowShell hideRightPanel>
        <div className="text-center py-24">
          <div className="text-5xl mb-4">⏭</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>此步骤已跳过</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>集数 ≤ 40 时，分段粗纲步骤自动跳过</p>
          <button onClick={() => nextStep('step4')} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl">继续下一步 →</button>
        </div>
      </WorkflowShell>
    );
  }

  const seg = segments[activeIdx];
  const allGenerated = !generating && genProgress >= segments.length;

  function updateSeg(id: string, field: 'title' | 'hook' | 'summary' | 'ending_hook', value: string) {
    setSegments(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
    if (!currentProjectId) return;
    const patch: step3Api.SegmentPatch = { [field]: value };
    step3Api.updateSegment(currentProjectId, id, patch).then(updated => {
      setSegments(prev => prev.map(s => (s.id === id ? updated : s)));
    }).catch(() => {});
  }

  async function handleFeedback(segId: string, segTitle: string, text: string) {
    if (!currentProjectId) return;
    addHistory(`[${segTitle}] ${text}`);
    setFeedbackLoading(true);
    try {
      const updated = await step3Api.feedbackSegment(currentProjectId, segId, text);
      setSegments(prev => prev.map(s => (s.id === segId ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setFeedbackLoading(false);
    }
  }

  const promptText = seg
    ? `现在分段大纲已确定，「${seg.title}」的大纲内容如下：
「剧情简介：${seg.summary ?? ''}
开篇钩子：${seg.hook ?? ''}
结尾钩子：${seg.ending_hook ?? ''}」
根据以上信息，以「5集」为一段，列出每段的剧情简介（1000 左右）、每段的开场和结尾钩子，要求：
1. 每段之间的剧情要有连贯性
2. 要合理安排几条故事线的节奏，不能一直讲某条线而其他线不提，需要几条故事线穿插进行
3. 第一段的开场和最后一段的钩子要对应上一步中的结果`
    : '';

  return (
    <WorkflowShell hideRightPanel>
      <PromptEditorModal isOpen={showPrompt} onClose={() => setShowPrompt(false)} initialPrompt={promptText} defaultPrompt={promptText} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>第三步：分段粗纲</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>AI 按大段生成剧情简介、开场钩子和结尾钩子，点击内容可直接编辑</p>
      </div>

      {!allGenerated && (
        generating ? (
          <div className="mb-6 p-4 rounded-xl flex items-center gap-4" style={{ backgroundColor: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.2)' }}>
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1" style={{ color: '#a29bfe' }}>
                <span>AI 正在分段生成粗纲…</span>
                <span>{genProgress}/{segments.length} 段</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                <div className="h-full rounded-full gradient-primary transition-all" style={{ width: `${segments.length ? (genProgress / segments.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        ) : genProgress === 0 ? (
          <div className="mb-6 p-6 rounded-xl text-center" style={{ border: '1px dashed var(--color-border)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>尚未生成分段粗纲，点击下方按钮开始</p>
            <button onClick={startGenerate} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold">开始生成分段粗纲</button>
          </div>
        ) : (
          <div className="mb-6 p-6 rounded-xl text-center" style={{ border: '1px dashed var(--color-border)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>已生成 {genProgress}/{segments.length} 段，继续生成剩余内容</p>
            <button onClick={startGenerate} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold">继续生成</button>
          </div>
        )
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(225,112,85,0.1)', border: '1px solid rgba(225,112,85,0.3)', color: 'var(--color-danger)' }}>
          {error}
          <button onClick={startGenerate} className="ml-3 underline" style={{ color: 'var(--color-primary)' }}>重试</button>
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-44 flex-shrink-0 space-y-1.5">
          {segments.map((s, i) => {
            const isGenerated = s.status === 'done' || i < genProgress;
            return (
              <button
                key={s.id}
                onClick={() => setActiveIdx(i)}
                disabled={!isGenerated}
                className="w-full text-left px-3 py-3 rounded-xl transition-all disabled:opacity-40"
                style={{
                  backgroundColor: activeIdx === i ? 'rgba(108,92,231,0.12)' : 'var(--color-bg-card)',
                  border: `1px solid ${activeIdx === i ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isGenerated ? 'var(--color-success)' : i === genProgress ? 'var(--color-primary)' : 'var(--color-border)' }}
                  />
                  <div>
                    <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{s.title}</div>
                    <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{s.range}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex-1">
          {!seg || genProgress <= activeIdx ? (
            <div className="text-center py-16" style={{ border: '1px dashed var(--color-border)', borderRadius: '12px' }}>
              <div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto mb-3" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>AI 生成中…</p>
            </div>
          ) : (
            <div
              className="gradient-border-left rounded-xl pl-5 pr-5 py-5"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderLeft: 'none' }}
            >
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>{seg.title}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,184,148,0.12)', color: 'var(--color-success)' }}>{seg.range}</span>
              </div>

              <div className="mb-4">
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>开场钩子</div>
                <blockquote className="pl-4" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                  <InlineEditText value={seg.hook ?? ''} onSave={v => updateSeg(seg.id, 'hook', v)} multiline={false} />
                </blockquote>
              </div>

              <div className="mb-4">
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>剧情简介</div>
                <InlineEditText value={seg.summary ?? ''} onSave={v => updateSeg(seg.id, 'summary', v)} />
              </div>

              <div className="mb-2">
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>结尾钩子</div>
                <blockquote className="pl-4" style={{ borderLeft: '3px solid var(--color-accent)' }}>
                  <InlineEditText value={seg.ending_hook ?? ''} onSave={v => updateSeg(seg.id, 'ending_hook', v)} multiline={false} />
                </blockquote>
              </div>

              <FeedbackBox segTitle={seg.title} onSubmit={text => handleFeedback(seg.id, seg.title, text)} loading={feedbackLoading} />

              <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <button disabled={activeIdx === 0} onClick={() => setActiveIdx(i => i - 1)} className="text-sm px-3 py-1.5 rounded-lg disabled:opacity-30" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>← 上一段</button>
                <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{genProgress} / {segments.length} 段已生成</span>
                <button disabled={activeIdx >= segments.length - 1 || activeIdx + 1 >= genProgress} onClick={() => setActiveIdx(i => i + 1)} className="text-sm px-3 py-1.5 rounded-lg disabled:opacity-30" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>下一段 →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex gap-2">
          <button onClick={() => navigate('step2')} className="text-sm px-4 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>← 返回上一步</button>
          <button onClick={() => setShowPrompt(true)} className="flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            提示词
          </button>
        </div>
        <button onClick={() => nextStep('step4')} disabled={!allGenerated} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold disabled:opacity-50">
          {allGenerated ? '确认提交，下一步 →' : `等待生成完成…（${genProgress}/${segments.length}）`}
        </button>
      </div>
    </WorkflowShell>
  );
}
