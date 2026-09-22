import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { IconSearch } from '@/components/ui/Icons';
import { playerRoleLabel } from '@/lib/match-result';
import type { PlayerProfileStats, SliceView } from '@/lib/player-profile';
import { dash } from '@/lib/player-profile';

type SearchHit = { id: string; name: string; role?: string | null; profileCode?: string | null };

const ROWS: Array<{ key: keyof SliceView; label: string }> = [
  { key: 'matches', label: 'profile.matches' },
  { key: 'innings', label: 'profile.innings' },
  { key: 'runs', label: 'profile.runs' },
  { key: 'average', label: 'profile.average' },
  { key: 'sr', label: 'profile.strikeRate' },
  { key: 'thirties', label: 'profile.thirties' },
  { key: 'fifties', label: 'profile.fifties' },
  { key: 'hundreds', label: 'profile.hundreds' },
];

function roleCaption(role: string | null | undefined, translate: (key: string) => string) {
  if (!role) return null;
  return translate(`playingXI.${playerRoleLabel(role)}`).toUpperCase();
}

export function ComparePanel({
  selfId,
  selfName,
  selfRole,
  self,
}: {
  selfId?: string;
  selfName: string;
  selfRole?: string | null;
  self: SliceView;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [other, setOther] = useState<SearchHit | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDq(q.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [q]);

  const searching = dq.length >= 2;
  const search = useQuery({
    queryKey: keys.search(dq),
    queryFn: () => api<{ players: SearchHit[] }>(`/api/v1/search?q=${encodeURIComponent(dq)}`),
    enabled: searching,
  });
  const otherStats = useQuery({
    queryKey: keys.playerStats(other?.id ?? ''),
    queryFn: () => api<PlayerProfileStats>(`/api/v1/players/${other!.id}/statistics`),
    enabled: Boolean(other?.id),
  });

  const hits = (search.data?.players ?? []).filter((p) => p.id !== selfId);
  const otherSlice = otherStats.data?.tables?.overall;
  const selfRoleText = roleCaption(selfRole, t);
  const otherRoleText = roleCaption(other?.role, t);
  const showEmpty = !other && !searching;

  return (
    <div className="flex min-h-[55vh] flex-col">
      <label className="relative block">
        <span className="sr-only">{t('profile.searchCompare')}</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('profile.searchCompare')}
          className="min-h-touch w-full rounded-pill bg-muted px-4 pe-11 text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <IconSearch size={18} className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-text-secondary" />
      </label>

      {searching ? (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {hits.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex min-h-touch w-full items-center justify-between px-3 py-2 text-start"
                onClick={() => {
                  setOther(p);
                  setQ('');
                  setDq('');
                }}
              >
                <span className="font-semibold">{p.name}</span>
                <span className="text-xs text-text-secondary">{p.profileCode}</span>
              </button>
            </li>
          ))}
          {search.isFetched && !hits.length ? (
            <li className="px-3 py-4 text-center text-sm text-text-secondary">{t('search.empty')}</li>
          ) : null}
        </ul>
      ) : null}

      {showEmpty ? (
        <p className="flex flex-1 items-center justify-center text-center text-sm text-text-secondary">
          {t('profile.searchCompare')}.
        </p>
      ) : null}

      {other && !searching ? (
        <article className="mt-4 rounded-2xl border border-border bg-bg p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-start">
              <p className="font-bold">{selfName}</p>
              {selfRoleText ? <p className="text-[11px] font-semibold tracking-wide text-text-secondary">{selfRoleText}</p> : null}
            </div>
            <div className="text-end">
              <p className="font-bold">{other.name}</p>
              {otherRoleText ? <p className="text-[11px] font-semibold tracking-wide text-text-secondary">{otherRoleText}</p> : null}
            </div>
          </div>
          <h3 className="mt-5 text-center text-lg font-bold">{t('profile.batting')}</h3>
          <ul className="mt-3 space-y-2.5">
            {ROWS.map((row) => (
              <li key={row.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                <span className="justify-self-start rounded-md bg-muted px-3 py-1 font-bold tabular-nums">
                  {dash(self[row.key])}
                </span>
                <span className="min-w-[4.5rem] text-center text-xs font-bold">{t(row.label)}</span>
                <span className="justify-self-end rounded-md bg-muted px-3 py-1 font-bold tabular-nums">
                  {otherSlice ? dash(otherSlice[row.key]) : '—'}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </div>
  );
}
