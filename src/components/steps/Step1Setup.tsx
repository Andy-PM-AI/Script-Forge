import { useState, useEffect } from 'react';
import WorkflowShell from '../ui/WorkflowShell';
import RadioCard from '../ui/RadioCard';
import GenreTagCloud from '../ui/GenreTagCloud';
import SegmentedControl from '../ui/SegmentedControl';
import CharacterForm from '../ui/CharacterForm';
import PromptEditorModal from '../ui/PromptEditorModal';
import { useApp, CharacterDraft } from '../../context/AppContext';
import { GENRE_OPTIONS } from '../../data/mockData';
import type { Market } from '../../api/types';
import * as projectsApi from '../../api/projects';

const EPISODE_OPTIONS = [20, 30, 40, 50, 60, 70, 80, 90, 100].map(n => ({ label: String(n), value: n }));

const MARKET_LABELS: Record<string, string> = {
  global: '欧美',
  latam: '拉美',
  china: '中国',
};

function buildPrompt(opts: {
  market: string;
  genre: string[];
  episodes: number;
  duration: string;
  synopsis: string;
  characters: CharacterDraft[];
}) {
  const marketLabel = MARKET_LABELS[opts.market] ?? opts.market;
  const genreLabel = opts.genre.join('、') || '（未选择）';
  const synopsisText = opts.synopsis.trim() || '（未填写）';
  const charsText = opts.characters.length > 0
    ? opts.characters.map(c => `${c.name}（${c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '其他'}，${c.isProtagonist ? '主角' : '配角'}）：${c.description || '无介绍'}`).join('\n')
    : '（未填写）';

  return `你现在是最资深最有才华且写出过「${marketLabel}」大爆款的短剧编剧。
我准备要做一部面向「${marketLabel}」的AI仿真人短剧，故事题材属于「${genreLabel}」，全剧共「${opts.episodes}」集，总时长「${opts.duration}」分钟。
故事梗概如下：「${synopsisText}」
人物小传如下：「${charsText}」
根据以上信息，先帮我生成完整的人物设定、背景设定和故事线，要求如下：
1. 如果有角色还没有确定的姓名时，可以根据剧情给该角色起一个合适的名字
2. 如果人物小传和故事梗概存在不一致时，以人物小传为准
3. 生成人物设定时，如果有人物小传中没列出的重要角色，可以新增
4. 人物设定按照以下格式生成：角色姓名、角色年龄、角色身份（男主/女主/女配/反派等）、性格特点、经历介绍`;
}

