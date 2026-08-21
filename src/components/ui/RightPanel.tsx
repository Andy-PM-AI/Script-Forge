import { useApp } from '../../context/AppContext';

export default function RightPanel() {
  const { rightPanelOpen, toggleRightPanel, aiFeedback, setAiFeedback, aiHistory, clearHistory, addHistory } = useApp();

  function handleSubmit() {
    if (!aiFeedback.trim()) return;
    addHistory(aiFeedback.trim());
    setAiFeedback('');
  }

  return (
    <div className="flex flex-shrink-0">
      {/* Toggle handle */}
      {!rightPanelOpen && (
        <button
          onClick={toggleRightPanel}
          className="w-6 flex items-center justify-center my-auto h-16 rounded-l-lg transition-opacity hover:opacity-70"
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRight: 'none', color: 'var(--color-muted)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      )}

      <div
        className="flex flex-col overflow-hidden transition-all duration-200"
        style={{
          width: rightPanelOpen ? '300px' : '0px',
          borderLeft: rightPanelOpen ? '1px solid var(--color-border)' : 'none',
          backgroundColor: 'var(--color-bg-card)',
        }}
      >
        {rightPanelOpen && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>AI 修改意见</span>
              <button onClick={toggleRightPanel} className="hover:opacity-70" style={{ color: 'var(--color-muted)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18 6-6-6-6" transform="rotate(180 12 12)"/>
                </svg>
              </button>
            </div>

            {/* Feedback input */}
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <textarea
                value={aiFeedback}
                onChange={e => setAiFeedback(e.target.value)}
                placeholder="输入修改方向，如：让女主更强势一些…"
                rows={4}
                className="w-full text-xs resize-none focus:outline-none rounded-lg p-3"
                style={{
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-mono)',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
              />
              <button
                onClick={handleSubmit}
                disabled={!aiFeedback.trim()}
                className="mt-2 w-full gradient-primary text-white text-xs py-2 rounded-lg font-medium disabled:opacity-40"
              >
                提交修改
              </button>
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>AI 将根据你的意见重新生成该部分内容</p>
            </div>

            {/* History */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>操作历史</span>
                {aiHistory.length > 0 && (
                  <button onClick={clearHistory} className="text-xs hover:opacity-70" style={{ color: 'var(--color-muted)' }}>清除</button>
                )}
              </div>
              {aiHistory.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--color-muted-dark)' }}>暂无操作记录</p>
              ) : (
                <div className="space-y-2">
                  {aiHistory.map(h => (
                    <div key={h.id} className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text)' }}>{h.text}</p>
                      <span className="text-xs mt-1 block" style={{ color: 'var(--color-muted-dark)' }}>{h.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
