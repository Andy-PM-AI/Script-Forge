import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import TopNav from '../ui/TopNav';
import ProjectCard from '../ui/ProjectCard';
import type { Project } from '../../api/types';
import * as projectsApi from '../../api/projects';

export default function HomeView() {
  const { navigate, startNewProject, startSpark } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    projectsApi.listProjects({ limit: 50 })
      .then(res => { if (!cancelled) setProjects(res.items); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <TopNav />
      <div style={{ paddingTop: '64px' }}>
        {/* Hero */}
        <section
          className="relative dot-grid px-8 py-20 overflow-hidden"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          {/* Gradient blobs */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: '500px', height: '500px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(108,92,231,0.12) 0%, transparent 70%)',
              top: '-100px', right: '5%',
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              width: '300px', height: '300px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(9,132,227,0.1) 0%, transparent 70%)',
              bottom: '-50px', left: '10%',
            }}
          />

          <div className="max-w-5xl mx-auto flex items-center gap-16">
            <div className="flex-1">
              <div
                className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
                style={{ background: 'rgba(108,92,231,0.15)', color: '#a29bfe', border: '1px solid rgba(108,92,231,0.3)' }}
              >
                ✦ AI 驱动的短剧创作平台
              </div>
              <h1 className="text-5xl font-bold leading-tight mb-4">
                <span style={{ color: 'var(--color-text)' }}>用 AI 从零<br/>生成你的</span>
                <br />
                <span className="gradient-text">短剧剧本</span>
              </h1>
              <p className="text-base mb-8 max-w-md leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                7 步工作流，从故事设定到分镜脚本，一站式完成。让 AI 成为你的专属编剧助理。
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={startNewProject}
                  className="gradient-primary text-white font-semibold px-7 py-3 rounded-xl text-sm"
                >
                  + 新建项目
                </button>
                <button
                  onClick={startSpark}
                  className="relative text-sm font-semibold px-7 py-3 rounded-xl transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg,rgba(108,92,231,0.15),rgba(9,132,227,0.15))',
                    border: '1px solid rgba(108,92,231,0.5)',
                    color: '#a29bfe',
                    boxShadow: '0 0 20px rgba(108,92,231,0.15)',
                  }}
                >
                  ✨ AI 灵感火花
                </button>
                <button
                  onClick={() => navigate('projects')}
                  className="text-sm px-7 py-3 rounded-xl font-medium"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                >
                  查看全部项目
                </button>
              </div>
              <p className="text-xs mt-3" style={{ color: 'var(--color-muted)' }}>
                没思路？让 AI 从爆款素材库给你灵感
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex-shrink-0 hidden lg:flex flex-col gap-3">
              {[
                { icon: '🎭', label: '人物设定', desc: 'AI 生成丰富人物档案' },
                { icon: '📖', label: '故事结构', desc: '分段大纲自动规划' },
                { icon: '🎬', label: '分镜脚本', desc: '专业剧本格式输出' },
                { icon: '📤', label: '多格式导出', desc: 'PDF / Word / 飞书' },
              ].map(f => (
                <div
                  key={f.label}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', minWidth: '220px' }}
                >
                  <span className="text-xl">{f.icon}</span>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{f.label}</div>
                    <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recent projects */}
        <section className="max-w-5xl mx-auto px-8 py-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>我的项目</h2>
            <button
              onClick={() => navigate('projects')}
              className="text-xs font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              全部项目 →
            </button>
          </div>

          {loading ? (
            <div className="text-center py-24" style={{ color: 'var(--color-muted)' }}>加载中…</div>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map(p => (
                <ProjectCard key={p.id} project={p} />
              ))}
              {/* New project card */}
              <button
                onClick={startNewProject}
                className="rounded-xl flex flex-col items-center justify-center gap-3 py-16 transition-all hover:-translate-y-1"
                style={{ backgroundColor: 'var(--color-bg-card)', border: '2px dashed var(--color-border)' }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: 'var(--color-bg-elevated)' }}
                >
                  +
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>新建项目</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>还没有项目，点击上方按钮创建第一个项目</p>
              <button onClick={startNewProject} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl">
                + 新建项目
              </button>
            </div>
          )}
        </section>

        {/* Stats */}
        <section className="max-w-5xl mx-auto px-8 py-8" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="grid grid-cols-3 gap-6">
            {[
              { value: '7 步', label: '完整创作工作流' },
              { value: '19+', label: '热门题材模版' },
              { value: '100%', label: '支持 AI 重生成' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold gradient-text mb-1">{s.value}</div>
                <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