export default function Step1Setup() {
  const { currentProjectId, createProject, updateProject, nextStep } = useApp();
  const isEditing = !!currentProjectId;

  const [projectName, setProjectName] = useState('');
  const [market, setMarket] = useState<string>('global');
  const [genre, setGenre] = useState<string[]>([]);
  const [episodes, setEpisodes] = useState<number>(80);
  const [duration, setDuration] = useState<string>('80');
  const [scriptLang, setScriptLang] = useState('zh');
  const [dialogueLang, setDialogueLang] = useState('zh');
  const [synopsis, setSynopsis] = useState('');
  const [characters, setCharacters] = useState<CharacterDraft[]>([]);
  const [showCharForm, setShowCharForm] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 编辑已有项目时，回填第一步已保存的基础设定与人物小传。
  useEffect(() => {
    if (!currentProjectId) return;
    let cancelled = false;
    projectsApi
      .getProject(currentProjectId)
      .then(detail => {
        if (cancelled) return;
        setProjectName(detail.name);
        setMarket(detail.market);
        setGenre(detail.genres ?? []);
        setEpisodes(detail.episodes);
        setDuration(String(detail.duration_min));
        setScriptLang(detail.script_language);
        setDialogueLang(detail.dialogue_language);
        setSynopsis(detail.synopsis ?? '');
        setCharacters(
          (detail.characters ?? [])
            .filter(c => c.source === 'user_input')
            .map(c => ({
              id: c.id,
              name: c.name,
              gender: c.gender ?? 'other',
              isProtagonist: c.is_protagonist,
              description: c.description ?? '',
            })),
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentProjectId]);

  const genreOptions = GENRE_OPTIONS[market] ?? GENRE_OPTIONS.global;

  const currentPrompt = buildPrompt({ market, genre, episodes, duration, synopsis, characters });

  async function handleSubmit() {
    if (!projectName.trim()) {
      setError('请填写剧名');
      return;
    }
    if (!synopsis.trim() && characters.length === 0) {
      setError('故事梗概和人物小传请至少填写一项');
      return;
    }
    setError('');
    setSubmitting(true);
    const input = {
      name: projectName.trim(),
      market: market as Market,
      genres: genre,
      episodes,
      duration_min: Number(duration) || 80,
      script_language: scriptLang as 'zh' | 'en',
      dialogue_language: dialogueLang as 'zh' | 'en-zh' | 'en',
      synopsis: synopsis.trim() || null,
      characters: characters.map(c => ({
        name: c.name,
        gender: c.gender,
        is_protagonist: c.isProtagonist,
        description: c.description || null,
      })),
    };
    try {
      if (currentProjectId) {
        await updateProject(currentProjectId, input);
      } else {
        await createProject(input);
      }
      nextStep('step2');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    borderRadius: '8px',
  };

  const labelStyle = { color: 'var(--color-text)', fontWeight: '600', fontSize: '13px' };
  const hintStyle = { color: 'var(--color-muted)', fontSize: '11px' };

  return (
    <WorkflowShell hideRightPanel>
      <PromptEditorModal
        isOpen={showPrompt}
        onClose={() => setShowPrompt(false)}
        initialPrompt={currentPrompt}
        defaultPrompt={currentPrompt}
      />

      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>第一步：项目基础设定</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>填写基本信息，AI 将据此生成人物和故事</p>
        </div>

        <div className="space-y-8">
          {/* Project Name */}
          <div>
            <label className="block mb-2" style={labelStyle}>剧名 *</label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="给你的短剧起一个名字…"
              maxLength={50}
              className="w-full px-3 py-2.5 text-sm focus:outline-none"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
            />
            <div className="text-right text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
              {projectName.length} / 50
            </div>
          </div>

          {/* Market */}
          <div>
            <label className="block mb-3" style={labelStyle}>市场地区 *</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'global', label: '欧美', icon: '🌍', desc: '北美 / 欧洲市场' },
                { value: 'latam', label: '拉美', icon: '🌎', desc: '拉丁美洲市场' },
                { value: 'china', label: '中国', icon: '🇨🇳', desc: '中国短剧市场' },
              ].map(m => (
                <RadioCard
                  key={m.value}
                  value={m.value}
                  label={m.label}
                  description={m.desc}
                  icon={m.icon}
                  selected={market === m.value}
                  onChange={v => { setMarket(v); setGenre([]); }}
                />
              ))}
            </div>
          </div>

          {/* Genre */}
          <div>
            <label className="block mb-1" style={labelStyle}>故事题材 *</label>
            <p className="mb-3" style={hintStyle}>根据市场地区动态显示可选题材，也可自定义输入</p>
            <GenreTagCloud options={genreOptions} selected={genre} onChange={setGenre} />
          </div>

          {/* Episodes */}
          <div>
            <label className="block mb-3" style={labelStyle}>全剧集数 *</label>
            <SegmentedControl options={EPISODE_OPTIONS} value={episodes} onChange={v => setEpisodes(Number(v))} />
            {episodes <= 40 && (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-warning)' }}>
                ⚡ ≤ 40 集时，将跳过「分段粗纲」，直接从「人物故事」进入「分集粗纲」
              </p>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="block mb-2" style={labelStyle}>全剧时长</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-28 px-3 py-2 text-sm focus:outline-none"
                style={inputStyle}
                min="1"
              />
              <span className="text-sm" style={{ color: 'var(--color-muted)' }}>分钟</span>
            </div>
            <p className="mt-1" style={hintStyle}>建议单集 1–2 分钟</p>
          </div>

          {/* Languages */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block mb-2" style={labelStyle}>剧本语言</label>
              <div className="flex gap-2">
                {[{ v: 'zh', l: '中文' }, { v: 'en', l: '英文' }].map(o => (
                  <button key={o.v} type="button" onClick={() => setScriptLang(o.v)}
                    className="flex-1 py-2 text-xs rounded-lg transition-all"
                    style={scriptLang === o.v
                      ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }
                      : { ...inputStyle }}
                  >{o.l}</button>
                ))}
              </div>
              <p className="mt-1" style={hintStyle}>剧本非台词部分使用的语言</p>
            </div>
            <div>
              <label className="block mb-2" style={labelStyle}>台词语言</label>
              <div className="flex gap-1.5">
                {[{ v: 'zh', l: '中文' }, { v: 'en-zh', l: '英主中辅' }, { v: 'en', l: '英文' }].map(o => (
                  <button key={o.v} type="button" onClick={() => setDialogueLang(o.v)}
                    className="flex-1 py-2 text-xs rounded-lg transition-all"
                    style={dialogueLang === o.v
                      ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }
                      : { ...inputStyle }}
                  >{o.l}</button>
                ))}
              </div>
              <p className="mt-1" style={hintStyle}>英主中辅 = 英文为主，括号标注中文</p>
            </div>
          </div>

          {/* Synopsis */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label style={labelStyle}>故事梗概</label>
              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-muted)' }}>可选</span>
            </div>
            <textarea
              value={synopsis}
              onChange={e => setSynopsis(e.target.value)}
              placeholder="输入你的故事梗概，越详细越好…"
              rows={5}
              className="w-full px-3 py-2.5 text-sm resize-none focus:outline-none"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
            />
            <div className="text-right text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{synopsis.length} 字</div>
          </div>

          {/* Characters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label style={labelStyle}>人物小传</label>
              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-muted)' }}>可选</span>
            </div>
            <div className="space-y-3">
              {characters.map(c => (
                <div key={c.id} className="flex items-start justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{c.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                      {c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '其他'} · {c.isProtagonist ? '主角' : '配角'}
                    </div>
                    {c.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-muted)' }}>{c.description}</p>}
                  </div>
                  <button
                    onClick={() => setCharacters(prev => prev.filter(x => x.id !== c.id))}
                    className="ml-3 p-1 hover:opacity-70"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
              {showCharForm ? (
                <CharacterForm
                  onSave={c => { setCharacters(prev => [...prev, c]); setShowCharForm(false); }}
                  onCancel={() => setShowCharForm(false)}
                />
              ) : (
                <button
                  onClick={() => setShowCharForm(true)}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ border: '1.5px dashed var(--color-border)', color: 'var(--color-muted)' }}
                >
                  + 添加人物
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
          {error && (
            <p className="text-xs mb-3 text-center" style={{ color: 'var(--color-danger)' }}>{error}</p>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowPrompt(true)}
              className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              提示词
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold disabled:opacity-50"
            >
              {submitting ? (isEditing ? '保存中…' : '创建中…') : (isEditing ? '保存，下一步 →' : '确认提交，下一步 →')}
            </button>
          </div>
        </div>
      </div>
    </WorkflowShell>
  );
}
