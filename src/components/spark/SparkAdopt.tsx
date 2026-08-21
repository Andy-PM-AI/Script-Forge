import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';

const ADOPT_STEPS = [
  { icon: '🎬', label: '写入剧名', detail: '生成并填充项目名称' },
  { icon: '🌍', label: '写入市场与题材', detail: '同步目标市场、题材标签' },
  { icon: '📐', label: '写入制作参数', detail: '集数、时长、语言设置已载入' },
  { icon: '👤', label: '写入人物设定', detail: '同步人物原型到角色列表' },
  { icon: '💫', label: '写入情感主轴与梗概', detail: '高概念注入故事梗概字段' },
  { icon: '✅', label: '数据准备完成', detail: '即将进入第一步' },
];

export default function SparkAdopt() {
  const { navigate } = useApp();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setStep(i);
      if (i >= ADOPT_STEPS.length) {
        clearInterval(interval);
        setTimeout(() => setDone(true), 400);
      }
    }, 420);
    return () => clearInterval(interval);
  }, []);

  // 动画完成后自动跳转第一步（按钮作为手动兜底）
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        navigate('step1');
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [done, navigate]);

  function goNext() {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigate('step1');
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'var(--color-bg-base)' }}
    >
      {/* Spark glow orb */}
      <div className="relative mb-8">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-4xl"
          style={{
            background: 'linear-gradient(135deg,rgba(108,92,231,0.2),rgba(9,132,227,0.2))',
            border: '2px solid rgba(108,92,231,0.4)',
            boxShadow: '0 0 40px rgba(108,92,231,0.3)',
          }}
        >
          {done ? '🚀' : '✨'}
        </div>
        {!done && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: 'rgba(108,92,231,0.15)' }}
          />
        )}
      </div>

      <h2 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--color-text)' }}>
        {done ? '灵感已就绪！' : '正在将灵感写入项目数据…'}
      </h2>
      <p className="text-sm mb-8 text-center" style={{ color: 'var(--color-muted)' }}>
        {done ? '所有字段已预填充，请在第一步复核后继续' : '项目设定将自动填充，请稍候'}
      </p>

      {/* Step checklist */}
      <div className="w-full max-w-xs space-y-3 mb-10">
        {ADOPT_STEPS.map((s, i) => {
          const isDone = i < step;
          const isActive = i === step - 1 && !done;
          return (
            <div
              key={s.label}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
              style={{
                backgroundColor: isDone ? 'rgba(0,184,148,0.08)' : isActive ? 'rgba(108,92,231,0.08)' : 'var(--color-bg-card)',
                border: `1px solid ${isDone ? 'rgba(0,184,148,0.25)' : isActive ? 'rgba(108,92,231,0.3)' : 'var(--color-border)'}`,
                opacity: i >= step && !isDone ? 0.5 : 1,
              }}
            >
              {/* Status icon */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: isDone ? 'rgba(0,184,148,0.2)' : isActive ? 'rgba(108,92,231,0.2)' : 'var(--color-bg-elevated)',
                }}
              >
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#00B894" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isActive ? (
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-primary)' }} />
                ) : (
                  <span className="text-xs">{s.icon}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold" style={{ color: isDone ? '#00B894' : isActive ? '#a29bfe' : 'var(--color-muted)' }}>
                  {s.label}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{s.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA — appears when done */}
      {done && (
        <button
          onClick={goNext}
          className="gradient-primary text-white text-base px-8 py-3 rounded-2xl font-semibold flex items-center gap-2"
          style={{ boxShadow: '0 8px 24px rgba(108,92,231,0.35)' }}
        >
          <span>✍️</span> 进入第一步：项目基础设定
        </button>
      )}
    </div>
  );
}
