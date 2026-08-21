import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import TopNav from '../ui/TopNav';
import { generateSpark, rejectSpark, adoptSpark, type SparkDraft } from '../../api/spark';

const MARKET_CN: Record<string, string> = { global: '欧美', latam: '拉美', china: '中国' };

const LOAD_STEPS = [
  '读取去重账本',
  '按最少使用选轴',
  'KB 三级匹配检索中…',
  '等级与新颖度过滤',
  '拼装初稿包',
];

const GRADIENT_PRESETS = [
  'linear-gradient(135deg,#6C5CE7,#a29bfe)',
  'linear-gradient(135deg,#0984E3,#74b9ff)',
  'linear-gradient(135deg,#E17055,#fab1a0)',
];

const RISK_COLORS: Record<string, string> = { high: '#E17055', medium: '#FDCB6E', low: '#00B894' };
const RISK_LABELS: Record<string, string> = { high: '🔴 高', medium: '🟡 中', low: '🟢 低' };

function DraftModule({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
      <div className="mb-4">
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{icon} {title}</span>
      </div>
      {children}
    </div>
  );
}

export default function SparkStep4Generate() {
  const { navigate, sparkParams, sparkSessionId, loadProject } = useApp();
  const p = sparkParams;

  const defaultName = `${MARKET_CN[p.market] ?? '灵感'}·${p.genres.join('+') || '短剧'}`;

  const [drafts, setDrafts] = useState<SparkDraft[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(sparkSessionId);
  const [phase, setPhase] = useState<'loading' | 'regening' | 'ready'>('loading');
  const [loadStep, setLoadStep] = useState(0);
  const [rejectCount, setRejectCount] = useState(0);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectDirections, setRejectDirections] = useState<string[]>([]);
  const [customDirection, setCustomDirection] = useState('');
  const [projectName, setProjectName] = useState(defaultName);
  const [error, setError] = useState('');
  const [adopting, setAdopting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeDraft = drafts.find(d => d.draft_id === activeId) ?? drafts[drafts.length - 1] ?? null;

  async function runGenerate(dirs: string[] = [], custom: string = '') {
    setError('');
    setPhase(drafts.length === 0 ? 'loading' : 'regening');
    setLoadStep(0);
    const controller = new AbortController();
    abortRef.current = controller;
    let received = false;
    try {
      await generateSpark({
        market: p.market,
        genres: p.genres,
        episodes: p.episodes,
        duration: p.duration,
        script_language: p.scriptLanguage,
        dialogue_language: p.dialogueLanguage,
        dedup_cycle: p.dedupCycle,
        novelty_ratio: p.noveltyRatio,
        element_grade: p.elementGrade,
        diff_strength: p.diffStrength,
        session_id: sessionId ?? undefined,
        directions: dirs,
        custom_direction: custom,
      }, (event, data) => {
        if (event === 'step') {
          const idx = typeof data.index === 'number' ? data.index : 0;
          setLoadStep(idx + 1);
        } else if (event === 'draft') {
          received = true;
          const draft = data as unknown as SparkDraft;
          setSessionId(draft.session_id || sessionId);
          setDrafts(prev => (prev.some(d => d.draft_id === draft.draft_id) ? prev : [...prev, draft]));
          setActiveId(draft.draft_id);
          setPhase('ready');
        }
      }, controller.signal);
      if (!received) {
        setError('未收到生成结果，请重试');
        setPhase('ready');
      }
    } catch (e) {
      if (controller.signal.aborted) return; // 组件卸载/主动中止，无需更新状态
      setError(e instanceof Error ? e.message : '生成失败，请重试');
      setPhase('ready');
    }
  }

  useEffect(() => {
    runGenerate();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleReject() {
    if (!activeDraft) return;
    const newCount = rejectCount + 1;
    setRejectCount(newCount);
    setDrafts(prev => prev.map(d => (d.draft_id === activeDraft.draft_id ? { ...d, status: 'rejected' } : d)));
    try {
      await rejectSpark(activeDraft.draft_id, sessionId ?? sparkSessionId ?? '', {
        reject_count: newCount,
        directions: [],
        custom_direction: '',
      });
    } catch {
      /* 忽略：本地状态已标记为已拒 */
    }
    if (newCount >= 5) {
      setShowRejectModal(true);
      return;
    }
    await runGenerate();
  }

  async function handleAdopt() {
    if (!activeDraft || adopting) return;
    setAdopting(true);
    setError('');
    try {
      const res = await adoptSpark(activeDraft.draft_id, sessionId ?? sparkSessionId ?? '', projectName.trim() || defaultName);
      await loadProject(res.project_id);
      navigate('spark-adopt');
    } catch (e) {
      setError(e instanceof Error ? e.message : '采纳失败，请重试');
    } finally {
      setAdopting(false);
    }
  }

  async function handleDirectionRegen(keepRandom = false) {
    const dirs = keepRandom ? [] : rejectDirections;
    setShowRejectModal(false);
    setRejectCount(0);
    setRejectDirections([]);
    setCustomDirection('');
    await runGenerate(dirs, keepRandom ? '' : customDirection);
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Top nav (renders spark 4-step progress bar) */}
      <TopNav />

      <div style={{ paddingTop: '80px', paddingBottom: '72px' }}>
        <div className="max-w-6xl mx-auto px-6">
          {/* Back link */}
          <button onClick={() => navigate('spark3')} className="flex items-center gap-1.5 text-xs mb-4 hover:opacity-70" style={{ color: 'var(--color-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            返回参数设置
          </button>

          {phase !== 'ready' ? (
            <LoadingView loadStep={loadStep} params={p} regen={phase === 'regening'} />
          ) : error && !activeDraft ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">😵</div>
              <p className="text-sm mb-6" style={{ color: 'var(--color-danger)' }}>{error}</p>
              <button onClick={() => runGenerate()} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold">
                🔄 重试生成
              </button>
            </div>
          ) : activeDraft ? (
            <div className="flex gap-6">
              {/* LEFT: Draft package */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-5">
                  <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                    💡 灵感初稿包 #{activeDraft.draft_index}
                  </h2>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={
                    activeDraft.diff_validation
                      ? { backgroundColor: 'rgba(0,184,148,0.15)', color: '#00B894', border: '1px solid rgba(0,184,148,0.3)' }
                      : { backgroundColor: 'rgba(253,203,110,0.15)', color: '#FDCB6E', border: '1px solid rgba(253,203,110,0.3)' }
                  }>
                    {activeDraft.diff_validation ? '差异化验证通过 ✅' : '差异化需人工确认 ⚠️'}
                  </span>
                </div>

                {/* Module 1: High concept */}
                <DraftModule icon="🎬" title="高概念">
                  <blockquote
                    className="text-base font-medium leading-relaxed px-4 py-3 rounded-xl"
                    style={{ background: 'linear-gradient(135deg,rgba(108,92,231,0.08),rgba(9,132,227,0.08))', borderLeft: '3px solid var(--color-primary)', color: 'var(--color-text)' }}
                  >
                    "{activeDraft.high_concept}"
                  </blockquote>
                  <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>来源：{activeDraft.high_concept_source || 'KB 高概念库'}</p>
                </DraftModule>

                {/* Module 2: Characters */}
                <DraftModule icon="👤" title="人物原型">
                  <div className="space-y-3">
                    {activeDraft.characters.map((c, i) => (
                      <div key={`${activeDraft.draft_id}-${i}`} className="flex gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                        <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm" style={{ background: GRADIENT_PRESETS[(c.color_seed ?? i) % 3] }}>
                          {c.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{c.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: '#a29bfe' }}>{c.role}</span>
                          </div>
                          <p className="text-xs mb-1.5 leading-relaxed" style={{ color: 'var(--color-text)' }}>{c.description}</p>
                          {c.archetype && <p className="text-xs" style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>原型参照：{c.archetype}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </DraftModule>

                {/* Module 3: Emotion spine */}
                <DraftModule icon="💫" title="情感主轴">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {activeDraft.emotion_primary && (
                      <span className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: 'linear-gradient(135deg,#6C5CE7,#0984E3)', color: 'white' }}>{activeDraft.emotion_primary}</span>
                    )}
                    {activeDraft.emotion_secondary.map(e => (
                      <span key={e} className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: '#a29bfe', border: '1px solid rgba(108,92,231,0.3)' }}>{e}</span>
                    ))}
                    {activeDraft.emotion_aux.map(e => (
                      <span key={e} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>{e}</span>
                    ))}
                  </div>
                  {activeDraft.emotion_rhythm && <p className="text-xs" style={{ color: 'var(--color-muted)' }}>情感节奏：{activeDraft.emotion_rhythm}</p>}
                </DraftModule>

                {/* Module 4: Memory points */}
                <DraftModule icon="🔥" title="核心记忆点">
                  <div className="space-y-3">
                    {activeDraft.memories.map(m => (
                      <div key={m.num} className="flex gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg,#6C5CE7,#0984E3)', color: 'white' }}>{m.num}</div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{m.title}</div>
                          <p className="text-xs mb-1.5 leading-relaxed" style={{ color: 'var(--color-muted)' }}>{m.desc}</p>
                          {m.episode && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(253,203,110,0.15)', color: '#FDCB6E', border: '1px solid rgba(253,203,110,0.3)' }}>{m.episode}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </DraftModule>

                {/* Module 5: Risk list */}
                <DraftModule icon="⚠️" title="风险清单">
                  <div className="space-y-3">
                    {activeDraft.risks.map((r, i) => (
                      <div key={i} className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold">{RISK_LABELS[r.level] ?? r.level}</span>
                          <span className="text-xs" style={{ color: RISK_COLORS[r.level] ?? 'var(--color-muted)' }}>{r.desc}</span>
                        </div>
                        {r.mitigation && <p className="text-xs" style={{ color: '#00B894' }}>→ 规避：{r.mitigation}</p>}
                      </div>
                    ))}
                  </div>
                </DraftModule>
              </div>

              {/* RIGHT: Operation panel */}
              <div className="w-72 flex-shrink-0 space-y-4">
                {/* Status */}
                <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text)' }}>本次生成状态</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span style={{ color: 'var(--color-muted)' }}>差异化验证</span>
                      <span style={{ color: activeDraft.diff_validation ? '#00B894' : '#FDCB6E' }}>
                        {activeDraft.diff_validation ? '✅ 通过' : '⚠️ 待确认'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span style={{ color: 'var(--color-muted)' }}>新元素占比</span>
                      <span style={{ color: 'var(--color-text)' }}>{activeDraft.novelty_score ?? '—'}%</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span style={{ color: 'var(--color-muted)' }}>与历史相似度</span>
                      <span style={{ color: 'var(--color-text)' }}>{activeDraft.similarity_score ?? '—'}</span>
                    </div>
                    <div className="pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <p style={{ color: 'var(--color-muted)' }}>选用差异轴</p>
                      <p className="mt-1" style={{ color: '#a29bfe' }}>人物原型：{activeDraft.archetype || '—'}</p>
                      <p style={{ color: '#a29bfe' }}>情感主轴：{activeDraft.spine || '—'}</p>
                    </div>
                    <div className="text-xs pt-1" style={{ color: 'var(--color-muted)' }}>账本写入：待采纳后写入</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--color-muted)' }}>项目名称</label>
                    <input
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      maxLength={50}
                      className="w-full px-3 py-2 text-xs rounded-lg focus:outline-none"
                      style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                      onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
                    />
                  </div>
                  <button onClick={handleAdopt} disabled={adopting} className="w-full gradient-primary text-white text-sm py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    <span>✅</span> {adopting ? '采纳中…' : '采纳，进入创作'}
                  </button>
                  <button onClick={handleReject} className="w-full text-sm py-2.5 rounded-xl font-medium" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                    🔄 换一个灵感
                  </button>
                  <p className="text-xs text-center" style={{ color: 'var(--color-muted)' }}>下一个将自动避开本方案的人物原型和情感主轴</p>
                  {error && <p className="text-xs text-center" style={{ color: 'var(--color-danger)' }}>{error}</p>}
                </div>

                {/* Session history */}
                <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                    本次会话灵感（{drafts.length}）
                  </div>
                  <div className="space-y-2">
                    {drafts.map((d, i) => {
                      const isViewing = d.draft_id === activeDraft?.draft_id;
                      return (
                        <button
                          key={d.draft_id}
                          onClick={() => setActiveId(d.draft_id)}
                          className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg transition-all"
                          style={{
                            backgroundColor: isViewing ? 'rgba(108,92,231,0.12)' : 'var(--color-bg-elevated)',
                            border: `1px solid ${isViewing ? 'rgba(108,92,231,0.3)' : 'transparent'}`,
                          }}
                        >
                          <span style={{ color: isViewing ? '#a29bfe' : 'var(--color-muted)' }}>
                            #{i + 1} {isViewing ? '查看中' : d.status === 'rejected' ? '已拒绝' : ''}
                          </span>
                          {d.status === 'rejected' && !isViewing && (
                            <span className="text-xs opacity-60" style={{ color: 'var(--color-warning)' }}>点击可回看</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Saturation warning */}
                {rejectCount >= 3 && (
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(253,203,110,0.08)', border: '1px solid rgba(253,203,110,0.3)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#FDCB6E' }}>⚠️ 接近差异化容量上限</p>
                    <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>{p.genres.join('+')} 已换 {rejectCount} 次，建议扩展市场或切换题材组合</p>
                    <button onClick={() => navigate('spark2')} className="text-xs" style={{ color: '#74b9ff' }}>返回调整题材 →</button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-6 py-3 flex items-center justify-between" style={{ backgroundColor: 'rgba(26,26,46,0.95)', borderTop: '1px solid var(--color-border)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate('spark3')} className="text-sm px-4 py-2 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
          ← 返回参数设置
        </button>
        <button onClick={() => navigate('step1')} className="text-xs" style={{ color: 'var(--color-muted)' }}>
          放弃灵感，手动创建
        </button>
      </div>

      {/* 5× reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-2xl p-6 w-96" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text)' }}>已经换了 5 个啦！</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>告诉 AI 你具体想要什么不一样？</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {['更虐一点', '换男主原型', '换舞台/设定', '更甜的开局', '更强的女主'].map(d => (
                <button
                  key={d}
                  onClick={() => setRejectDirections(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={rejectDirections.includes(d)
                    ? { background: 'linear-gradient(135deg,#6C5CE7,#0984E3)', color: 'white' }
                    : { backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }
                  }
                >
                  {d}
                </button>
              ))}
            </div>
            <input
              value={customDirection}
              onChange={e => setCustomDirection(e.target.value)}
              placeholder="或描述你想要的方向…"
              className="w-full px-3 py-2 text-xs rounded-xl mb-4 focus:outline-none"
              style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
            <div className="flex gap-3">
              <button onClick={() => handleDirectionRegen(false)} className="flex-1 gradient-primary text-white text-sm py-2.5 rounded-xl font-semibold">
                按此方向再生
              </button>
              <button onClick={() => handleDirectionRegen(true)} className="text-sm px-4 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                继续随机换
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Loading view ── */
function LoadingView({ loadStep, params, regen = false }: { loadStep: number; params: { market: string; genres: string[]; dedupCycle: string; noveltyRatio: number; elementGrade: string; diffStrength: string }; regen?: boolean }) {
  const marketLabels: Record<string, string> = { global: '🌍 欧美', latam: '🌎 拉美', china: '🇨🇳 中国' };
  return (
    <div className="flex gap-6">
      <div className="flex-1 flex flex-col items-center justify-center py-20 rounded-2xl" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        {/* Spark spinner */}
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full animate-spin" style={{ background: 'conic-gradient(from 0deg, #6C5CE7, #0984E3, transparent)', WebkitMaskImage: 'radial-gradient(circle at center, transparent 56%, black 57%)' }} />
          <div className="absolute inset-2 rounded-full flex items-center justify-center text-3xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>✨</div>
        </div>
        <p className="text-base font-semibold mb-6 text-center" style={{ color: 'var(--color-text)' }}>
          {regen ? '正在避开已拒方案，重新挖掘差异化灵感…' : 'AI 正在从爆款素材库中为你挖掘灵感…'}
        </p>
        <div className="space-y-2 w-64">
          {LOAD_STEPS.map((s, i) => {
            const done = i < loadStep - 1;
            const active = i === loadStep - 1;
            return (
              <div key={s} className="flex items-center gap-3 text-xs">
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: done ? 'rgba(0,184,148,0.15)' : active ? 'rgba(108,92,231,0.2)' : 'var(--color-bg-elevated)' }}>
                  {done ? <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#00B894" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    : active ? <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-primary)' }} />
                    : null}
                </div>
                <span style={{ color: done ? '#00B894' : active ? 'var(--color-primary)' : 'var(--color-muted)' }}>
                  {done ? `✅ ${s}` : active ? `🔄 ${s}` : `⏳ ${s}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Right: param snapshot */}
      <div className="w-72 flex-shrink-0">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text)' }}>本次参数快照</div>
          <div className="space-y-2 text-xs">
            {[
              ['市场', marketLabels[params.market] ?? params.market],
              ['题材', params.genres.join(' + ') || '—'],
              ['去重周期', params.dedupCycle],
              ['新元素占比', `≥ ${params.noveltyRatio}%`],
              ['素材等级', params.elementGrade],
              ['差异化强度', params.diffStrength],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between">
                <span style={{ color: 'var(--color-muted)' }}>{k}</span>
                <span style={{ color: 'var(--color-text)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
