import { useState } from 'react';
import { CharacterDraft } from '../../context/AppContext';

interface Props {
  onSave: (c: CharacterDraft) => void;
  onCancel: () => void;
  initial?: Partial<CharacterDraft>;
}

export default function CharacterForm({ onSave, onCancel, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [gender, setGender] = useState<CharacterDraft['gender']>(initial?.gender ?? 'male');
  const [isProtagonist, setIsProtagonist] = useState(initial?.isProtagonist ?? false);
  const [description, setDescription] = useState(initial?.description ?? '');

  function handleSave() {
    if (!name.trim()) return;
    onSave({ id: initial?.id ?? String(Date.now()), name: name.trim(), gender, isProtagonist, description });
  }

  const inputStyle = {
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    borderRadius: '8px',
  };

  return (
    <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-primary)' }}>
      <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>添加人物</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>姓名 *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="人物姓名"
            className="w-full px-3 py-2 text-sm focus:outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>性别</label>
          <div className="flex gap-2">
            {(['male', 'female', 'other'] as const).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className="flex-1 py-2 text-xs rounded-lg transition-all"
                style={
                  gender === g
                    ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }
                    : { backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }
                }
              >
                {g === 'male' ? '男' : g === 'female' ? '女' : '其他'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs" style={{ color: 'var(--color-muted)' }}>是否主角</label>
        <button
          type="button"
          onClick={() => setIsProtagonist(v => !v)}
          className="w-10 h-5 rounded-full transition-all relative"
          style={{ backgroundColor: isProtagonist ? 'var(--color-primary)' : 'var(--color-border)' }}
        >
          <span
            className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all"
            style={{ left: isProtagonist ? '22px' : '2px' }}
          />
        </button>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--color-muted)' }}>人物介绍</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="描述人物背景、性格、经历…"
          rows={3}
          className="w-full px-3 py-2 text-sm resize-none focus:outline-none"
          style={inputStyle}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-lg" style={{ color: 'var(--color-muted)' }}>取消</button>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="gradient-primary text-white text-sm px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </div>
  );
}
