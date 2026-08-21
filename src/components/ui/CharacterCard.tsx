import { useState } from 'react';
import { MockCharacter, GRADIENT_PRESETS } from '../../data/mockData';

interface Props {
  character: MockCharacter;
}

export default function CharacterCard({ character }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl p-4 flex-shrink-0 w-64"
      style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
          style={{ background: GRADIENT_PRESETS[character.colorSeed % GRADIENT_PRESETS.length] }}
        >
          {character.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{character.name}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{character.gender} · {character.age}</div>
          <span
            className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(108,92,231,0.15)', color: '#a29bfe' }}
          >
            {character.role}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {character.traits.map(t => (
          <span
            key={t}
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(9,132,227,0.12)', color: '#74b9ff' }}
          >
            {t}
          </span>
        ))}
      </div>
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--color-muted)', display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden' } as React.CSSProperties}
      >
        {character.backstory}
      </p>
      <button
        onClick={() => setExpanded(v => !v)}
        className="mt-2 text-xs font-medium"
        style={{ color: 'var(--color-primary)' }}
      >
        {expanded ? '收起' : '展开'}
      </button>
    </div>
  );
}
