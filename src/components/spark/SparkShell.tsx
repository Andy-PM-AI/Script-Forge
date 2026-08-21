import { ReactNode } from 'react';
import TopNav from '../ui/TopNav';
import { useApp } from '../../context/AppContext';

interface Props {
  children: ReactNode;
  maxWidth?: string;
}

export default function SparkShell({ children, maxWidth = '800px' }: Props) {
  const { navigate } = useApp();

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <TopNav />
      <div style={{ paddingTop: '64px' }}>
        {/* Back link */}
        <div className="max-w-4xl mx-auto px-6 pt-5">
          <button
            onClick={() => navigate('home')}
            className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            返回首页
          </button>
        </div>
        <div className="mx-auto px-6 py-6" style={{ maxWidth }}>
          {children}
        </div>
      </div>
    </div>
  );
}
