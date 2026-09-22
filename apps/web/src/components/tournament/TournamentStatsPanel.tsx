import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TournamentDashboard } from '@/types/api';
import { DashSection, EmptyStats, fmtAvg, PerformerCard, ResponsiveStatTable } from './dash-ui';

export function TournamentStatsPanel({
  tournamentId,
  dash,
  mode,
}: {
  tournamentId: string;
  dash: TournamentDashboard;
  mode: 'statistics' | 'records';
}) {
  const { t } = useTranslation();
  const empty = t('tournaments.noStatsYet');
  if (mode === 'records') {
    return <TournamentRecords tournamentId={tournamentId} dash={dash} empty={empty} />;
  }
  if (!dash.hasCompletedStats) {
    return (
      <div className="p-[var(--gutter)]">
        <EmptyStats title={empty} hint={t('tournaments.statsAfterMatches')} />
      </div>
    );
  }
  return (
    <div className="pb-10">
      <DashSection title={t('tournaments.batting')}>
        <ResponsiveStatTable
          tournamentId={tournamentId}
          empty={empty}
          rows={dash.batting}
          columns={[
            { key: 'player', label: t('common.players'), render: (r) => r.playerName },
            { key: 'team', label: t('common.teams'), render: (r) => r.teamName },
            { key: 'runs', label: t('profile.runs'), numeric: true, render: (r) => r.runs },
            { key: 'balls', label: t('match.balls'), numeric: true, render: (r) => r.balls },
            { key: 'avg', label: t('tournaments.average'), numeric: true, render: (r) => fmtAvg(r.average) },
            { key: 'sr', label: t('tournaments.strikeRate'), numeric: true, render: (r) => r.strikeRate.toFixed(1) },
            { key: 'hs', label: t('tournaments.highest'), numeric: true, render: (r) => r.highest },
            { key: 'inn', label: t('tournaments.innings'), numeric: true, render: (r) => r.innings },
            { key: 'no', label: t('tournaments.notOuts'), numeric: true, render: (r) => r.notOuts },
            { key: '4s', label: t('tournaments.fours'), numeric: true, render: (r) => r.fours },
            { key: '6s', label: t('tournaments.sixes'), numeric: true, render: (r) => r.sixes },
          ]}
        />
      </DashSection>
      <DashSection title={t('tournaments.bowling')}>
        <ResponsiveStatTable
          tournamentId={tournamentId}
          empty={empty}
          rows={dash.bowling}
          columns={[
            { key: 'player', label: t('common.players'), render: (r) => r.playerName },
            { key: 'team', label: t('common.teams'), render: (r) => r.teamName },
            { key: 'wkts', label: t('profile.wickets'), numeric: true, render: (r) => r.wickets },
            { key: 'overs', label: t('tournaments.overs'), numeric: true, render: (r) => r.overs },
            { key: 'runs', label: t('profile.runs'), numeric: true, render: (r) => r.runs },
            { key: 'eco', label: t('tournaments.economy'), numeric: true, render: (r) => r.economy.toFixed(2) },
            { key: 'avg', label: t('tournaments.average'), numeric: true, render: (r) => fmtAvg(r.average) },
            { key: 'best', label: t('tournaments.bestBowling'), render: (r) => r.best },
            { key: 'maid', label: t('tournaments.maidens'), numeric: true, render: (r) => r.maidens },
          ]}
        />
      </DashSection>
      <DashSection title={t('tournaments.fielding')}>
        <ResponsiveStatTable
          tournamentId={tournamentId}
          empty={empty}
          rows={dash.fielding}
          columns={[
            { key: 'player', label: t('common.players'), render: (r) => r.playerName },
            { key: 'team', label: t('common.teams'), render: (r) => r.teamName },
            { key: 'ct', label: t('tournaments.catches'), numeric: true, render: (r) => r.catches },
            { key: 'ro', label: t('tournaments.runOuts'), numeric: true, render: (r) => r.runOuts },
            { key: 'st', label: t('tournaments.stumpings'), numeric: true, render: (r) => r.stumpings },
          ]}
        />
      </DashSection>
    </div>
  );
}

