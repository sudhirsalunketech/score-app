import { cn } from '@/lib/cn';

type Item = { id: string; label: string };

export function PillTabs({
  items,
  value,
  onChange,
  tone = 'brand',
}: {
  items: Item[];
  value: string;
  onChange: (id: string) => void;
  tone?: 'brand' | 'ink';
}) {
  return (
    <div
      role="tablist"
      className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = items.findIndex((item) => item.id === value);
        if (i < 0) return;
        const next = e.key === 'ArrowRight' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        onChange(items[next]!.id);
        e.preventDefault();
      }}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cn(
              'min-h-touch shrink-0 rounded-pill px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              selected
                ? tone === 'ink'
                  ? 'bg-dark-chrome text-on-dark'
                  : 'bg-primary text-on-dark'
                : tone === 'ink'
                  ? 'bg-[#ececec] text-text'
                  : 'bg-muted text-text-secondary',
            )}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function UnderlineTabs({
  items,
  value,
  onChange,
  tone = 'brand',
  caps = true,
}: {
  items: Item[];
  value: string;
  onChange: (id: string) => void;
  tone?: 'brand' | 'ink';
  caps?: boolean;
}) {
  return (
    <div role="tablist" className="flex gap-4 overflow-x-auto border-b border-border px-[var(--gutter)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              'min-h-touch shrink-0 border-b-2 px-1 text-sm font-semibold',
              caps && 'uppercase',
              selected
                ? tone === 'ink'
                  ? 'border-text text-text'
                  : 'border-primary text-primary'
                : 'border-transparent text-text-secondary',
            )}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
