import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { dash, type PlayerProfileStats, type SliceView } from '@/lib/player-profile';
import type { TournamentPlayerStats } from '@/types/api';
import { FormatStatsTable } from './FormatStatsTable';
import { Spinner } from '@/components/ui/Feedback';

function hasSliceData(s?: SliceView | null) {
  if (!s) return false;
  return s.matches > 0 || s.runs > 0 || s.wickets > 0 || s.catches + s.stumpings + s.runOuts > 0;
}

export function ProfileStatsPanel({
  playerId,
  data,
}: {
  playerId: string;
  data?: PlayerProfileStats | null;
}) {
  const { t } = useTranslation();
  const tournaments = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of data?.matches ?? []) {
      if (m.tournamentId && m.tournamentName) map.set(m.tournamentId, m.tournamentName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [data?.matches]);
  const [scope, setScope] = useState('all');
  const tn = useQuery({
    queryKey: keys.playerTournamentStats(playerId, scope),
    queryFn: () => api<TournamentPlayerStats>(`/api/v1/players/${playerId}/tournaments/${scope}/statistics`),
    enabled: scope !== 'all',
  });

  const overall = data?.tables?.overall;
  const emptyAll = !hasSliceData(overall);
  const emptyTn = tn.data ? tn.data.matches === 0 && tn.data.runs === 0 && tn.data.wickets === 0 : false;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t('common.statistics')}</h2>
        {tournaments.length ? (
          <label className="flex min-w-0 items-center gap-2 text-sm">
            <span className="sr-only">{t('profile.statScope')}</span>
            <select
              className="min-h-touch max-w-full rounded-pill border border-border bg-muted px-3 text-sm font-semibold"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="all">{t('profile.allTime')}</option>
              {tournaments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {scope === 'all' ? (
        emptyAll ? (
          <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noStatsYet')}</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <article className="rounded-xl border border-border p-3">
                <p className="text-xs font-bold uppercase text-primary">{t('profile.batting')}</p>
                <p className="mt-1 text-2xl font-bold">{overall?.runs ?? 0} {t('profile.runs')}</p>
                <p className="text-xs text-text-secondary">{overall?.sr ?? 0} SR · {overall?.highest ?? 0} {t('profile.highScore')}</p>
              </article>
              <article className="rounded-xl border border-border p-3">
                <p className="text-xs font-bold uppercase text-primary">{t('profile.bowling')}</p>
                <p className="mt-1 text-2xl font-bold">{overall?.wickets ?? 0} {t('profile.wickets')}</p>
                <p className="text-xs text-text-secondary">{dash(overall?.economy)} {t('profile.economy')} · {overall?.best ?? '—'}</p>
              </article>
              <article className="rounded-xl border border-border p-3">
                <p className="text-xs font-bold uppercase text-primary">MVP</p>
                <p className="mt-1 text-2xl font-bold">{data?.mvp?.total ?? tn.data?.mvpPoints ?? 0}</p>
                <p className="text-xs text-text-secondary">
                  {data?.mvp?.batting ?? 0} {t('profile.bat')} · {data?.mvp?.bowling ?? 0} {t('profile.bowl')} · {data?.mvp?.fielding ?? 0} {t('profile.field')}
                </p>
              </article>
              <article className="rounded-xl border border-border p-3">
                <p className="text-xs font-bold uppercase text-primary">{t('profile.fielding')}</p>
                <p className="mt-1 text-2xl font-bold">{overall?.catches ?? 0}</p>
                <p className="text-xs text-text-secondary">{overall?.runOuts ?? 0} {t('profile.runouts')}</p>
              </article>
            </div>
            <StatBlock title={t('profile.batting')} rows={[
              [t('profile.matches'), overall?.matches ?? 0],
              [t('profile.innings'), overall?.innings ?? 0],
              [t('profile.runs'), overall?.runs ?? 0],
              [t('profile.ballsFaced'), overall?.balls ?? 0],
              [t('profile.average'), dash(overall?.average)],
              [t('profile.strikeRate'), dash(overall?.sr)],
              [t('profile.highScore'), overall?.highest ?? 0],
              [t('profile.fours'), overall?.fours ?? 0],
              [t('profile.sixes'), overall?.sixes ?? 0],
              [t('profile.fifties'), overall?.fifties ?? 0],
              [t('profile.hundreds'), overall?.hundreds ?? 0],
            ]} />
            <StatBlock title={t('profile.bowling')} rows={[
              [t('profile.matches'), overall?.matches ?? 0],
              [t('profile.overs'), overall ? `${Math.floor(overall.bowlBalls / 6)}.${overall.bowlBalls % 6}` : '0.0'],
              [t('profile.ballsFaced'), overall?.bowlBalls ?? 0],
              [t('profile.runs'), overall?.bowlRuns ?? 0],
              [t('profile.wickets'), overall?.wickets ?? 0],
              [t('profile.economy'), dash(overall?.economy)],
              [t('profile.average'), dash(overall?.bowlAverage)],
              [t('profile.bestBowling'), overall?.best && overall.best !== '—' ? overall.best : '—'],
              [t('profile.maidens'), overall?.maidens ?? 0],
              [t('profile.dots'), overall?.dots ?? 0],
            ]} />
            <StatBlock title={t('profile.fielding')} rows={[
              [t('profile.catches'), overall?.catches ?? 0],
              [t('profile.stumpings'), overall?.stumpings ?? 0],
              [t('profile.runouts'), overall?.runOuts ?? 0],
            ]} />
            <StatBlock title="MVP" rows={[
              [t('profile.bat'), data?.mvp?.batting ?? 0],
              [t('profile.bowl'), data?.mvp?.bowling ?? 0],
              [t('profile.field'), data?.mvp?.fielding ?? 0],
              [t('home.mvpPoints'), data?.mvp?.total ?? 0],
            ]} />
            {data?.tables?.byFormat && Object.values(data.tables.byFormat).some(hasSliceData) ? (
              <FormatStatsTable byFormat={data.tables.byFormat} kind="bat" />
            ) : null}
          </>
        )
      ) : tn.isLoading ? (
        <Spinner label={t('statistics.fetching')} />
      ) : emptyTn || !tn.data ? (
        <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noTournamentStats')}</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-text-secondary">{tn.data.tournamentName} · {t('profile.tournamentOnly')}</p>
          <StatBlock title={t('profile.batting')} rows={[
            [t('profile.matches'), tn.data.matches],
            [t('profile.runs'), tn.data.runs],
            [t('profile.average'), dash(tn.data.average)],
            [t('profile.strikeRate'), tn.data.strikeRate],
            [t('profile.highScore'), tn.data.highest],
            [t('profile.innings'), tn.data.innings],
            [t('profile.ballsFaced'), tn.data.balls],
            [t('profile.fours'), tn.data.fours ?? 0],
            [t('profile.sixes'), tn.data.sixes ?? 0],
            [t('profile.fifties'), tn.data.fifties ?? 0],
            [t('profile.hundreds'), tn.data.hundreds ?? 0],
          ]} />
          <StatBlock title={t('profile.bowling')} rows={[
            [t('profile.overs'), tn.data.overs],
            [t('playerHome.runsConceded'), tn.data.runsConceded ?? 0],
            [t('profile.wickets'), tn.data.wickets],
            [t('profile.economy'), tn.data.economy],
            [t('profile.bestBowling'), tn.data.bestBowling ?? '—'],
          ]} />
          <StatBlock title={t('profile.fielding')} rows={[
            [t('profile.catches'), tn.data.catches],
            [t('profile.stumpings'), tn.data.stumpings],
            [t('profile.runouts'), tn.data.runOuts],
          ]} />
          {(tn.data.matchesDetail ?? []).length ? (
            <section className="mt-5">
              <h3 className="text-sm font-bold text-text-secondary">{t('playerHome.matchByMatch')}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {tn.data.matchesDetail!.map((m) => (
                  <li key={m.matchId} className="rounded-xl border border-border p-3 text-sm">
                    <Link to={`/matches/${m.matchId}/player/${playerId}`} className="font-semibold text-primary">
                      {m.homeName} vs {m.awayName}
                    </Link>
                    <p className="mt-1">
                      {t('profile.batting')}: {m.batting ? `${m.batting.runs} (${m.batting.balls})` : '—'} · {t('profile.bowling')}:{' '}
                      {m.bowling ? `${m.bowling.wickets}-${m.bowling.runs}` : '—'} · MVP {m.mvp.total}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function StatBlock({ title, rows }: { title: string; rows: Array<[string, string | number]> }) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-bold text-text-secondary">{title}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border px-3 py-2">
            <dt className="text-[11px] uppercase text-text-secondary">{label}</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