function TournamentRecords({
  tournamentId,
  dash,
  empty,
}: {
  tournamentId: string;
  dash: TournamentDashboard;
  empty: string;
}) {
  const { t } = useTranslation();
  if (!dash.hasCompletedStats) {
    return (
      <div className="p-[var(--gutter)]">
        <EmptyStats title={empty} hint={t('tournaments.statsAfterMatches')} />
      </div>
    );
  }
  const r = dash.records;
  const playerRows = [
    { key: 'mostRuns', row: r.mostRuns, info: t('tournaments.infoMostRuns') },
    { key: 'highestScore', row: r.highestScore, info: t('tournaments.infoHighestScore') },
    { key: 'mostFours', row: r.mostFours },
    { key: 'mostSixes', row: r.mostSixes },
    { key: 'bestStrikeRate', row: r.bestStrikeRate, info: t('tournaments.infoBestSr') },
    { key: 'mostWickets', row: r.mostWickets },
    { key: 'bestBowling', row: r.bestBowling, info: t('tournaments.infoBestBowl') },
    { key: 'bestEconomy', row: r.bestEconomy, info: t('tournaments.infoBestEco') },
    { key: 'mostCatches', row: r.mostCatches },
    { key: 'mostRunOuts', row: r.mostRunOuts },
    { key: 'mostStumpings', row: r.mostStumpings },
  ] as const;
  return (
    <div className="pb-10">
      <DashSection title={t('tournaments.battingRecords')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {playerRows.slice(0, 5).map((item) => (
            <PerformerCard
              key={item.key}
              tournamentId={tournamentId}
              title={t(`tournaments.${item.key}`)}
              info={'info' in item ? item.info : undefined}
              player={item.row}
              lines={item.row ? [`${item.row.value}${item.row.extra ? ` · ${item.row.extra}` : ''}`] : []}
              empty={empty}
            />
          ))}
        </div>
      </DashSection>
      <DashSection title={t('tournaments.bowlingRecords')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {playerRows.slice(5, 8).map((item) => (
            <PerformerCard
              key={item.key}
              tournamentId={tournamentId}
              title={t(`tournaments.${item.key}`)}
              info={'info' in item ? item.info : undefined}
              player={item.row}
              lines={item.row ? [`${item.row.value}${item.row.extra ? ` · ${item.row.extra}` : ''}`] : []}
              empty={empty}
            />
          ))}
        </div>
      </DashSection>
      <DashSection title={t('tournaments.fieldingRecords')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {playerRows.slice(8).map((item) => (
            <PerformerCard
              key={item.key}
              tournamentId={tournamentId}
              title={t(`tournaments.${item.key}`)}
              player={item.row}
              lines={item.row ? [String(item.row.value)] : []}
              empty={empty}
            />
          ))}
        </div>
      </DashSection>
      <DashSection title={t('tournaments.teamRecords')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TeamScoreCard title={t('tournaments.highestTeamScore')} row={r.highestTeamScore} empty={empty} />
          <TeamScoreCard title={t('tournaments.lowestTeamScore')} row={r.lowestTeamScore} empty={empty} />
          <MarginCard title={t('tournaments.largestWinningMargin')} row={r.largestWinningMargin} empty={empty} />
          <MarginCard title={t('tournaments.closestMatch')} row={r.closestMatch} empty={empty} />
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-bold uppercase text-text-secondary">{t('tournaments.mostTeamWins')}</p>
            {r.mostTeamWins ? (
              <p className="mt-2 font-bold">
                {r.mostTeamWins.teamName} · {r.mostTeamWins.wins}
              </p>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">{empty}</p>
            )}
          </div>
        </div>
      </DashSection>
    </div>
  );
}

function TeamScoreCard({
  title,
  row,
  empty,
}: {
  title: string;
  row: TournamentDashboard['records']['highestTeamScore'];
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-bold uppercase text-text-secondary">{title}</p>
      {row ? (
        <Link to={`/matches/${row.matchId}/centre`} className="mt-2 block">
          <p className="font-bold">
            {row.teamName} · {row.runs}/{row.wickets} ({row.overs})
          </p>
          <p className="text-xs text-text-secondary">{row.matchTitle}</p>
        </Link>
      ) : (
        <p className="mt-2 text-sm text-text-secondary">{empty}</p>
      )}
    </div>
  );
}

function MarginCard({
  title,
  row,
  empty,
}: {
  title: string;
  row: TournamentDashboard['records']['largestWinningMargin'];
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-bold uppercase text-text-secondary">{title}</p>
      {row ? (
        <Link to={`/matches/${row.matchId}/centre`} className="mt-2 block">
          <p className="font-bold">
            {row.winnerName} · {row.marginValue} {row.marginType === 'WICKETS' ? 'wkts' : 'runs'}
          </p>
          <p className="text-xs text-text-secondary">{row.matchTitle}</p>
        </Link>
      ) : (
        <p className="mt-2 text-sm text-text-secondary">{empty}</p>
      )}
    </div>
  );
}
