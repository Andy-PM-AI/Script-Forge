import { useState, ReactNode } from 'react';
import SkeletonLoader from './SkeletonLoader';

interface Props {
  title: string;
  content: string | ReactNode;
  isLoading?: boolean;
  onRegenerate?: () => void;
  showRegenerate?: boolean;
  onSave?: (text: string) => void;
  className?: string;
}

export default function AIContentBlock({ title, content, isLoading = false, onRegenerate, showRegenerate = true, onSave, className = '' }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saved, setSaved] = useState(false);
  const originalContent = typeof content === 'string' ? content : '';

  function startEdit() {
    setEditValue(originalContent);
    setIsEditing(true);
  }

  function handleSave() {
    onSave?.(editValue);
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div
      className={`gradient-border-left rounded-xl pl-5 pr-5 py-5 ${className}`}
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderLeft: 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{title}</h3>
        <div className="flex items-center gap-1">
          {saved && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--color-success)', backgroundColor: 'rgba(0,184,148,0.1)' }}>
              已保存
            </span>
          )}
          {showRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isLoading}
              title="重新生成"
              className="p-1.5 rounded-lg transition-colors hover:opacity-80 disabled:opacity-40"
              style={{ color: 'var(--color-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
          )}
          <button
            onClick={isEditing ? () => setIsEditing(false) : startEdit}
            title={isEditing ? '取消编辑' : '编辑'}
            className="p-1.5 rounded-lg transition-colors hover:opacity-80"
            style={{ color: isEditing ? 'var(--color-primary)' : 'var(--color-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            onClick={() => { setIsEditing(false); }}
            title="恢复AI结果"
            className="p-1.5 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--color-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10"/>
              <path d="M12 6v6l4 2"/>
              <path d="M22 12l-2-2-2 2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <SkeletonLoader lines={5} />
      ) : isEditing ? (
        <div>
          <textarea
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            rows={8}
            className="w-full rounded-lg p-3 text-sm resize-none focus:outline-none"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-primary)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              className="gradient-primary text-white text-xs px-3 py-1.5 rounded-lg font-medium"
            >
              保存
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
          {content}
        </div>
      )}
    </div>
  );
}
