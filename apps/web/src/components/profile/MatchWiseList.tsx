import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PlayerProfileStats } from '@/lib/player-profile';
import { isLiveMatch, isUpcomingMatch } from '@/lib/roles';
import type { MatchStatus } from '@/types/api';

type MatchRow = NonNullable<PlayerProfileStats['matches']>[number];
type Filter = 'all' | 'live' | 'completed' | 'upcoming';

function groupKey(m: MatchRow) {
  return m.tournamentName || m.tournamentId || '';
}

export function MatchWiseList({ matches, playerId }: { matches: NonNullable<PlayerProfileStats['matches']>; playerId?: string }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const [tournamentId, setTournamentId] = useState('all');
  const tournaments = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches) {
      if (m.tournamentId && m.tournamentName) map.set(m.tournamentId, m.tournamentName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [matches]);

  const list = matches.filter((m) => {
    if (tournamentId !== 'all' && m.tournamentId !== tournamentId) return false;
    const status = m.status as MatchStatus;
    if (filter === 'live') return isLiveMatch(status);
    if (filter === 'upcoming') return isUpcomingMatch(status);
    if (filter === 'completed') return status === 'COMPLETED' || status === 'ABANDONED';
    return true;
  });

  if (!matches.length) {
    return <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noMatchesYet')}</p>;
  }

  const groups = new Map<string, MatchRow[]>();
  for (const m of list) {
    const key = groupKey(m) || t('profile.otherMatches');
    const rows = groups.get(key) ?? [];
    rows.push(m);
    groups.set(key, rows);
  }

  return (
    <div>
      <h2 className="text-lg font-bold">{t('common.matches')}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['all', 'live', 'completed', 'upcoming'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`min-h-touch rounded-pill px-3 text-sm font-semibold ${filter === id ? 'bg-dark-chrome text-on-dark' : 'bg-muted text-text-secondary'}`}
            onClick={() => setFilter(id)}
          >
            {id === 'all' ? t('match.filterAll') : t(`match.${id}`)}
          </button>
        ))}
        {tournaments.length ? (
          <select
            className="min-h-touch max-w-full rounded-pill border border-border bg-muted px-3 text-sm font-semibold"
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
            aria-label={t('common.tournaments')}
          >
            <option value="all">{t('profile.allTournaments')}</option>
            {tournaments.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noMatchesYet')}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {[...groups.entries()].map(([name, rows]) => (
            <section key={name}>
              {name ? <h3 className="mb-2 text-sm font-bold text-text-secondary">{name}</h3> : null}
              <ul className="flex flex-col gap-3">
                {rows.map((m) => (
                  <MatchCard key={m.matchId} match={m} playerId={playerId} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({ match: m, playerId }: { match: MatchRow; playerId?: string }) {
  const { t } = useTranslation();
  const fixture = m.homeName && m.awayName ? `${m.homeName} vs ${m.awayName}` : `${m.title || m.format} vs ${m.versus}`;
  const perf = [
    m.batting ? `${m.batting.runs} ${t('profile.runs').toLowerCase()}` : null,
    m.bowling && m.bowling.wickets > 0 ? `${m.bowling.wickets} ${t('profile.wickets').toLowerCase()}` : null,
  ].filter(Boolean);
  return (
    <li className="rounded-card border border-border bg-bg p-3">
      <Link to={`/matches/${m.matchId}/centre`} className="block min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{fixture}</p>
          <span className="shrink-0 text-[10px] font-bold uppercase text-text-secondary">{m.status.replace('_', ' ')}</span>
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          {[m.when ? new Date(m.when).toLocaleDateString() : null, m.format].filter(Boolean).join(' · ')}
        </p>
        {perf.length ? <p className="mt-2 text-sm font-semibold">{perf.join(' · ')}</p> : null}
        {m.batting ? (
          <p className="mt-1 text-xs text-text-secondary">
            {m.batting.runs} ({m.batting.balls}) · {m.batting.fours}×4 · {m.batting.sixes}×6
          </p>
        ) : null}
        {m.bowling && (m.bowling.wickets > 0 || m.bowling.overs !== '0.0') ? (
          <p className="mt-1 text-xs text-text-secondary">
            {m.bowling.wickets}/{m.bowling.runs} ({m.bowling.overs})
          </p>
        ) : null}
      </Link>
      {playerId ? (
        <Link to={`/matches/${m.matchId}/player/${playerId}`} className="mt-2 inline-block text-xs font-bold text-primary">
          {t('playerHome.viewPerformance')}
        </Link>
      ) : null}
    </li>
  );
}
