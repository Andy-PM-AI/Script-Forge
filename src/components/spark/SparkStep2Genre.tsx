import { useState, useEffect } from 'react';
import SparkShell from './SparkShell';
import { useApp } from '../../context/AppContext';
import { getKbCapacity, type KbCapacity } from '../../api/spark';

const MARKET_LABELS: Record<string, string> = { global: '🌍 欧美', latam: '🌎 拉美', china: '🇨🇳 中国' };

const GENRE_GROUPS = [
  { label: '情感类', tags: ['虐恋', '甜宠', '先婚后爱', '追妻火葬场', '闪婚契约', '虐恋情深'] },
  { label: '身份类', tags: ['豪门', '霸总', '隐藏身份', '身份互换', '赘婿', '真假千金', '替身/白月光'] },
  { label: '奇幻类', tags: ['狼人Alpha', '吸血鬼', '重生', '穿越', '修仙玄幻', '系统流'] },
  { label: '剧情类', tags: ['复仇', '逆袭', '权谋', '历史古代', '战神/龙王'] },
  { label: '生活类', tags: ['校园', '职场', '萌宝', '大女主', '女帝/王妃', 'LGBT'] },
];

function KBCapacity({ market, genres }: { market: string; genres: string[] }) {
  const [capacity, setCapacity] = useState<KbCapacity | null>(null);

  useEffect(() => {
    if (!market || genres.length === 0) { setCapacity(null); return; }
    let cancelled = false;
    getKbCapacity(market, genres, 'SA')
      .then(res => { if (!cancelled) setCapacity(res); })
      .catch(() => { if (!cancelled) setCapacity(null); });
    return () => { cancelled = true; };
  }, [market, genres.join(',')]);

  if (genres.length === 0) return null;

  const level = capacity?.capacity_level ?? 'ok';
  const colors = { ok: '#00B894', warn: '#FDCB6E', danger: '#E17055' } as const;
  const color = colors[level];
  const msgs: Record<string, string> = {
    ok: '✅ 素材充足，可支撑多次差异化生成',
    warn: '⚡ 素材一般，建议添加关联题材以扩池',
    danger: '⚠️ 该组合素材较少，建议添加扩展市场或关联题材以扩池',
  };
  const novels = capacity?.novel_count ?? '—';
  const archetypes = capacity?.archetype_count ?? '—';
  const slots = capacity?.estimated_diff_slots ?? '—';
  const barWidth = capacity ? Math.min(100, capacity.estimated_diff_slots * 10) : 0;

  return (
    <div className="rounded-xl p-4 mt-6" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>📊 素材库容量</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-muted)' }}>
          {genres.join(' + ')}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-3">
        {[
          { label: 'KB 匹配小说', value: `${novels} 本` },
          { label: '可用人物原型', value: `${archetypes} 种` },
          { label: '预计差异化空间', value: `${slots} 个` },
        ].map(s => (
          <div key={s.label}>
            <div className="text-sm font-bold" style={{ color }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="h-1.5 rounded-full mb-2" style={{ backgroundColor: 'var(--color-border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: color }} />
      </div>
      <p className="text-xs" style={{ color }}>{msgs[level]}</p>
    </div>
  );
}

export default function SparkStep2Genre() {
  const { navigate, sparkParams, setSparkParams } = useApp();
  const [customInput, setCustomInput] = useState('');

  const market = sparkParams.market;
  const selected = sparkParams.genres;

  function toggle(tag: string) {
    setSparkParams({ genres: selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag] });
  }

  function addCustom() {
    const t = customInput.trim();
    if (!t || selected.includes(t)) { setCustomInput(''); return; }
    setSparkParams({ genres: [...selected, t] });
    setCustomInput('');
  }

  return (
    <SparkShell maxWidth="860px">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>选择故事题材</h1>
        <p className="text-sm mb-3" style={{ color: 'var(--color-muted)' }}>可叠加多个题材，如「狼人Alpha + 复仇」</p>
        {market && (
          <button
            onClick={() => navigate('spark1')}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full hover:opacity-80"
            style={{ backgroundColor: 'rgba(108,92,231,0.12)', color: '#a29bfe', border: '1px solid rgba(108,92,231,0.25)' }}
          >
            目标市场：{MARKET_LABELS[market]}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        )}
      </div>

      {/* Selected summary */}
      {selected.length > 0 && (
        <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-2 flex-wrap" style={{ backgroundColor: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.2)' }}>
          <span className="text-xs font-semibold" style={{ color: '#a29bfe' }}>已选：</span>
          {selected.map(t => (
            <span key={t} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: 'linear-gradient(135deg,#6C5CE7,#0984E3)', color: 'white' }}>
              {t}
              <button onClick={() => toggle(t)} className="hover:opacity-70 ml-0.5">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Genre groups */}
      <div className="space-y-5 mb-4">
        {GENRE_GROUPS.map(group => (
          <div key={group.label}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>{group.label}</div>
            <div className="flex flex-wrap gap-2">
              {group.tags.map(tag => {
                const on = selected.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggle(tag)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={on
                      ? { background: 'linear-gradient(135deg,#6C5CE7,#0984E3)', color: 'white' }
                      : { backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Custom input */}
      <div className="flex items-center gap-2 mb-2">
        <input
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder="或输入自定义题材描述，如「狼人Alpha女主复仇」"
          maxLength={30}
          className="flex-1 px-3 py-2 text-xs rounded-xl focus:outline-none"
          style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
        />
        <button
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="px-4 py-2 rounded-xl text-xs font-semibold gradient-primary text-white disabled:opacity-40"
        >
          添加
        </button>
      </div>
      <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>系统会自动归一化匹配 KB 标签，低置信度题材将走关联扩池</p>

      <KBCapacity market={market} genres={selected} />

      {/* Footer */}
      <div className="flex items-center justify-between mt-8 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={() => navigate('spark1')}
          className="text-sm px-4 py-2.5 rounded-xl"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
        >
          ← 上一步
        </button>
        <button
          onClick={() => navigate('spark3')}
          disabled={selected.length === 0}
          className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold disabled:opacity-40"
        >
          下一步：参数设置 →
        </button>
      </div>
    </SparkShell>
  );
}
