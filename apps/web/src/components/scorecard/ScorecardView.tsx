import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { economy, playerName, playingXiPlayers, strikeRate, teamById } from '@/lib/format';
import { hasMatchPerm } from '@/lib/access';
import type { InningsSnapshot, Match, OverRulesResponse } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { API_URL, api } from '@/lib/api';
import { keys } from '@/lib/query-keys';

export type ScorecardInnings = {
  battingTeamId: string;
  bowlingTeamId: string;
  snapshot: InningsSnapshot;
  inningsNumber?: number;
  status?: string;
};

export function ScorecardView({
  match,
  snapshots,
  selectedIndex,
  onSelectIndex,
  showOverRulesLink = true,
}: {
  match: Match;
  snapshots: ScorecardInnings[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  showOverRulesLink?: boolean;
}) {
  const { t } = useTranslation();
  const overRules = useQuery({
    queryKey: keys.overRules(match.id),
    queryFn: () => api<OverRulesResponse>(`/api/v1/matches/${match.id}/over-rules`),
  });
  const idx = Math.min(Math.max(selectedIndex, 0), Math.max(snapshots.length - 1, 0));
  const inn = snapshots[idx];
  const snap = inn?.snapshot;
  const inningsId = inn ? match.innings?.find((row) => row.inningsNumber === inn.inningsNumber)?.id : undefined;
  const overRuleResults = inningsId ? (overRules.data?.results ?? []).filter((r) => r.inningsId === inningsId) : [];
  const ruleBonusRuns = overRuleResults.reduce((sum, r) => sum + r.bonusRuns, 0);
  const rulePenaltyRuns = overRuleResults.reduce((sum, r) => sum + r.penaltyRuns, 0);
  const battingTeamId = inn?.battingTeamId ?? match.homeTeam.id;
  const batting = teamById(match, battingTeamId) ?? match.homeTeam;
  const declared = inn?.status === 'DECLARED';
  const teamOrdinal = (i: number) => snapshots.slice(0, i + 1).filter((row) => row.battingTeamId === snapshots[i]!.battingTeamId).length;
  const xi = playingXiPlayers(match, battingTeamId);
  const battedIds = new Set((snap?.batters ?? []).map((b) => b.playerId));
  const waiting = xi.filter((p) => !battedIds.has(p.id));
  const waitingLabel = inn && match.status !== 'LIVE' && match.status !== 'INNINGS_BREAK' ? t('scorecard.didNotBat') : t('scorecard.yetToBat');
  const extraChips = snap
    ? [
        snap.extrasBreakdown.wides ? `${t('scoring.widePlain')} ${snap.extrasBreakdown.wides}` : null,
        snap.extrasBreakdown.noBalls ? `${t('scoring.noBallPlain')} ${snap.extrasBreakdown.noBalls}` : null,
        snap.extrasBreakdown.byes ? `${t('scoring.byeN', { n: snap.extrasBreakdown.byes })}` : null,
        snap.extrasBreakdown.legByes ? `${t('scoring.legByeN', { n: snap.extrasBreakdown.legByes })}` : null,
        snap.extrasBreakdown.penalty > 0 ? `${t('scorecard.bonus')} ${snap.extrasBreakdown.penalty}` : null,
        snap.extrasBreakdown.penalty < 0 ? `${t('scorecard.penalty')} ${snap.extrasBreakdown.penalty}` : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="px-[var(--gutter)] pb-8">
      <div className="cs-no-print mb-3 flex gap-2">
        {snapshots.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={async () => {
              const token = localStorage.getItem('cs.access');
              const res = await fetch(`${API_URL}/api/v1/matches/${match.id}/scorecard.pdf`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!res.ok) {
                window.print();
                return;
              }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank', 'noopener');
            }}
          >
            {t('share.downloadPdf')}
          </Button>
        ) : null}
        {hasMatchPerm(match, 'MATCH_CORRECT_BALL') &&
        (match.status === 'COMPLETED' || match.status === 'ABANDONED' || match.status === 'CANCELLED') ? (
          <Link to={`/matches/${match.id}/edit-scorecard`} className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              {t('correction.editScorecard')}
            </Button>
          </Link>
        ) : null}
        {showOverRulesLink &&
        hasMatchPerm(match, 'MATCH_EDIT') &&
        (match.overWiseRulesEnabled || match.status === 'DRAFT' || match.status === 'SCHEDULED') ? (
          <Link to={`/matches/${match.id}/over-rules`} className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              {t('overRules.title')}
            </Button>
          </Link>
        ) : null}
      </div>
      {snapshots.length ? (
        <div className="my-3 flex gap-1 overflow-x-auto rounded-pill bg-muted p-1">
          {snapshots.map((row, i) => {
            const team = teamById(match, row.battingTeamId);
            const label = team?.shortName || team?.name || '—';
            const ordinal = teamOrdinal(i);
            return (
              <button
                key={row.inningsNumber ?? i}
                type="button"
                className={cn(
                  'min-h-touch flex-1 shrink-0 whitespace-nowrap rounded-pill px-3 text-sm font-bold uppercase',
                  idx === i ? 'bg-primary text-on-dark' : 'text-text-secondary',
                )}
                onClick={() => onSelectIndex(i)}
              >
                {snapshots.length > 2 ? `${label} - ${ordinal >= 2 ? t('scorecard.ing2') : t('scorecard.ing1')}` : label}
              </button>
            );
          })}
        </div>
      ) : null}

      {!snap ? (
        <p className="py-8 text-center text-text-secondary">{t('common.empty')}</p>
      ) : (
        <>
          {snapshots.length > 2 ? (
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-secondary">
              {batting.name} · {teamOrdinal(idx) >= 2 ? t('match.secondInnings') : t('match.firstInnings')}
            </p>
          ) : null}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-on-dark">
                <th className="px-2 py-2 text-start font-semibold">{t('scoring.batsman')}</th>
                <th className="px-1 text-end">{t('scoring.runs')}</th>
                <th className="px-1 text-end">{t('scoring.balls')}</th>
                <th className="px-1 text-end">{t('scoring.fours')}</th>
                <th className="px-1 text-end">{t('scoring.sixes')}</th>
                <th className="px-2 text-end">{t('scoring.sr')}</th>
              </tr>
            </thead>
            <tbody>
          {snap.batters.map((b) => (
                <tr key={b.playerId} className="border-b border-border">
                  <td className="py-2">
                    <p className="font-semibold">{playerName(match, b.playerId)}</p>
                    {b.isOut ? (
                      <p className="text-xs italic text-text-secondary">{b.dismissalType ?? 'out'}</p>
                    ) : (
                      <p className="text-xs text-primary">not out</p>
                    )}
                  </td>
                  <td className="text-end font-bold">{b.runs}</td>
                  <td className="text-end">{b.balls}</td>
                  <td className="text-end">{b.fours}</td>
                  <td className="text-end">{b.sixes}</td>
                  <td className="text-end">{strikeRate(b.runs, b.balls)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {waiting.length ? (
            <p className="mt-3 text-sm text-text-secondary">
              {waitingLabel}: {waiting.map((p) => p.name).join(', ')}
            </p>
          ) : null}

          <div className="my-3 rounded-lg bg-muted p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p>
                {t('match.extras')}: <strong>{snap.extras}</strong>
                {extraChips.length ? <span className="ms-2 text-text-secondary">({extraChips.join(' · ')})</span> : null}
              </p>
              <p className="text-text-secondary">{t('match.crr')} {snap.currentRunRate.toFixed(2)}</p>
            </div>
            <p className="text-xl font-bold text-primary">
              {t('scorecard.total')} {snap.totalRuns}/{snap.totalWickets}
              {declared ? <span className="ms-1 text-sm font-semibold text-text-secondary">d</span> : null}
            </p>
            <p className="text-text-secondary">{t('match.overs')} {snap.oversDisplay}</p>
          </div>

          {overRuleResults.length ? (
            <div className="my-3 rounded-lg border border-border p-3 text-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-secondary">{t('overRules.scorecardHeading')}</p>
              <div className="flex flex-col gap-1">
                {overRuleResults.map((r) => (
                  <div key={r.overNumber} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-text-secondary">
                      {t('match.overNum', { n: r.overNumber + 1 })} — {r.ruleName ?? t('overRules.defaultRuleName', { n: r.overNumber + 1 })}
                    </span>
                    <span className="tabular-nums">
                      {t('overRules.actual')}: {r.actualRuns}
                      {r.bonusRuns ? <span className="ms-2 font-semibold text-success">+{r.bonusRuns}</span> : null}
                      {r.penaltyRuns ? <span className="ms-2 font-semibold text-danger">-{r.penaltyRuns}</span> : null}
                      <span className="ms-2 font-bold text-primary">
                        {t('overRules.contribution')}: {r.actualRuns + r.bonusRuns - r.penaltyRuns}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-border pt-2 font-bold">
                <span>{t('overRules.finalTeamTotal')}</span>
                <span className="text-primary tabular-nums">
                  {snap.totalRuns} {ruleBonusRuns ? `+${ruleBonusRuns}` : ''} {rulePenaltyRuns ? `-${rulePenaltyRuns}` : ''} ={' '}
                  {snap.totalRuns + ruleBonusRuns - rulePenaltyRuns}
                </span>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-primary text-on-dark">
                  <th className="px-2 py-2 text-start">{t('scoring.bowler')}</th>
                  <th className="text-end">{t('scoring.oversCol')}</th>
                  <th className="text-end">{t('scoring.maidens')}</th>
                  <th className="text-end">{t('scoring.runs')}</th>
                  <th className="text-end">{t('scoring.wicketsCol')}</th>
                  <th className="px-1 text-end">{t('scoring.eco')}</th>
                  <th className="px-1 text-end">{t('scoring.widePlain')}</th>
                  <th className="px-1 text-end">{t('scoring.noBallPlain')}</th>
                  <th className="px-1 text-end">{t('scoring.fours')}</th>
                  <th className="px-1 text-end">{t('scoring.sixes')}</th>
                </tr>
              </thead>
              <tbody>
                {snap.bowlers.map((b) => (
                  <tr key={b.playerId} className="border-b border-border">
                    <td className="py-2 font-semibold">{playerName(match, b.playerId)}</td>
                    <td className="text-end">
                      {Math.floor(b.balls / match.ballsPerOver)}.{b.balls % match.ballsPerOver}
                    </td>
                    <td className="text-end">{b.maidens}</td>
                    <td className="text-end">{b.runs}</td>
                    <td className="text-end">{b.wickets}</td>
                    <td className="text-end">{economy(b.runs, b.balls, match.ballsPerOver)}</td>
                    <td className="text-end">{b.wides}</td>
                    <td className="text-end">{b.noBalls}</td>
                    <td className="text-end">{b.fours}</td>
                    <td className="text-end">{b.sixes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {snap.fallOfWickets.length ? (
            <div className="mt-4">
              <h3 className="mb-2 font-bold">{t('scorecard.fallOfWickets')}</h3>
              <table className="w-full text-sm">
                <tbody>
                  {snap.fallOfWickets.map((f) => (
                    <tr key={f.wicketNumber} className="border-b border-border">
                      <td className="w-6 py-1 text-text-secondary">{f.wicketNumber}</td>
                      <td className="py-1">{playerName(match, f.playerId)}</td>
                      <td className="py-1 text-end tabular-nums text-text-secondary">
                        {f.score} ({f.overs.toFixed(1)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {snap.partnerships.length ? (
            <div className="mt-6">
              <h3 className="mb-3 text-center font-bold">{t('scorecard.partnership')}</h3>
              <div className="flex flex-col gap-4">
                {snap.partnerships.map((p, i) => (
                  <div key={i} className="flex items-center justify-center gap-3">
                    <p className="w-24 truncate text-end text-sm font-semibold">{playerName(match, p.batterIds[0])}</p>
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-dark">
                      {p.runs}({p.balls})
                    </div>
                    <p className="w-24 truncate text-sm font-semibold">{playerName(match, p.batterIds[1])}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="sr-only">
            <Avatar name={batting.name} />
          </div>
        </>
      )}
    </div>
  );
}
