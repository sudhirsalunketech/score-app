import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { canCreateMatch, filterMatches } from '@/lib/roles';
import type { Match, MatchFormat } from '@/types/api';
import { MatchCard, MatchTable } from '@/components/home/MatchCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UnderlineTabs } from '@/components/ui/Pills';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

type Tab = 'all' | 'live' | 'upcoming' | 'completed' | 'cancelled' | 'mine' | 'assigned';

export function MatchesPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [qtext, setQtext] = useState('');
  const fromPath: Tab = loc.pathname === '/live-matches' ? 'live' : 'all';
  const tab = (params.get('filter') as Tab | null) || fromPath;
  const tournamentId = params.get('tournament') ?? '';
  const format = (params.get('format') as MatchFormat | null) ?? '';
  const q = useQuery({ queryKey: keys.matches, queryFn: () => api<Match[]>('/api/v1/matches') });
  const assigned = useQuery({
    queryKey: keys.myAssignedMatches,
    queryFn: () => api<Match[]>('/api/v1/users/me/matches'),
    enabled: isAuthenticated,
  });

  const source =
    tab === 'assigned'
      ? assigned.data ?? []
      : filterMatches(q.data ?? [], tab === 'mine' ? 'mine' : tab, user?.id);

  const tournaments = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of q.data ?? []) {
      if (m.tournamentId && m.tournament?.name) map.set(m.tournamentId, m.tournament.name);
    }
    return [...map.entries()];
  }, [q.data]);

  const formats = useMemo(() => {
    const set = new Set<MatchFormat>();
    for (const m of q.data ?? []) set.add(m.format);
    return [...set];
  }, [q.data]);

  const matches = useMemo(() => {
    const needle = qtext.trim().toLowerCase();
    return source
      .filter((m) => !tournamentId || m.tournamentId === tournamentId)
      .filter((m) => !format || m.format === format)
      .filter((m) => {
        if (!needle) return true;
        return [m.title, m.homeTeam.name, m.awayTeam.name, m.venueText, m.tournament?.name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle));
      })
      .slice()
      .sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? ''));
  }, [source, qtext, tournamentId, format]);

  const items: { id: Tab; label: string }[] = [
    { id: 'all', label: t('match.filterAll') },
    { id: 'live', label: t('match.live') },
    { id: 'upcoming', label: t('match.upcoming') },
    { id: 'completed', label: t('match.completed') },
    { id: 'cancelled', label: t('match.cancelled') },
  ];
  if (isAuthenticated) items.push({ id: 'mine', label: t('home.myMatches') }, { id: 'assigned', label: t('access.assigned') });

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;

  return (
    <div className="py-4">
      <div className="flex items-end gap-1">
        <div className="min-w-0 flex-1">
      <UnderlineTabs
        value={tab}
        onChange={(id) => {
          const next = new URLSearchParams(params);
          if (id === 'all') next.delete('filter');
          else next.set('filter', id);
          if (loc.pathname === '/live-matches') nav(`/matches?${next.toString()}`);
          else setParams(next);
        }}
        tone="ink"
        items={items}
      />
        </div>
        <div className="mb-1 pe-[var(--gutter)]">
          <InfoTooltip topic={t('match.status')}>{t('info.match.statusFilter')}</InfoTooltip>
        </div>
      </div>
      <div className="px-[var(--gutter)] pt-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input value={qtext} onChange={(e) => setQtext(e.target.value)} placeholder={t('match.search')} underline />
          </div>
          {formats.length > 1 ? (
            <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
              <span className="font-semibold text-text-secondary">{t('match.filterFormat')}</span>
              <select
                className="min-h-touch rounded-lg border border-border bg-bg px-3"
                value={format}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  if (e.target.value) next.set('format', e.target.value);
                  else next.delete('format');
                  setParams(next);
                }}
              >
                <option value="">{t('match.filterAll')}</option>
                {formats.map((f) => (
                  <option key={f} value={f}>
                    {formatLabel(f, t)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {tournaments.length ? (
            <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
              <span className="font-semibold text-text-secondary">{t('match.filterTournament')}</span>
              <select
                className="min-h-touch rounded-lg border border-border bg-bg px-3"
                value={tournamentId}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  if (e.target.value) next.set('tournament', e.target.value);
                  else next.delete('tournament');
                  setParams(next);
                }}
              >
                <option value="">{t('match.filterAll')}</option>
                {tournaments.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {canCreateMatch(user?.role) ? (
            <Link to="/matches/new">
              <Button variant="primaryDark">{t('drawer.startMatch')}</Button>
            </Link>
          ) : null}
        </div>
        {matches.length === 0 ? (
          <EmptyState
            title={t('home.noMatches')}
            hint={t('match.emptyHint')}
            action={
              canCreateMatch(user?.role) ? (
                <Link to="/matches/new">
                  <Button>{t('match.start')}</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="flex flex-col items-stretch gap-3 md:hidden">
              {matches.map((m) => (
                <MatchCard key={m.id} match={m} layout="list" />
              ))}
            </div>
            <div className="hidden md:block">
              <MatchTable matches={matches} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const FORMAT_LABEL_KEYS: Record<MatchFormat, string> = {
  T10: 'match.formatT10',
  T20: 'match.formatT20',
  HUNDRED: 'match.formatHundred',
  ODI: 'match.formatOdi',
  TEST: 'match.formatTest',
  CLUB: 'match.formatClub',
  CUSTOM: 'match.formatCustom',
};

function formatLabel(format: MatchFormat, t: (key: string) => string) {
  return t(FORMAT_LABEL_KEYS[format] ?? format);
}
