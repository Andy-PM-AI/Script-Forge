import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  initialPrompt?: string;
  defaultPrompt?: string;
}

export default function PromptEditorModal({ isOpen, onClose, title = '编辑提示词模板', initialPrompt = '', defaultPrompt = '' }: Props) {
  const [value, setValue] = useState(initialPrompt);

  useEffect(() => {
    if (isOpen) setValue(initialPrompt);
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col"
        style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-muted)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-2 text-xs" style={{ color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          变量占位符：
          {['{市场地区}', '{故事题材}', '{集数}', '{人物名}', '{故事梗概}'].map(v => (
            <span key={v} className="inline-block mx-1 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: '#a29bfe' }}>{v}</span>
          ))}
        </div>

        <div className="flex-1 overflow-hidden px-6 py-4">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full h-full min-h-[300px] rounded-xl p-4 text-sm resize-none focus:outline-none"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.7,
            }}
            spellCheck={false}
          />
        </div>

        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setValue(defaultPrompt)}
            className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
          >
            恢复默认
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: 'var(--color-muted)' }}>
              取消
            </button>
            <button
              onClick={onClose}
              className="gradient-primary text-white text-sm px-5 py-2 rounded-lg font-medium"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
