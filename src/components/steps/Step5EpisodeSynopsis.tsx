import { useState, useEffect, useCallback } from 'react';
import WorkflowShell from '../ui/WorkflowShell';
import PromptEditorModal from '../ui/PromptEditorModal';
import { useApp } from '../../context/AppContext';
import type { Episode } from '../../api/types';
import * as step5Api from '../../api/step5';
import { streamSSE } from '../../api/sse';

function InlineEditText({ value, onSave, rows = 5 }: { value: string; onSave: (v: string) => void; rows?: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={rows} autoFocus
          className="w-full text-xs rounded-lg p-2.5 resize-none focus:outline-none"
          style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-primary)', color: 'var(--color-text)', lineHeight: 1.7 }}
        />
        <div className="flex gap-2 mt-1.5">
          <button onClick={() => { onSave(draft); setEditing(false); }} className="text-xs gradient-primary text-white px-3 py-1 rounded-lg">保存</button>
          <button onClick={() => setEditing(false)} className="text-xs px-3 py-1 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>取消</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <button onClick={() => { setDraft(value); setEditing(true); }} className="absolute -top-1 right-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-primary)' }}>编辑</button>
      <p className="text-xs leading-relaxed pr-6" style={{ color: 'var(--color-text)' }}>{value}</p>
    </div>
  );
}

function FeedbackBox({ epLabel, onSubmit, loading }: { epLabel: string; onSubmit: (t: string) => void; loading?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={`对「${epLabel}」的修改意见…`}
        rows={2}
        disabled={loading}
        className="w-full text-xs resize-none focus:outline-none rounded-lg p-2.5 disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}
        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
      />
      {loading && (
        <div className="mt-1.5 flex items-center gap-2 text-xs" style={{ color: '#a29bfe' }}>
          <div className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          AI 正在处理修改意见…
        </div>
      )}
      <button
        onClick={() => { if (value.trim()) { onSubmit(value.trim()); setValue(''); } }}
        disabled={!value.trim() || loading}
        className="mt-1.5 gradient-primary text-white text-xs px-3 py-1 rounded-lg disabled:opacity-40"
      >
        {loading ? 'AI 处理中…' : '提交给 AI'}
      </button>
    </div>
  );
}

