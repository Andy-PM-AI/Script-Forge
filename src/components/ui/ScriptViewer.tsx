import { useRef, useEffect } from 'react';
import { MockScriptScene } from '../../data/mockData';

interface Props {
  scenes: MockScriptScene[];
  activeSceneIndex: number;
  onSceneSelect: (index: number) => void;
}

export default function ScriptViewer({ scenes, activeSceneIndex, onSceneSelect }: Props) {
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    sceneRefs.current[activeSceneIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeSceneIndex]);

  return (
    <div className="flex h-full min-h-0">
      {/* Scene list */}
      <div
        className="w-48 flex-shrink-0 overflow-y-auto py-3"
        style={{ borderRight: '1px solid var(--color-border)' }}
      >
        {scenes.map((scene, i) => (
          <button
            key={scene.id}
            onClick={() => onSceneSelect(i)}
            className="w-full text-left px-3 py-2.5 transition-all relative"
            style={{
              backgroundColor: activeSceneIndex === i ? 'rgba(108,92,231,0.12)' : 'transparent',
              borderLeft: activeSceneIndex === i ? '2px solid var(--color-primary)' : '2px solid transparent',
            }}
          >
            <div className="text-xs font-medium" style={{ color: activeSceneIndex === i ? 'var(--color-primary)' : 'var(--color-muted)' }}>
              {scene.id}
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>
              {scene.location}
            </div>
          </button>
        ))}
      </div>

      {/* Script body */}
      <div
        className="flex-1 overflow-y-auto px-8 py-6"
        style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--color-bg-base)' }}
      >
        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            ref={el => { sceneRefs.current[i] = el; }}
            className="mb-12"
          >
            {/* Scene heading */}
            <div className="mb-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
              <div
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: 'var(--color-primary)' }}
              >
                {scene.sceneHeading}
              </div>
            </div>

            {/* Characters line */}
            {scene.dialogue.length > 0 && (
              <div className="mb-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                人物：{[...new Set(scene.dialogue.map(d => d.character))].join('、')}
              </div>
            )}

            {/* Action */}
            <p className="text-sm leading-relaxed mb-4 italic" style={{ color: 'rgba(232,232,240,0.75)' }}>
              △ {scene.action}
            </p>

            {/* Dialogue */}
            {scene.dialogue.map((d, di) => (
              <div key={di} className="mb-4 flex flex-col items-center">
                <div className="w-full max-w-lg">
                  <div className="text-sm font-bold uppercase mb-1 text-center" style={{ color: 'var(--color-text)' }}>
                    {d.character}
                    {d.parenthetical && (
                      <span className="font-normal text-xs ml-1" style={{ color: 'var(--color-muted)' }}>
                        （{d.parenthetical}）
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-center" style={{ color: 'var(--color-text)' }}>
                    {d.line}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
