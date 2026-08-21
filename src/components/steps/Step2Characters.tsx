import { useState, useEffect, useCallback } from 'react';
import WorkflowShell from '../ui/WorkflowShell';
import SkeletonLoader from '../ui/SkeletonLoader';
import PromptEditorModal from '../ui/PromptEditorModal';
import { useApp } from '../../context/AppContext';
import type { Character, Step2Payload } from '../../api/types';
import * as step2Api from '../../api/step2';

const GENDER_LABELS: Record<string, string> = { male: '男', female: '女', other: '其他' };
function genderLabel(g: string | null | undefined): string {
  if (!g) return '';
  return GENDER_LABELS[g] ?? g;
}

type Target = 'all' | 'characters' | 'background' | 'storyline';
const TARGET_LABEL: Record<Target, string> = {
  all: '全部内容',
  characters: '人物设定',
  background: '背景设定',
  storyline: '故事线',
};

/* ── Feedback panel for a single section ── */
function FeedbackBox({ label, onSubmit }: { label: string; onSubmit: (text: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-muted)' }}>修改意见 · {label}</div>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={`输入对${label}的修改方向…`}
        rows={3}
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
        onClick={() => { if (value.trim()) { onSubmit(value.trim()); setValue(''); } }}
        disabled={!value.trim()}
        className="mt-2 gradient-primary text-white text-xs px-4 py-1.5 rounded-lg font-medium disabled:opacity-40"
      >
        提交给 AI
      </button>
    </div>
  );
}

