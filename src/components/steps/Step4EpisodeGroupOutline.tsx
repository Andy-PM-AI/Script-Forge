import { useState, useEffect, useCallback } from 'react';
import WorkflowShell from '../ui/WorkflowShell';
import PromptEditorModal from '../ui/PromptEditorModal';
import { useApp } from '../../context/AppContext';
import type { SegmentWithGroups, EpisodeGroup } from '../../api/types';
import * as step4Api from '../../api/step4';
import { streamSSE } from '../../api/sse';

function InlineEditText({ value, onSave, multiline = true }: { value: string; onSave: (v: string) => void; multiline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div>
        {multiline ? (
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={5} autoFocus
            className="w-full text-sm rounded-lg p-3 resize-none focus:outline-none"
            style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-primary)', color: 'var(--color-text)', lineHeight: 1.7 }}
          />
        ) : (
          <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus
            className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none"
            style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-primary)', color: 'var(--color-text)' }}
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
    <div className="group relative">
      <button onClick={() => { setDraft(value); setEditing(true); }} className="absolute -top-1 right-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-primary)' }}>编辑</button>
      <p className="text-sm leading-relaxed pr-8" style={{ color: 'var(--color-text)' }}>{value}</p>
    </div>
  );
}

function FeedbackBox({ groupLabel, onSubmit, loading }: { groupLabel: string; onSubmit: (text: string) => void; loading?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>修改意见 · {groupLabel}</div>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="输入修改方向…"
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

export default function Step4EpisodeGroupOutline() {
  const { navigate, nextStep, consumeGenerate, currentProjectId, project, addHistory } = useApp();
  const eps = project?.episodes ?? 80;
  const [segData, setSegData] = useState<SegmentWithGroups[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const startGenerate = useCallback(() => {
    if (!currentProjectId) return;
    setGenerating(true);
    setError('');
    streamSSE<EpisodeGroup & { group_id: string; segment_id: string | null }>(
      `/projects/${currentProjectId}/episode-groups/generate`,
      {},
      (event, data) => {
        if (event === 'done') {
          setSegData(prev => prev.map(seg => ({
            ...seg,
            groups: seg.groups.map(g => (g.id === data.group_id ? { ...data } : g)),
          })));
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
        const data = await step4Api.getEpisodeGroups(currentProjectId);
        if (cancelled) return;
        const shouldGenerate = consumeGenerate();
        setSegData(data);
        const allGroups = data.flatMap(s => s.groups);
        setGenProgress(allGroups.filter(g => g.status === 'done').length);
        if (data.length > 0) {
          setExpanded({ [data[0].id]: true });
          setActiveGroupId(prev => prev ?? data[0].groups[0]?.id ?? null);
        }
        if (shouldGenerate && allGroups.length > 0) startGenerate();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      }
    })();
    return () => { cancelled = true; };
  }, [currentProjectId, startGenerate, consumeGenerate]);

  const allGroups = segData.flatMap(s => s.groups);
  const totalGroups = allGroups.length;
  const allGenerated = !generating && genProgress >= totalGroups;

  const g = allGroups.find(x => x.id === activeGroupId) ?? null;

  function updateGroup(id: string, field: 'label' | 'hook' | 'summary' | 'ending_hook', value: string) {
    setSegData(prev => prev.map(seg => ({
      ...seg,
      groups: seg.groups.map(grp => (grp.id === id ? { ...grp, [field]: value } : grp)),
    })));
    if (!currentProjectId) return;
    const patch: step4Api.GroupPatch = { [field]: value };
    step4Api.updateGroup(currentProjectId, id, patch).then(updated => {
      setSegData(prev => prev.map(seg => ({
        ...seg,
        groups: seg.groups.map(grp => (grp.id === id ? updated : grp)),
      })));
    }).catch(() => {});
  }

  async function handleFeedback(groupId: string, label: string, text: string) {
    if (!currentProjectId) return;
    addHistory(`[${label}] ${text}`);
    setFeedbackLoading(true);
    try {
      const updated = await step4Api.feedbackGroup(currentProjectId, groupId, text);
      setSegData(prev => prev.map(seg => ({
        ...seg,
        groups: seg.groups.map(grp => (grp.id === groupId ? updated : grp)),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setFeedbackLoading(false);
    }
  }

  const promptText = g
    ? `现在分段大纲已确定，「${g.label ?? ''}（${g.range}）」的大纲内容如下：
「剧情简介：${g.summary ?? ''}
开篇钩子：${g.hook ?? ''}
结尾钩子：${g.ending_hook ?? ''}」
根据以上信息，列出每1集的剧情简介（1000 左右）、每集的开场和结尾钩子，要求：
1. 每集之间的剧情要有连贯性
2. 要合理安排几条故事线的节奏，不能一直讲某条线而其他线不提，需要几条故事线穿插进行
3. 第一集的开场和最后一集的钩子要对应上一步中的结果`
    : '';

  return (
    <WorkflowShell hideRightPanel>
      <PromptEditorModal isOpen={showPrompt} onClose={() => setShowPrompt(false)} initialPrompt={promptText} defaultPrompt={promptText} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>第四步：分集粗纲</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{eps <= 40 ? '将全剧直接细分为小段，点击内容可直接编辑' : '将大段细分为每 5 集一个小段，点击内容可直接编辑'}</p>
      </div>

      {!allGenerated && (
        generating ? (
          <div className="mb-6 p-4 rounded-xl flex items-center gap-4" style={{ backgroundColor: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.2)' }}>
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1" style={{ color: '#a29bfe' }}>
                <span>AI 正在生成分集粗纲…</span>
                <span>{genProgress}/{totalGroups} 小段</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                <div className="h-full rounded-full gradient-primary transition-all" style={{ width: `${totalGroups ? (genProgress / totalGroups) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        ) : genProgress === 0 ? (
          <div className="mb-6 p-6 rounded-xl text-center" style={{ border: '1px dashed var(--color-border)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>尚未生成分集粗纲，点击下方按钮开始</p>
            <button onClick={startGenerate} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold">开始生成分集粗纲</button>
          </div>
        ) : (
          <div className="mb-6 p-6 rounded-xl text-center" style={{ border: '1px dashed var(--color-border)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>已生成 {genProgress}/{totalGroups} 小段，继续生成剩余内容</p>
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
        <div className="w-52 flex-shrink-0 space-y-1">
          {segData.map(seg => (
            <div key={seg.id}>
              <button
                onClick={() => setExpanded(p => ({ ...p, [seg.id]: !p[seg.id] }))}
                className="w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between"
                style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
              >
                <div>
                  <div className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{seg.title}</div>
                  <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{seg.range}</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-muted)', transform: expanded[seg.id] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
              {expanded[seg.id] && (
                <div className="ml-3 mt-1 space-y-1">
                  {seg.groups.map(grp => (
                    <button
                      key={grp.id}
                      onClick={() => setActiveGroupId(grp.id)}
                      className="w-full text-left px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: activeGroupId === grp.id ? 'rgba(108,92,231,0.12)' : 'transparent',
                        borderLeft: activeGroupId === grp.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: grp.status === 'done' ? 'var(--color-success)' : 'var(--color-border)' }} />
                        <span className="text-xs" style={{ color: activeGroupId === grp.id ? 'var(--color-primary)' : 'var(--color-muted)' }}>{grp.label ?? `第${grp.sort_order}小段`}</span>
                      </div>
                      <div className="text-xs mt-0.5 ml-3" style={{ color: 'var(--color-muted-dark)' }}>{grp.range}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex-1">
          {g ? (
            <div
              className="gradient-border-left rounded-xl pl-5 pr-5 py-5"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderLeft: 'none' }}
            >
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>{g.label ?? `第${g.sort_order}小段`}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,184,148,0.12)', color: 'var(--color-success)' }}>{g.range}</span>
              </div>

              <div className="mb-4">
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>开场钩子</div>
                <blockquote className="pl-4" style={{ borderLeft: '3px solid var(--color-primary)' }}>
                  <InlineEditText value={g.hook ?? ''} onSave={v => updateGroup(g.id, 'hook', v)} multiline={false} />
                </blockquote>
              </div>

              <div className="mb-4">
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>剧情骨架</div>
                <InlineEditText value={g.summary ?? ''} onSave={v => updateGroup(g.id, 'summary', v)} />
              </div>

              <div className="mb-2">
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>结尾钩子</div>
                <blockquote className="pl-4" style={{ borderLeft: '3px solid var(--color-accent)' }}>
                  <InlineEditText value={g.ending_hook ?? ''} onSave={v => updateGroup(g.id, 'ending_hook', v)} multiline={false} />
                </blockquote>
              </div>

              <FeedbackBox groupLabel={`${g.label ?? ''} · ${g.range}`} onSubmit={text => handleFeedback(g.id, g.label ?? '', text)} loading={feedbackLoading} />
            </div>
          ) : (
            <div className="text-center py-20" style={{ color: 'var(--color-muted)' }}>请从左侧选择小段</div>
          )}
        </div>
      </div>

      <div className="mt-8 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex gap-2">
          <button onClick={() => navigate(eps <= 40 ? 'step2' : 'step3')} className="text-sm px-4 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>← 返回上一步</button>
          <button onClick={() => setShowPrompt(true)} className="flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            提示词
          </button>
        </div>
        <button onClick={() => nextStep('step5')} disabled={!allGenerated} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold disabled:opacity-50">
          确认提交，下一步 →
        </button>
      </div>
    </WorkflowShell>
  );
}
