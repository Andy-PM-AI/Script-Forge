import SparkShell from './SparkShell';
import SegmentedControl from '../ui/SegmentedControl';
import { useApp } from '../../context/AppContext';

const MARKETS = [
  { value: 'global', label: '欧美', icon: '🌍', desc: '北美、欧洲市场，英文 romance 为主', kb: '约 470 本' },
  { value: 'latam',  label: '拉美', icon: '🌎', desc: '巴西、墨西哥等西/葡语市场', kb: '约 280 本' },
  { value: 'china',  label: '中国', icon: '🇨🇳', desc: '中国大陆市场，中文短剧', kb: '约 250 本' },
];

const EPISODE_OPTIONS = [20, 30, 40, 50, 60, 70, 80, 90, 100].map(n => ({ label: String(n), value: n }));

const inputStyle = {
  backgroundColor: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
  borderRadius: '8px',
};

const labelStyle = { color: 'var(--color-text)', fontWeight: '600', fontSize: '13px' };
const hintStyle = { color: 'var(--color-muted)', fontSize: '11px' };

export default function SparkStep1Market() {
  const { navigate, sparkParams, setSparkParams } = useApp();
  const { market, episodes, duration, scriptLanguage, dialogueLanguage } = sparkParams;

  return (
    <SparkShell maxWidth="760px">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>选择目标市场</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>市场决定素材库的检索范围和去重维度</p>
      </div>

      <div className="space-y-8">
        {/* Market cards */}
        <div>
          <label className="block mb-3" style={labelStyle}>市场地区 *</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {MARKETS.map(m => {
              const isSelected = market === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setSparkParams({ market: m.value })}
                  className="text-left rounded-2xl p-5 transition-all hover:-translate-y-0.5 relative"
                  style={{
                    backgroundColor: isSelected ? 'rgba(108,92,231,0.08)' : 'var(--color-bg-card)',
                    border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    boxShadow: isSelected ? '0 0 16px rgba(108,92,231,0.15)' : 'none',
                  }}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6C5CE7,#0984E3)' }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                  <div className="text-3xl mb-3">{m.icon}</div>
                  <div className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text)' }}>{m.label}</div>
                  <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--color-muted)' }}>{m.desc}</p>
                  <div className="text-xs px-2 py-1 rounded-lg inline-block" style={{ backgroundColor: 'rgba(108,92,231,0.12)', color: '#a29bfe' }}>
                    📚 KB 素材：{m.kb}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Episodes */}
        <div>
          <label className="block mb-3" style={labelStyle}>全剧集数 *</label>
          <SegmentedControl
            options={EPISODE_OPTIONS}
            value={episodes}
            onChange={v => setSparkParams({ episodes: Number(v) })}
          />
          {episodes <= 40 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--color-warning)' }}>
              ⚡ ≤ 40 集时，分段粗纲和分集粗纲步骤将跳过
            </p>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="block mb-2" style={labelStyle}>全剧时长</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={duration}
              onChange={e => setSparkParams({ duration: Number(e.target.value) || 80 })}
              className="w-28 px-3 py-2 text-sm focus:outline-none"
              style={inputStyle}
              min="1"
            />
            <span className="text-sm" style={{ color: 'var(--color-muted)' }}>分钟</span>
          </div>
          <p className="mt-1" style={hintStyle}>建议单集 1–2 分钟</p>
        </div>

        {/* Languages */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block mb-2" style={labelStyle}>剧本语言</label>
            <div className="flex gap-2">
              {[{ v: 'zh', l: '中文' }, { v: 'en', l: '英文' }].map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setSparkParams({ scriptLanguage: o.v as 'zh' | 'en' })}
                  className="flex-1 py-2 text-xs rounded-lg transition-all"
                  style={scriptLanguage === o.v
                    ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }
                    : { ...inputStyle }}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <p className="mt-1" style={hintStyle}>剧本非台词部分使用的语言</p>
          </div>
          <div>
            <label className="block mb-2" style={labelStyle}>台词语言</label>
            <div className="flex gap-1.5">
              {[{ v: 'zh', l: '中文' }, { v: 'en-zh', l: '英主中辅' }, { v: 'en', l: '英文' }].map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setSparkParams({ dialogueLanguage: o.v as 'zh' | 'en-zh' | 'en' })}
                  className="flex-1 py-2 text-xs rounded-lg transition-all"
                  style={dialogueLanguage === o.v
                    ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }
                    : { ...inputStyle }}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <p className="mt-1" style={hintStyle}>英主中辅 = 英文为主，括号标注中文</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-10 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={() => navigate('home')}
          className="text-sm px-4 py-2.5 rounded-xl"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
        >
          ← 返回首页
        </button>
        <button
          onClick={() => navigate('spark2')}
          disabled={!market}
          className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold disabled:opacity-40"
        >
          下一步：选择题材 →
        </button>
      </div>
    </SparkShell>
  );
}
