import { useState, type KeyboardEvent } from 'react';

interface Props {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function GenreTagCloud({ options, selected, onChange }: Props) {
  const [customInput, setCustomInput] = useState('');

  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter(t => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  }

  function deselect(tag: string) {
    onChange(selected.filter(t => t !== tag));
  }

  function addCustom() {
    const tag = customInput.trim();
    if (!tag || selected.includes(tag)) {
      setCustomInput('');
      return;
    }
    onChange([...selected, tag]);
    setCustomInput('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustom();
    }
  }

  // 不在预设列表中的标签视为自定义标签，单独展示。
  const customTags = selected.filter(t => !options.includes(t));

  return (
    <div className="space-y-3">
      {/* 预设题材标签 */}
      <div className="flex flex-wrap gap-2">
        {options.map(tag => {
          const isSelected = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={
                isSelected
                  ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }
                  : { backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }
              }
            >
              {tag}
              {isSelected && (
                <span
                  onClick={e => { e.stopPropagation(); deselect(tag); }}
                  className="flex items-center justify-center w-3.5 h-3.5 rounded-full ml-0.5 hover:bg-white/30 transition-colors"
                  style={{ lineHeight: 1 }}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 自定义题材标签 */}
      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customTags.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }}
            >
              {tag}
              <button
                type="button"
                onClick={() => deselect(tag)}
                className="flex items-center justify-center w-3.5 h-3.5 rounded-full ml-0.5 hover:bg-white/30 transition-colors"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 自定义输入 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="自定义题材，按 Enter 添加…"
          maxLength={20}
          className="flex-1 px-3 py-1.5 text-xs rounded-full focus:outline-none"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }}
        >
          添加
        </button>
      </div>
    </div>
  );
}
