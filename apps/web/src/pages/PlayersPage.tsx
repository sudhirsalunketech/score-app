import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import type { Player } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';

type LookupRow = {
  playerId: string;
  displayName: string;
  profilePhoto?: string | null;
  profileCode: string;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
};

function canLookup(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SCORER' || role === 'TEAM_MANAGER';
}

function isSensitiveQuery(value: string) {
  return value.includes('@') || /^\+?\d[\d\s-]{8,}$/.test(value);
}

export function PlayersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [qtext, setQtext] = useState('');
  const sensitive = isSensitiveQuery(qtext.trim());
  const q = useQuery({
    queryKey: keys.playerSearch(`${qtext}:${sensitive && canLookup(user?.role) ? 'secure' : 'public'}`),
    queryFn: async () => {
      if (sensitive && canLookup(user?.role)) {
        const rows = await api<LookupRow[]>('/api/v1/players/lookup', { method: 'POST', body: { query: qtext.trim() } });
        return rows.map((row) => ({
          id: row.playerId,
          name: row.displayName,
          photoUrl: row.profilePhoto,
          profileCode: row.profileCode,
          battingStyle: row.battingStyle,
          bowlingStyle: row.bowlingStyle,
          role: '',
        })) as Player[];
      }
      const path = qtext.trim() ? `/api/v1/players?q=${encodeURIComponent(qtext.trim())}&limit=20` : '/api/v1/players';
      return api<Player[]>(path);
    },
  });
  const players = useMemo(() => q.data ?? [], [q.data]);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;

  return (
    <div className="px-[var(--gutter)] py-4">
      <Input
        value={qtext}
        onChange={(e) => setQtext(e.target.value)}
        placeholder={canLookup(user?.role) ? t('players.searchHintSecure') : t('players.searchHint')}
        underline
      />
      {!players.length ? <EmptyState title={t('players.empty')} /> : null}
      <ul className="mt-2 divide-y divide-border">
        {players.map((p) => (
          <li key={p.id}>
            <Link to={`/players/${p.id}`} className="flex min-h-touch items-center gap-3 py-3">
              <Avatar name={p.name} src={p.photoUrl} size={44} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{p.name}</span>
                {p.profileCode ? <span className="block text-xs text-text-secondary">{p.profileCode}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
