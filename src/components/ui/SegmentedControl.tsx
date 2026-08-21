interface Option {
  label: string;
  value: string | number;
}

interface Props {
  options: Option[];
  value: string | number;
  onChange: (value: string | number) => void;
}

export default function SegmentedControl({ options, value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
      {options.map(opt => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={
              isActive
                ? { background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', color: 'white' }
                : { color: 'var(--color-muted)', backgroundColor: 'transparent' }
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
