import { useState, useEffect } from 'react';
import WorkflowShell from '../ui/WorkflowShell';
import { useApp } from '../../context/AppContext';
import type { ProjectDetail, Market } from '../../api/types';
import * as projectsApi from '../../api/projects';
import { exportFile, downloadBlob, type ExportFormat } from '../../api/export';

const MARKET_LABELS: Record<Market, string> = {
  china: '中国',
  global: '欧美',
  latam: '拉美',
};

export default function Step7Export() {
  const { navigate, currentProjectId, project } = useApp();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [scope, setScope] = useState<Record<ExportFormat, number | 'all'>>({ pdf: 'all', word: 'all' });
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentProjectId) return;
    let cancelled = false;
    projectsApi.getProject(currentProjectId)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentProjectId]);

  const eps = detail?.episodes ?? project?.episodes ?? 80;
  const duration = detail?.duration_min ?? project?.duration_min ?? 80;
  const name = detail?.name ?? project?.name ?? '未命名剧本';
  const genres = detail?.genres ?? project?.genres ?? [];
  const market = detail?.market ?? project?.market ?? 'china';

  const stats = detail?.stats ?? { total_episodes: eps, total_scenes: 0, total_words: 0, total_duration: duration };
  const scenesLabel = stats.total_scenes > 0 ? String(stats.total_scenes) : '—';
  const wordsLabel = stats.total_words > 0 ? stats.total_words.toLocaleString() : '—';

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ts = Date.now().toString().slice(-6);
  const filename = `${name}_${today}_${ts}`;

  async function handleExport(format: ExportFormat) {
    if (!currentProjectId) return;
    const s = scope[format];
    setExporting(format);
    setError('');
    try {
      const { blob, filename: fname } = await exportFile(
        currentProjectId,
        format,
        s === 'all' ? 'all' : 'episode',
        s === 'all' ? undefined : s,
      );
      downloadBlob(blob, fname);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(null);
    }
  }

  return (
    <WorkflowShell hideRightPanel>
      <div className="max-w-3xl mx-auto text-center">
        {/* Celebration */}
        <div className="mb-10">
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="44" fill="none" stroke="var(--color-border)" strokeWidth="3"/>
              <circle
                cx="48" cy="48" r="44"
                fill="none"
                stroke="url(#grad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="276"
                strokeDashoffset="276"
                className="draw-check"
                transform="rotate(-90 48 48)"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6C5CE7"/>
                  <stop offset="100%" stopColor="#0984E3"/>
                </linearGradient>
              </defs>
              <path d="M28 50l13 14 27-28" fill="none" stroke="url(#grad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60" className="draw-check"/>
            </svg>
            <div className="absolute top-0 right-0 text-xl">🎉</div>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>剧本创作完成！</h1>
          <p className="text-base" style={{ color: 'var(--color-muted)' }}>
            你的短剧剧本已全部生成，共 <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{eps} 集</span> / <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{duration} 分钟</span>
          </p>
        </div>

        {/* Project overview */}
        <div className="p-5 rounded-2xl mb-8 text-left" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <h2 className="font-semibold text-base mb-4" style={{ color: 'var(--color-text)' }}>{name}</h2>
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[
              { label: '总集数', value: `${eps} 集` },
              { label: '总场景数', value: scenesLabel },
              { label: '预计总字数', value: wordsLabel },
              { label: '预计时长', value: `${duration} 分钟` },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-bold gradient-text">{s.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {genres.map(g => (
              <span key={g} className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: '#a29bfe' }}>{g}</span>
            ))}
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(9,132,227,0.12)', color: '#74b9ff' }}>
              {MARKET_LABELS[market] ?? market}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,184,148,0.12)', color: 'var(--color-success)' }}>已完成</span>
          </div>
        </div>

        {/* Export cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* PDF */}
          <div className="p-5 rounded-2xl flex flex-col" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="text-3xl mb-3">📄</div>
            <div className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text)' }}>PDF</div>
            <div className="text-xs mb-4 flex-1" style={{ color: 'var(--color-muted)' }}>适合阅读和打印，排版精美</div>
            <div className="mb-3">
              <select
                value={String(scope.pdf)}
                onChange={e => setScope(s => ({ ...s, pdf: e.target.value === 'all' ? 'all' : Number(e.target.value) }))}
                className="w-full text-xs px-2 py-1.5 rounded-lg focus:outline-none"
                style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                <option value="all">导出全剧</option>
                {Array.from({ length: Math.min(eps, 10) }, (_, i) => (
                  <option key={i} value={i + 1}>第 {i + 1} 集</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className="gradient-primary text-white text-xs py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {exporting === 'pdf' ? '导出中…' : '下载 PDF'}
            </button>
          </div>

          {/* Word */}
          <div className="p-5 rounded-2xl flex flex-col" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="text-3xl mb-3">📝</div>
            <div className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text)' }}>Word</div>
            <div className="text-xs mb-4 flex-1" style={{ color: 'var(--color-muted)' }}>可编辑文档，便于二次修改</div>
            <div className="mb-3">
              <select
                value={String(scope.word)}
                onChange={e => setScope(s => ({ ...s, word: e.target.value === 'all' ? 'all' : Number(e.target.value) }))}
                className="w-full text-xs px-2 py-1.5 rounded-lg focus:outline-none"
                style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                <option value="all">导出全剧</option>
                {Array.from({ length: Math.min(eps, 10) }, (_, i) => (
                  <option key={i} value={i + 1}>第 {i + 1} 集</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => handleExport('word')}
              disabled={exporting !== null}
              className="gradient-primary text-white text-xs py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {exporting === 'word' ? '导出中…' : '下载 Word'}
            </button>
          </div>

          {/* Feishu stub */}
          <div className="p-5 rounded-2xl flex flex-col opacity-60" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="text-3xl mb-3">📋</div>
            <div className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text)' }}>飞书文档</div>
            <div className="text-xs mb-4 flex-1" style={{ color: 'var(--color-muted)' }}>在线协作，实时同步共享</div>
            <div className="mb-3">
              <select disabled className="w-full text-xs px-2 py-1.5 rounded-lg focus:outline-none" style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                <option>导出全剧</option>
              </select>
            </div>
            <button disabled className="text-xs py-2 rounded-lg font-semibold" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
              暂未开通
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl mb-4 text-sm" style={{ backgroundColor: 'rgba(225,112,85,0.1)', border: '1px solid rgba(225,112,85,0.3)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        {/* Filename */}
        <div className="p-4 rounded-xl mb-8 text-left" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            文件命名格式：<span style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{filename}.pdf</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('home')} className="text-sm px-5 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
            返回首页
          </button>
          <button onClick={() => navigate('step1')} className="text-sm px-5 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
            创建新项目
          </button>
          <button onClick={() => navigate('step6')} className="gradient-primary text-white text-sm px-5 py-2.5 rounded-xl font-semibold">
            继续编辑剧本
          </button>
        </div>
      </div>
    </WorkflowShell>
  );
}
