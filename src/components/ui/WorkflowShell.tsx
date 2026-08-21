import { ReactNode } from 'react';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import RightPanel from './RightPanel';

interface Props {
  children: ReactNode;
  fullHeight?: boolean;
  hideRightPanel?: boolean;
}

export default function WorkflowShell({ children, fullHeight, hideRightPanel }: Props) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <TopNav />
      <div className="flex flex-1 overflow-hidden" style={{ paddingTop: '64px' }}>
        <Sidebar />
        <main
          className={`flex-1 ${fullHeight ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}
          style={{ backgroundColor: 'var(--color-bg-base)' }}
        >
          {fullHeight ? (
            children
          ) : (
            <div className="max-w-5xl mx-auto px-6 py-8">
              {children}
            </div>
          )}
        </main>
        {!hideRightPanel && <RightPanel />}
      </div>
    </div>
  );
}
