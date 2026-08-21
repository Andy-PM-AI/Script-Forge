import { useState, type ReactNode } from 'react';
import SparkShell from './SparkShell';
import { useApp, type SparkParams } from '../../context/AppContext';

const MARKET_LABELS: Record<string, string> = { global: '🌍 欧美', latam: '🌎 拉美', china: '🇨🇳 中国' };

const DEDUP_OPTIONS = [
  { value: 'session', label: '仅本次会话', hint: '适合系列化创作，保持家族相似感' },
  { value: '7d',      label: '近 7 天',    hint: '回避最近一周内已生成的作品' },
  { value: '30d',     label: '近 30 天',   hint: '回避近期已生成的作品' },
  { value: '90d',     label: '近 90 天',   hint: '推荐默认值，平衡防重与创作自由' },
  { value: '180d',    label: '近 180 天',  hint: '更长窗口，更激进的防重复' },
  { value: 'all',     label: '全部历史',   hint: '最大程度避免与过往作品撞车' },
];

const GRADE_OPTIONS = [
  { value: 'S',   label: '仅 S 级',      desc: '最高爆款验证，最稳',        data: '约占 KB 40%' },
  { value: 'SA',  label: 'S + A 级',     desc: '高质量与多样性平衡',        data: '约占 KB 75%', recommended: true },
  { value: 'SAB', label: 'S + A + B 级', desc: '更大选择空间，含潜力元素',  data: '约占 KB 99%' },
];

const STRENGTH_OPTIONS = [
  { value: 'high',   icon: '🔀', label: '高（最大散开）', desc: '各轴最少使用优先，任意两本人物原型+情感主轴不重复', tip: '铺量生产，每本都要明显不同' },
  { value: 'medium', icon: '⚖️', label: '中（默认）',     desc: '允许共享情感主轴，但人物原型必须不同',             tip: '同题材下保持情感调性，但换人物' },
  { value: 'low',    icon: '🔗', label: '低 / 系列化',    desc: '刻意复用已验证组合，作为同一宇宙/续作',           tip: '打造系列 IP，保持家族相似感' },
];

function noveltyColor(v: number) {
  if (v <= 60) return '#FDCB6E';
  if (v <= 80) return '#00B894';
  return '#0984E3';
}
function noveltyMsg(v: number) {
  if (v <= 60) return { text: '允许较多复用，适合续作/系列化', color: '#FDCB6E' };
  if (v <= 80) return { text: '平衡创新与成熟度，推荐', color: '#00B894' };
  return { text: '高度创新，可能产生未验证的结构', color: '#0984E3' };
}

