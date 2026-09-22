import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocalDate, toLocalDateInput, toLocalTimeInput } from '@/lib/datetime';
import type { Match } from '@/types/api';
import { IconLeatherBall, IconTennisBall } from '@/components/ui/Icons';
import { isLeatherBall, matchBallLabelKey } from '@/lib/ball-type';
import { LiveIndicator } from '@/components/centre/MatchSummary';
import { teamById } from '@/lib/format';

export function MatchInfoTab({ match }: { match: Match }) {
  const { t } = useTranslation();
  const when = match.scheduledAt
    ? `${formatLocalDate(toLocalDateInput(match.scheduledAt))} · ${toLocalTimeInput(match.scheduledAt)}`
    : '—';
  return (
    <dl className="divide-y divide-border px-[var(--gutter)] pb-8">
      <InfoRow label={t('match.live')} value={<LiveIndicator status={match.status} />} />
      <InfoRow label={t('common.venue')} value={match.venueText || '—'} />
      <InfoRow label={t('common.date')} value={when} />
      <InfoRow
        label={t('match.format')}
        value={t('match.formatLine', { overs: match.overs, format: match.format, wickets: match.maxWickets })}
      />
      <InfoRow
        label={t('match.ballType')}
        value={
          <span className="inline-flex items-center gap-2">
            {isLeatherBall(match.ballType) ? <IconLeatherBall size={20} /> : <IconTennisBall size={20} />}
            {t(matchBallLabelKey(match.ballType))}
          </span>
        }
      />
      <InfoRow label={t('match.teamA')} value={match.homeTeam.name} />
      <InfoRow label={t('match.teamB')} value={match.awayTeam.name} />
      {match.tossWinnerTeamId ? (
        <InfoRow
          label={t('match.toss')}
          value={t('match.tossWonElected', {
            team: teamById(match, match.tossWinnerTeamId)?.name ?? '—',
            decision: match.tossDecision === 'BOWL' ? t('match.bowl') : t('match.bat'),
          })}
        />
      ) : null}
      {match.tournament?.name ? <InfoRow label={t('home.tournaments')} value={match.tournament.name} /> : null}
      {match.tournament?.season ? <InfoRow label={t('match.season')} value={match.tournament.season} /> : null}
    </dl>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="max-w-[60%] text-end text-sm font-semibold">{value}</dd>
    </div>
  );
}
