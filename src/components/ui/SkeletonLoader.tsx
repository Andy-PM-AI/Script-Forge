interface Props {
  lines?: number;
  className?: string;
}

export default function SkeletonLoader({ lines = 3, className = '' }: Props) {
  const widths = ['w-full', 'w-5/6', 'w-4/5', 'w-full', 'w-3/4', 'w-5/6'];
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded-full skeleton-pulse ${widths[i % widths.length]}`}
          style={{ backgroundColor: 'var(--color-border)' }}
        />
      ))}
    </div>
  );
}
