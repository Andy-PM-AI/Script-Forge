import { useEffect, useState } from 'react';
import TopNav from '../ui/TopNav';
import ProjectCard from '../ui/ProjectCard';
import { useApp, continueView } from '../../context/AppContext';
import type { Project } from '../../api/types';
import * as projectsApi from '../../api/projects';

const STEP_LABELS = ['', '项目设定', '人物故事', '分段粗纲', '分集粗纲', '分集脚本', '分镜脚本', '已完成'];

const MARKET_LABELS: Record<string, string> = {
  china: '中国',
  global: '欧美',
  latam: '拉美',
};

export default function ProjectsView() {
  const { navigate, startNewProject, loadProject, deleteProject } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [marketFilter, setMarketFilter] = useState('all');
  const [sort, setSort] = useState('edited');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    projectsApi.listProjects({ limit: 50 })
      .then(res => { if (!cancelled) setProjects(res.items); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (marketFilter !== 'all' && p.market !== marketFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'zh');
    if (sort === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  function open(p: Project) {
    const target = continueView(p);
    loadProject(p.id).then(() => navigate(target));
  }

  const confirmTarget = projects.find(p => p.id === confirmId);

  function requestDelete(id: string) {
    setConfirmId(id);
  }

  async function confirmDelete() {
    if (!confirmId) return;
    const snapshot = projects;
    setProjects(prev => prev.filter(p => p.id !== confirmId));
    setConfirmId(null);
    try {
      await deleteProject(confirmId);
    } catch {
      setProjects(snapshot);
      alert('删除失败，请稍后重试');
    }
  }

  const inputStyle = {
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    borderRadius: '8px',
    fontSize: '13px',
  };

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <TopNav />
      <div style={{ paddingTop: '64px' }}>
        <div className="max-w-6xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>我的项目</h1>
            <button onClick={startNewProject} className="gradient-primary text-white text-sm px-5 py-2.5 rounded-xl font-semibold">
              + 新建项目
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索项目名…"
              className="px-3 py-2 focus:outline-none"
              style={{ ...inputStyle, width: '200px' }}
              onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
            />
            <select value={marketFilter} onChange={e => setMarketFilter(e.target.value)} className="px-3 py-2 focus:outline-none" style={inputStyle}>
              <option value="all">全部市场</option>
              <option value="china">中国</option>
              <option value="global">欧美</option>
              <option value="latam">拉美</option>
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-2 focus:outline-none" style={inputStyle}>
              <option value="edited">最近编辑</option>
              <option value="created">创建时间</option>
              <option value="name">名称</option>
            </select>
            <div className="ml-auto flex gap-1">
              {[
                { mode: 'grid', icon: '⊞' },
                { mode: 'list', icon: '☰' },
              ].map(({ mode, icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as 'grid' | 'list')}
                  className="w-9 h-9 rounded-lg text-base"
                  style={
                    viewMode === mode
                      ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }
                      : { backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }
                  }
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-24" style={{ color: 'var(--color-muted)' }}>加载中…</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>没有匹配的项目</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sorted.map(p => <ProjectCard key={p.id} project={p} onDelete={requestDelete} />)}
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-card)' }}>
                    {['项目名', '市场', '集数', '题材', '进度', '最后编辑', '操作'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => open(p)}
                      style={{ backgroundColor: i % 2 === 0 ? 'var(--color-bg-base)' : 'rgba(37,37,64,0.4)' }}
                    >
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text)' }}>{p.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: '#a29bfe' }}>{MARKET_LABELS[p.market] ?? p.market}</span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-muted)' }}>{p.episodes} 集</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {p.genres.slice(0, 2).map(g => (
                            <span key={g} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(9,132,227,0.12)', color: '#74b9ff' }}>{g}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>{STEP_LABELS[Math.max(1, Math.min(7, p.current_step))]}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>{(p.updated_at ?? '').slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => open(p)} className="text-xs gradient-primary text-white px-3 py-1 rounded-lg">继续</button>
                          <button
                            onClick={() => requestDelete(p.id)}
                            className="text-xs px-2 py-1 rounded-lg hover:opacity-80 transition-opacity"
                            style={{ border: '1px solid var(--color-border)', color: 'var(--color-danger)' }}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="rounded-2xl p-6 w-80"
            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(225,112,85,0.15)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-bold text-center mb-1" style={{ color: 'var(--color-text)' }}>删除项目</h3>
            <p className="text-sm text-center mb-6 leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              确定删除「{confirmTarget?.name}」？此操作无法撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 text-sm rounded-xl font-medium"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 text-sm rounded-xl font-semibold text-white"
                style={{ backgroundColor: 'var(--color-danger)' }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