export default function SparkStep3Params() {
  const { navigate, sparkParams, setSparkParams, resetSparkParams } = useApp();
  const [showSnapshot, setShowSnapshot] = useState(false);

  const p = sparkParams;
  const dedupHint = DEDUP_OPTIONS.find(o => o.value === p.dedupCycle)?.hint ?? '';
  const noveltyInfo = noveltyMsg(p.noveltyRatio);

  const snapshot = {
    market: MARKET_LABELS[p.market] ?? p.market,
    genres: p.genres.join(' + '),
    dedup_cycle: p.dedupCycle,
    novelty_ratio: `≥ ${p.noveltyRatio}%`,
    element_grade: p.elementGrade,
    diff_strength: p.diffStrength,
  };

  return (
    <SparkShell maxWidth="860px">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>调整生成参数</h1>
        <p className="text-sm mb-3" style={{ color: 'var(--color-muted)' }}>控制创意的差异化程度和素材质量门槛</p>
        <button
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full cursor-pointer hover:opacity-80"
          style={{ backgroundColor: 'rgba(108,92,231,0.12)', color: '#a29bfe', border: '1px solid rgba(108,92,231,0.25)' }}
          onClick={() => navigate('spark1')}
        >
          {MARKET_LABELS[p.market]} · {p.genres.join(' + ') || '（未选题材）'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Param 1: Dedup cycle */}
        <ParamCard
          icon="🕐"
          title="去重周期"
          value={DEDUP_OPTIONS.find(o => o.value === p.dedupCycle)?.label ?? ''}
          desc={'回溯多久内的已生成作品作为"避免重复"的参考。窗口越大，防重复越激进。'}
        >
          <div className="flex gap-2 flex-wrap mb-2">
            {DEDUP_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setSparkParams({ dedupCycle: o.value as SparkParams['dedupCycle'] })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={p.dedupCycle === o.value
                  ? { background: 'linear-gradient(135deg,#6C5CE7,#0984E3)', color: 'white' }
                  : { backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }
                }
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{dedupHint}</p>
        </ParamCard>

        {/* Param 2: Novelty ratio */}
        <ParamCard
          icon="🆕"
          title="新元素占比"
          value={`≥ ${p.noveltyRatio}%`}
          desc="本次生成中，不得与去重周期内已用元素重复的新元素最低比例。越高越创新，但可能牺牲成熟度。"
        >
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
              <span>40%（保守）</span>
              <span>100%（全新）</span>
            </div>
            <div className="relative h-5 flex items-center">
              <div className="absolute inset-x-0 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg,#FDCB6E,#00B894,#0984E3)' }} />
              <input
                type="range"
                min={40} max={100} step={5}
                value={p.noveltyRatio}
                onChange={e => setSparkParams({ noveltyRatio: Number(e.target.value) })}
                className="relative w-full appearance-none bg-transparent cursor-pointer"
                style={{ WebkitAppearance: 'none', height: '6px' }}
              />
            </div>
          </div>
          <div className="text-xs px-2 py-1 rounded-lg inline-block" style={{ backgroundColor: `${noveltyColor(p.noveltyRatio)}22`, color: noveltyInfo.color, border: `1px solid ${noveltyInfo.color}44` }}>
            {noveltyInfo.text}
          </div>
        </ParamCard>

        {/* Param 3: Element grade */}
        <ParamCard
          icon="⭐"
          title="素材等级门槛"
          value={GRADE_OPTIONS.find(o => o.value === p.elementGrade)?.label ?? ''}
          desc="只召回 KB 中哪个等级及以上的爆款验证元素。等级越高质量越稳，但可选范围越小。"
        >
          <div className="grid grid-cols-3 gap-3">
            {GRADE_OPTIONS.map(g => {
              const on = p.elementGrade === g.value;
              return (
                <button
                  key={g.value}
                  onClick={() => setSparkParams({ elementGrade: g.value as SparkParams['elementGrade'] })}
                  className="text-left rounded-xl p-3 relative transition-all"
                  style={{
                    backgroundColor: on ? 'rgba(108,92,231,0.08)' : 'var(--color-bg-base)',
                    border: `1.5px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}
                >
                  {g.recommended && (
                    <div className="absolute -top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'linear-gradient(135deg,#6C5CE7,#0984E3)', color: 'white', fontSize: '9px' }}>推荐</div>
                  )}
                  <div className="text-xs font-semibold mb-1" style={{ color: on ? '#a29bfe' : 'var(--color-text)' }}>{g.label}</div>
                  <div className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>{g.desc}</div>
                  <div className="text-xs font-medium" style={{ color: on ? '#a29bfe' : 'var(--color-muted)' }}>{g.data}</div>
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>C 级为噪声级，始终排除</p>
        </ParamCard>

        {/* Param 4: Diff strength */}
        <ParamCard
          icon="🎯"
          title="差异化强度"
          value={STRENGTH_OPTIONS.find(o => o.value === p.diffStrength)?.label ?? ''}
          desc="控制各差异轴（人物原型、情感主轴、钩子序列、设定载体）的散开程度。"
        >
          <div className="grid grid-cols-3 gap-3">
            {STRENGTH_OPTIONS.map(s => {
              const on = p.diffStrength === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => setSparkParams({ diffStrength: s.value as SparkParams['diffStrength'] })}
                  className="text-left rounded-xl p-3 transition-all"
                  style={{
                    backgroundColor: on ? 'rgba(108,92,231,0.08)' : 'var(--color-bg-base)',
                    border: `1.5px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderLeft: on ? '3px solid var(--color-primary)' : `1.5px solid var(--color-border)`,
                  }}
                >
                  <div className="text-lg mb-1">{s.icon}</div>
                  <div className="text-xs font-semibold mb-1" style={{ color: on ? '#a29bfe' : 'var(--color-text)' }}>{s.label}</div>
                  <div className="text-xs mb-1 leading-relaxed" style={{ color: 'var(--color-muted)' }}>{s.desc}</div>
                  <div className="text-xs" style={{ color: on ? '#74b9ff' : 'var(--color-muted)', fontStyle: 'italic' }}>{s.tip}</div>
                </button>
              );
            })}
          </div>
        </ParamCard>
      </div>

      {/* Snapshot */}
      <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setShowSnapshot(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-muted)' }}
        >
          <span>📋 参数快照</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showSnapshot ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {showSnapshot && (
          <div className="px-4 pb-4 pt-3" style={{ backgroundColor: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border)' }}>
            <pre className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <p className="text-xs text-center mb-4" style={{ color: 'var(--color-muted)' }}>将从 KB 检索并生成差异化初稿包，约需 10–20 秒</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => navigate('spark2')} className="text-sm px-4 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
              ← 上一步
            </button>
            <button onClick={resetSparkParams} className="text-sm px-4 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
              恢复默认参数
            </button>
          </div>
          <button onClick={() => navigate('spark4')} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2">
            <span>✨</span> 生成灵感 →
          </button>
        </div>
      </div>
    </SparkShell>
  );
}

function ParamCard({ icon, title, value, desc, children }: { icon: string; title: string; value: string; desc: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{title}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(108,92,231,0.12)', color: '#a29bfe' }}>{value}</span>
      </div>
      <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--color-muted)' }}>{desc}</p>
      {children}
    </div>
  );
}