export default function Step5EpisodeSynopsis() {
  const { navigate, nextStep, consumeGenerate, currentProjectId, project, addHistory } = useApp();
  const eps = project?.episodes ?? 80;
  const dur = project?.duration_min ?? 80;
  const market = project?.market ?? 'china';
  const market_label = market === 'china' ? '中国' : market === 'latam' ? '拉美' : '欧美';
  const scriptLang = project?.script_language === 'en' ? '英文' : '中文';
  const dialogueLang = project?.dialogue_language === 'en' ? '英文' : project?.dialogue_language === 'en-zh' ? '英（主）中（辅）' : '中文';

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [genProgress, setGenProgress] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [feedbackLoadingId, setFeedbackLoadingId] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState<string | null>(null);

  const startGenerate = useCallback(() => {
    if (!currentProjectId) return;
    setGenerating(true);
    setError('');
    streamSSE<Episode>(
      `/projects/${currentProjectId}/episodes/generate`,
      {},
      (event, data) => {
        if (event === 'done') {
          setEpisodes(prev => prev.map(e => (e.episode_number === data.episode_number ? { ...data } : e)));
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
        const list = await step5Api.getEpisodes(currentProjectId);
        if (cancelled) return;
        const shouldGenerate = consumeGenerate();
        setEpisodes(list);
        const doneCount = list.filter(e => e.status === 'done').length;
        setGenProgress(doneCount);
        if (shouldGenerate && list.length > 0) startGenerate();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      }
    })();
    return () => { cancelled = true; };
  }, [currentProjectId, startGenerate, consumeGenerate]);

  const secondsPerEp = Math.round(dur * 60 / eps);
  const allGenerated = !generating && genProgress >= episodes.length;

  function updateEp(id: string, field: 'title' | 'hook' | 'synopsis', value: string) {
    setEpisodes(prev => prev.map(e => (e.id === id ? { ...e, [field]: value } : e)));
    if (!currentProjectId) return;
    const patch: step5Api.EpisodePatch = { [field]: value };
    step5Api.updateEpisode(currentProjectId, episodes.find(e => e.id === id)?.episode_number ?? 0, patch)
      .then(updated => setEpisodes(prev => prev.map(e => (e.id === id ? updated : e))))
      .catch(() => {});
  }

  async function handleFeedback(ep: Episode, text: string) {
    if (!currentProjectId) return;
    addHistory(`[第 ${ep.episode_number} 集] ${text}`);
    setFeedbackLoadingId(ep.id);
    try {
      const updated = await step5Api.feedbackEpisode(currentProjectId, ep.episode_number, text);
      setEpisodes(prev => prev.map(e => (e.id === ep.id ? updated : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setFeedbackLoadingId(null);
    }
  }

  function buildPrompt(ep: Episode) {
    return `现在分集大纲已确定，「第${ep.episode_number}集」的大纲内容如下：
「开篇钩子：${ep.hook ?? ''}
剧情大纲：${ep.synopsis ?? ''}」
根据以上信息撰写该集的分镜脚本，要求：
1. 人物名、家族/势力名使用 ${scriptLang === '英文' ? '英语' : '中文'}
2. 对话台词、画面字使用「${dialogueLang}」
3. 分镜脚本的其它内容均使用「${scriptLang}」
4. AI 生成视频时，对于手机屏幕 / 电脑屏幕 / 纸张等画面中的文字生成有难度，所以在分镜设计上尽量避免这样的画面，可以用画外音（心里默读）、角色口述或其他方式表现出来。
5. 每集的篇幅长度一定要控制在 ${secondsPerEp} 秒左右。
6. 该短剧要在「${market_label}」发布，注意进行「${market_label}」的本土化调整。
7. 每集的节奏要紧凑，要按照大纲中每集的开篇钩子和结尾钩子作为每集开篇和结尾，中间内容要符合剧情简介，可以适当插入或调整内容，但前后剧情要连贯。
8. 台词要简洁精炼，符合短剧的快节奏要求。
9. 分镜脚本中要有镜头语言提示，具体格式参考如下：
第一集
1-1 王侯府演武场/外/日
人物：赵辰（年轻版）、赵天、周围子弟N人
△（开场特写）赵辰盘腿坐在角落，一身破旧粗布衣。周围的锦衣侯府子弟正在指指点点。
周围子弟A：（嘲弄）15岁都没觉醒神脉，怎么还敢来演武场丢人现眼？`;
  }

  const activePromptEp = episodes.find(e => e.id === showPrompt);

  return (
    <WorkflowShell hideRightPanel>
      {activePromptEp && (
        <PromptEditorModal
          isOpen={!!showPrompt}
          onClose={() => setShowPrompt(null)}
          title={`提示词 · 第 ${activePromptEp.episode_number} 集`}
          initialPrompt={buildPrompt(activePromptEp)}
          defaultPrompt={buildPrompt(activePromptEp)}
        />
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>第五步：分集脚本</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>每集大纲，点击内容可直接编辑，确认后进入分镜脚本生成</p>
        </div>
      </div>

      {!allGenerated && (
        generating ? (
          <div className="mb-6 p-4 rounded-xl flex items-center gap-4" style={{ backgroundColor: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.2)' }}>
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1" style={{ color: '#a29bfe' }}>
                <span>AI 正在生成分集大纲…</span>
                <span>{genProgress}/{episodes.length} 集</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                <div className="h-full rounded-full gradient-primary transition-all" style={{ width: `${episodes.length ? (genProgress / episodes.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        ) : genProgress === 0 ? (
          <div className="mb-6 p-6 rounded-xl text-center" style={{ border: '1px dashed var(--color-border)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>尚未生成分集大纲，点击下方按钮开始</p>
            <button onClick={startGenerate} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold">开始生成分集大纲</button>
          </div>
        ) : (
          <div className="mb-6 p-6 rounded-xl text-center" style={{ border: '1px dashed var(--color-border)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>已生成 {genProgress}/{episodes.length} 集，继续生成剩余内容</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {episodes.map(ep => {
          const label = `第 ${ep.episode_number} 集`;
          const isDone = ep.status === 'done';
          return (
            <div
              key={ep.id}
              className="gradient-border-left rounded-xl pl-5 pr-5 py-5"
              style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderLeft: 'none', opacity: isDone ? 1 : 0.55 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{label}</span>
                  {ep.title && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,184,148,0.12)', color: 'var(--color-success)' }}>{ep.title}</span>}
                  {!isDone && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-muted)' }}>生成中…</span>}
                </div>
                <button
                  onClick={() => setShowPrompt(ep.id)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  提示词
                </button>
              </div>

              {ep.hook && (
                <blockquote className="pl-3 mb-3 italic" style={{ borderLeft: '2px solid var(--color-primary)' }}>
                  <InlineEditText value={ep.hook} onSave={v => updateEp(ep.id, 'hook', v)} rows={2} />
                </blockquote>
              )}

              {ep.synopsis && <InlineEditText value={ep.synopsis} onSave={v => updateEp(ep.id, 'synopsis', v)} />}

              {ep.key_scenes.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-muted)' }}>关键场次</div>
                  <div className="space-y-1">
                    {ep.key_scenes.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                        <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }}>●</span>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-2">
                <button onClick={() => nextStep('step6')} className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
                  生成本集分镜 →
                </button>
              </div>

              <FeedbackBox epLabel={label} onSubmit={text => handleFeedback(ep, text)} loading={feedbackLoadingId === ep.id} />
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate('step4')} className="text-sm px-4 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>← 返回上一步</button>
        <button onClick={() => nextStep('step6')} disabled={!allGenerated} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold disabled:opacity-50">
          全部确认，生成分镜 →
        </button>
      </div>
    </WorkflowShell>
  );
}
