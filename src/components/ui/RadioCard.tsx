interface Props {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  selected: boolean;
  onChange: (value: string) => void;
}

export default function RadioCard({ value, label, description, icon, selected, onChange }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className="relative text-left p-4 rounded-xl transition-all cursor-pointer w-full"
      style={{
        backgroundColor: selected ? 'rgba(108,92,231,0.1)' : 'var(--color-bg-elevated)',
        border: `1.5px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
        outline: 'none',
      }}
    >
      {selected && (
        <span
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))' }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      )}
      {icon && <span className="text-2xl mb-2 block">{icon}</span>}
      <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{label}</div>
      {description && (
        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--color-muted)' }}>{description}</div>
      )}
    </button>
  );
}
