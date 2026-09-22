import { useQuery } from '@tanstack/react-query';
import { keys } from '@/lib/query-keys';
import { fetchPublicConfig } from '@/lib/config';

export function BetaBadge({ publicPage = false }: { publicPage?: boolean }) {
  const q = useQuery({ queryKey: keys.publicConfig, queryFn: fetchPublicConfig, staleTime: 60_000 });
  const cfg = q.data;
  if (!cfg?.beta) return null;
  if (publicPage && !cfg.badgeOnPublic) return null;
  return (
    <span className="rounded bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-dark-chrome">
      Beta
    </span>
  );
}