/* ── AI 推荐姓名面板 ── */
function AINamePanel({
  projectId,
  charId,
  charName,
  onConfirm,
  onClose,
}: {
  projectId: string;
  charId: string;
  charName: string;
  onConfirm: (newName: string) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<{ name: string; reason: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    setError('');
    step2Api
      .fetchNameRecommendations(projectId, charId, charName)
      .then(data => { if (!cancelled) { setRecs(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError('推荐失败，请重试'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [projectId, charId, charName, nonce]);

  return (
    <div
      className="mt-3 rounded-xl p-4"
      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-primary)', boxShadow: '0 4px 20px rgba(108,92,231,0.2)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6C5CE7,#0984E3)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>AI 推荐姓名</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: '#a29bfe' }}>针对「{charName}」</span>
        </div>
        <button onClick={onClose} className="hover:opacity-60" style={{ color: 'var(--color-muted)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 rounded-lg" style={{ backgroundColor: 'var(--color-bg-elevated)' }} />
          ))}
        </div>
      ) : error ? (
        <p className="text-xs py-3 text-center" style={{ color: 'var(--color-danger)' }}>{error}</p>
      ) : (
        <div className="space-y-2">
          {recs.map(r => (
            <button
              key={r.name}
              onClick={() => setSelected(r.name)}
              className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
              style={{
                backgroundColor: selected === r.name ? 'rgba(108,92,231,0.18)' : 'var(--color-bg-elevated)',
                border: `1px solid ${selected === r.name ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold" style={{ color: selected === r.name ? '#a29bfe' : 'var(--color-text)' }}>{r.name}</span>
                {selected === r.name && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                )}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>{r.reason}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
          className="flex-1 gradient-primary text-white text-xs py-2 rounded-lg font-semibold disabled:opacity-40"
        >
          确认替换「{selected ?? '…'}」
        </button>
        <button
          onClick={() => setNonce(n => n + 1)}
          disabled={loading}
          className="text-xs px-3 py-2 rounded-lg disabled:opacity-40"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
          title="换一批"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        </button>
      </div>

      <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>确认后将替换该角色在人物设定、背景设定、故事线中的所有名字</p>
    </div>
  );
}

/* ── Inline-editable character card ── */
function CharacterEditCard({ char, projectId, onUpdate, onReplaceName }: {
  char: Character;
  projectId: string;
  onUpdate: (id: string, field: string, value: string) => void;
  onReplaceName: (id: string, oldName: string, newName: string) => void;
}) {
  const textFields: { key: 'name' | 'role' | 'age' | 'backstory'; label: string; multiline?: boolean }[] = [
    { key: 'name', label: '姓名' },
    { key: 'role', label: '身份' },
    { key: 'age', label: '年龄' },
    { key: 'backstory', label: '经历介绍', multiline: true },
  ];

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [showAINames, setShowAINames] = useState(false);

  function startEdit(key: string, current: string) {
    setEditing(key);
    setDraft(current);
  }
  function save(key: string) {
    onUpdate(char.id, key, draft);
    setEditing(null);
  }

  const GRADIENT_PRESETS = [
    'linear-gradient(135deg, #6C5CE7, #a29bfe)',
    'linear-gradient(135deg, #0984E3, #74b9ff)',
    'linear-gradient(135deg, #E17055, #fab1a0)',
    'linear-gradient(135deg, #00B894, #55efc4)',
  ];

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
          style={{ background: GRADIENT_PRESETS[(char.color_seed ?? 0) % GRADIENT_PRESETS.length] }}
        >
          {char.name.charAt(0)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{char.name}</span>
          {char.role && (
            <span className="inline-block text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: '#a29bfe' }}>{char.role}</span>
          )}
          {char.is_protagonist && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,184,148,0.12)', color: 'var(--color-success)' }}>主角</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {textFields.map(({ key, label, multiline }) => {
          const val = String(char[key] ?? '');
          const isEditing = editing === key;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{label}</span>
                {!isEditing && (
                  <div className="flex items-center gap-2">
                    {key === 'name' && (
                      <button
                        onClick={() => setShowAINames(v => !v)}
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-all"
                        style={{
                          background: showAINames ? 'linear-gradient(135deg,#6C5CE7,#0984E3)' : 'rgba(108,92,231,0.12)',
                          color: showAINames ? 'white' : '#a29bfe',
                          border: '1px solid rgba(108,92,231,0.3)',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                        AI推荐
                      </button>
                    )}
                    <button onClick={() => startEdit(key, val)} className="text-xs hover:opacity-70" style={{ color: 'var(--color-primary)' }}>编辑</button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <div>
                  {multiline ? (
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      rows={4}
                      className="w-full text-xs rounded-lg p-2 resize-none focus:outline-none"
                      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-primary)', color: 'var(--color-text)' }}
                      autoFocus
                    />
                  ) : (
                    <input
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      className="w-full text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-primary)', color: 'var(--color-text)' }}
                      autoFocus
                    />
                  )}
                  <div className="flex gap-2 mt-1.5">
                    <button onClick={() => save(key)} className="text-xs gradient-primary text-white px-3 py-1 rounded-lg">保存</button>
                    <button onClick={() => setEditing(null)} className="text-xs px-3 py-1 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>取消</button>
                  </div>
                </div>
              ) : (
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text)' }}>{val}</p>
              )}
            </div>
          );
        })}

        {/* Gender (select) */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>性别</span>
            {editing !== 'gender' && (
              <button onClick={() => { setEditing('gender'); setDraft(char.gender ?? 'other'); }} className="text-xs hover:opacity-70" style={{ color: 'var(--color-primary)' }}>编辑</button>
            )}
          </div>
          {editing === 'gender' ? (
            <div>
              <select
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="w-full text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-primary)', color: 'var(--color-text)' }}
                autoFocus
              >
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="other">其他</option>
              </select>
              <div className="flex gap-2 mt-1.5">
                <button onClick={() => save('gender')} className="text-xs gradient-primary text-white px-3 py-1 rounded-lg">保存</button>
                <button onClick={() => setEditing(null)} className="text-xs px-3 py-1 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>取消</button>
              </div>
            </div>
          ) : (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text)' }}>{genderLabel(char.gender)}</p>
          )}
        </div>
      </div>

      {showAINames && (
        <AINamePanel
          projectId={projectId}
          charId={char.id}
          charName={char.name}
          onClose={() => setShowAINames(false)}
          onConfirm={newName => {
            onReplaceName(char.id, char.name, newName);
            setShowAINames(false);
          }}
        />
      )}
    </div>
  );
}

/* ── Inline-editable text block ── */
function EditableTextBlock({
  content,
  onSave,
  label,
}: {
  content: string;
  onSave: (v: string) => void;
  label: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{label}</span>
        {!isEditing ? (
          <button onClick={() => { setDraft(content); setIsEditing(true); }} className="text-xs hover:opacity-70" style={{ color: 'var(--color-primary)' }}>
            编辑
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { onSave(draft); setIsEditing(false); }} className="text-xs gradient-primary text-white px-3 py-1 rounded-lg">保存</button>
            <button onClick={() => setIsEditing(false)} className="text-xs px-3 py-1 rounded-lg" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>取消</button>
          </div>
        )}
      </div>
      {isEditing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={8}
          className="w-full text-sm rounded-lg p-3 resize-none focus:outline-none"
          style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-primary)', color: 'var(--color-text)', lineHeight: 1.7 }}
          autoFocus
        />
      ) : (
        <div className="space-y-3">
          {content.split('\n\n').map((p, i) => (
            <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Section card wrapper ── */
function SectionCard({ title, children, feedbackLabel, onFeedback }: {
  title: string;
  children: React.ReactNode;
  feedbackLabel: string;
  onFeedback: (text: string) => void;
}) {
  return (
    <div
      className="gradient-border-left rounded-xl pl-5 pr-5 py-5"
      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderLeft: 'none' }}
    >
      <div className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text)' }}>{title}</div>
      {children}
      <FeedbackBox label={feedbackLabel} onSubmit={onFeedback} />
    </div>
  );
}

export default function Step2Characters() {
  const { navigate, nextStep, consumeGenerate, currentProjectId, project, addHistory } = useApp();
  const eps = project?.episodes ?? 80;
  const durationMin = project?.duration_min ?? 80;

  const [chars, setChars] = useState<Character[]>([]);
  const [background, setBackground] = useState('');
  const [storyline, setStoryline] = useState('');
  const [loadingTarget, setLoadingTarget] = useState<Target | null>(null);
  const [error, setError] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  const apply = useCallback((p: Step2Payload) => {
    setChars(p.characters);
    setBackground(p.background);
    setStoryline(p.storyline);
  }, []);

  useEffect(() => {
    if (!currentProjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await step2Api.getStep2(currentProjectId);
        if (cancelled) return;
        const shouldGenerate = consumeGenerate();
        apply(data);
        const needsGen = !data.background && !data.storyline && !data.characters.some(c => c.source === 'ai_generated');
        if (needsGen && shouldGenerate) {
          setLoadingTarget('all');
          const generated = await step2Api.generateStep2(currentProjectId, 'all');
          if (!cancelled) apply(generated);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (!cancelled) setLoadingTarget(null);
      }
    })();
    return () => { cancelled = true; };
  }, [currentProjectId, apply, consumeGenerate]);

  async function updateChar(id: string, field: string, value: string) {
    setChars(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    if (!currentProjectId) return;
    try {
      const patch: step2Api.CharacterPatch = {};
      if (field === 'gender') patch.gender = (value || 'other') as 'male' | 'female' | 'other';
      else if (field === 'name') patch.name = value;
      else if (field === 'age') patch.age = value || null;
      else if (field === 'role') patch.role = value || null;
      else if (field === 'backstory') patch.backstory = value || null;
      const updated = await step2Api.updateCharacter(currentProjectId, id, patch);
      setChars(prev => prev.map(c => c.id === id ? updated : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function replaceNameGlobally(id: string, oldName: string, newName: string) {
    if (!currentProjectId || oldName === newName) return;
    try {
      const result = await step2Api.replaceName(currentProjectId, { character_id: id, old_name: oldName, new_name: newName });
      apply(result);
      addHistory(`[人物设定] 将「${oldName}」全局替换为「${newName}」`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '替换失败');
    }
  }

  async function saveBackground(v: string) {
    setBackground(v);
    if (!currentProjectId) return;
    try { await step2Api.updateBackground(currentProjectId, v); }
    catch (err) { setError(err instanceof Error ? err.message : '保存失败'); }
  }

  async function saveStoryline(v: string) {
    setStoryline(v);
    if (!currentProjectId) return;
    try { await step2Api.updateStoryline(currentProjectId, v); }
    catch (err) { setError(err instanceof Error ? err.message : '保存失败'); }
  }

  async function handleFeedback(target: Target, text: string) {
    if (!currentProjectId || target === 'all') return;
    addHistory(`[${TARGET_LABEL[target]}] ${text}`);
    setLoadingTarget(target);
    try {
      const result = await step2Api.feedbackStep2(currentProjectId, { target, feedback: text });
      apply(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setLoadingTarget(null);
    }
  }

  async function generateAll() {
    if (!currentProjectId) return;
    setLoadingTarget('all');
    setError('');
    try {
      const generated = await step2Api.generateStep2(currentProjectId, 'all');
      apply(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setLoadingTarget(null);
    }
  }

  const loadingChars = loadingTarget === 'all' || loadingTarget === 'characters';
  const loadingBg = loadingTarget === 'all' || loadingTarget === 'background';
  const loadingStory = loadingTarget === 'all' || loadingTarget === 'storyline';
  const generating = loadingTarget !== null;

  // Build prompt dynamically (informational, mirrors step3 input)
  const charsText = chars.map(c => `${c.name}（${c.age ?? ''}，${c.role ?? ''}）\n性格：${(c.traits ?? []).join('、')}\n经历：${c.backstory ?? ''}`).join('\n\n');
  const segSize = eps <= 40 ? '' : eps <= 60 ? '15集' : '20集';
  const promptText = `现在人物设定已确定如下：
「${charsText}」
背景设定已确定如下：
「${background}」
故事线已确定如下：
「${storyline}」
全剧共「${eps}」集，总时长「${durationMin}」分钟。
根据以上信息先确定剧情大纲，以「${segSize || '10集'}」为一段，列出每段的剧情简介（1000 左右）、每段的开场和结尾钩子，要求：
1. 每段之间的剧情要有连贯性
2. 要合理安排几条故事线的节奏，不能一直讲某条线而其他线不提，需要几条故事线穿插进行
3. 遇到人物设定、背景设定、故事线之间的信息不一致时，优先以人物设定为准，其次为背景设定，最后是故事线`;

  function handleNext() {
    nextStep(eps <= 40 ? 'step4' : 'step3');
  }

  return (
    <WorkflowShell hideRightPanel>
      <PromptEditorModal isOpen={showPrompt} onClose={() => setShowPrompt(false)} initialPrompt={promptText} defaultPrompt={promptText} />

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>第二步：人物设定 · 背景设定 · 故事线</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>AI 已根据你的设定生成以下内容，点击「编辑」可直接修改，也可输入修改意见提交给 AI</p>
      </div>

      {generating && (
        <div className="mb-6 px-4 py-3 rounded-xl flex items-center gap-3" style={{ backgroundColor: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)' }}>
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          <span className="text-sm" style={{ color: '#a29bfe' }}>AI 正在创作{loadingTarget !== 'all' ? `「${TARGET_LABEL[loadingTarget!]}」` : '中'}…</span>
        </div>
      )}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(225,112,85,0.1)', border: '1px solid rgba(225,112,85,0.3)', color: 'var(--color-danger)' }}>{error}</div>
      )}

      {!generating && chars.length === 0 && !background && !storyline && (
        <div className="mb-6 p-6 rounded-xl text-center" style={{ border: '1px dashed var(--color-border)' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>尚未生成人物、背景与故事线，点击下方按钮开始创作</p>
          <button onClick={generateAll} className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold">
            生成人物 / 背景 / 故事线
          </button>
        </div>
      )}

      <div className="space-y-6">
        <SectionCard title="人物设定" feedbackLabel="人物设定" onFeedback={text => handleFeedback('characters', text)}>
          {loadingChars ? (
            <SkeletonLoader lines={5} />
          ) : chars.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>暂无人物，提交修改意见或重新生成以创建人物。</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chars.map(c => (
                <CharacterEditCard key={c.id} char={c} projectId={currentProjectId ?? ''} onUpdate={updateChar} onReplaceName={replaceNameGlobally} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="背景设定" feedbackLabel="背景设定" onFeedback={text => handleFeedback('background', text)}>
          {loadingBg ? (
            <SkeletonLoader lines={4} />
          ) : (
            <EditableTextBlock content={background} onSave={saveBackground} label="世界观 / 时代背景" />
          )}
        </SectionCard>

        <SectionCard title="故事线" feedbackLabel="故事线" onFeedback={text => handleFeedback('storyline', text)}>
          {loadingStory ? (
            <SkeletonLoader lines={6} />
          ) : (
            <EditableTextBlock content={storyline} onSave={saveStoryline} label="主线 / 感情线 / 副线" />
          )}
        </SectionCard>
      </div>

      <div className="mt-8 pt-6 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex gap-2">
          <button onClick={() => navigate('step1')} className="text-sm px-4 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
            ← 返回上一步
          </button>
          <button onClick={() => setShowPrompt(true)} className="flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-xl" style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            提示词
          </button>
        </div>
        <button
          onClick={handleNext}
          disabled={generating}
          className="gradient-primary text-white text-sm px-6 py-2.5 rounded-xl font-semibold disabled:opacity-50"
        >
          确认提交，下一步 →
        </button>
      </div>
    </WorkflowShell>
  );
}
