import { useApp, View } from '../../context/AppContext';

interface SidebarItem {
  id: string;
  label: string;
  sub?: string;
}

function getItems(view: View): SidebarItem[] {
  switch (view) {
    case 'step2': return [
      { id: 'characters', label: '人物设定' },
      { id: 'background', label: '背景设定' },
      { id: 'storyline', label: '故事线' },
    ];
    default: return [];
  }
}

export default function Sidebar() {
  const { view, sidebarOpen, toggleSidebar } = useApp();
  const items = getItems(view);

  if (items.length === 0) return null;

  return (
    <aside
      className="flex-shrink-0 flex flex-col transition-all duration-200 overflow-hidden"
      style={{
        width: sidebarOpen ? '220px' : '52px',
        borderRight: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-card)',
      }}
    >
      <div className="flex-1 overflow-y-auto pt-4 pb-4">
        {items.map(item => (
          <div
            key={item.id}
            className="px-3 py-2.5 mx-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
            style={{ backgroundColor: 'transparent' }}
          >
            {sidebarOpen ? (
              <>
                <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{item.label}</div>
                {item.sub && <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{item.sub}</div>}
              </>
            ) : (
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-muted)' }}
              >
                {item.id.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 w-full transition-opacity hover:opacity-70"
        style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="transition-transform duration-200"
          style={{ transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
        >
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
    </aside>
  );
}
