import { GRADIENT_PRESETS } from '../../data/mockData';
import { useApp, continueView } from '../../context/AppContext';
import type { Project } from '../../api/types';

interface Props {
  project: Project;
  onDelete?: (id: string) => void;
}

const STEP_LABELS = ['', '项目设定', '人物故事', '分段粗纲', '分集粗纲', '分集脚本', '分镜脚本', '已完成'];

const MARKET_LABELS: Record<string, string> = {
  china: '中国',
  global: '欧美',
  latam: '拉美',
};

export default function ProjectCard({ project, onDelete }: Props) {
  const { navigate, loadProject } = useApp();

  function open() {
    const target = continueView(project);
    loadProject(project.id).then(() => navigate(target));
  }

  const step = Math.max(1, Math.min(7, project.current_step));
  const lastEdited = (project.updated_at ?? '').slice(0, 10);

  return (
    <div
      className="rounded-xl overflow-hidden group cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl"
      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      onClick={open}
    >
      {/* Thumbnail */}
      <div
        className="h-32 relative flex items-end p-3"
        style={{ background: GRADIENT_PRESETS[project.color_seed % GRADIENT_PRESETS.length] }}
      >
        <div className="flex gap-1.5 flex-wrap">
          {project.genres.slice(0, 2).map(g => (
            <span key={g} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
              {g}
            </span>
          ))}
        </div>
        {/* Delete button (hover) */}
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(project.id); }}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            title="删除项目"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <span className="text-white text-sm font-semibold bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">继续编辑</span>
        </div>
      </div>

      <div className="p-4">
        <div className="font-semibold text-sm mb-1 line-clamp-2" style={{ color: 'var(--color-text)' }}>{project.name}</div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: '#a29bfe' }}>{MARKET_LABELS[project.market] ?? project.market}</span>
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{project.episodes} 集</span>
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>当前：{STEP_LABELS[step]}</span>
        </div>

        {/* Progress bar */}
        <div className="rounded-full h-1.5 mb-2" style={{ backgroundColor: 'var(--color-border)' }}>
          <div
            className="h-full rounded-full gradient-primary transition-all"
            style={{ width: `${project.progress}%` }}
          />
        </div>
        <div className="text-xs" style={{ color: 'var(--color-muted)' }}>最后编辑：{lastEdited}</div>
      </div>
    </div>
  );
}
