import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorRetry, Spinner } from '@/components/ui/Feedback';
import type { Team } from '@/types/api';

type BracketMatch = {
  id: string;
  title: string;
  status: string;
  knockoutSlot?: number | null;
  homeTeam: { id: string; name: string; logoUrl?: string | null };
  awayTeam: { id: string; name: string; logoUrl?: string | null };
  resultWinner?: { id: string; name: string } | null;
};

type Bracket = {
  stageType: string;
  lifecycle: string;
  champion: { id: string; name: string } | null;
  runnerUp: { id: string; name: string } | null;
  rounds: Array<{ round: string; label: string; matches: BracketMatch[] }>;
};

export function TournamentKnockoutTab({
  tournamentId,
  teams,
  canManage,
}: {
  tournamentId: string;
  teams: Team[];
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: keys.tournamentKnockout(tournamentId),
    queryFn: () => api<Bracket>(`/api/v1/tournaments/${tournamentId}/knockout`),
  });
  const generate = useMutation({
    mutationFn: () =>
      api<Bracket>(`/api/v1/tournaments/${tournamentId}/knockout/generate`, {
        method: 'POST',
        body: { teamIds: teams.map((team) => team.id), pairing: 'SEEDED' },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.tournamentKnockout(tournamentId) }),
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const data = q.data;
  if (!data?.rounds.length) {
    return (
      <div className="px-[var(--gutter)] py-4">
        <EmptyState title={t('knockout.empty')} />
        {canManage && teams.length >= 2 ? (
          <Button className="mt-4 w-full" variant="primaryDark" onClick={() => generate.mutate()} disabled={generate.isPending}>
            {t('knockout.generate')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="px-[var(--gutter)] py-4">
      {data.champion ? (
        <div className="mb-4 rounded-card border border-primary bg-primary-light p-4 text-center">
          <p className="text-xs font-bold uppercase text-primary">{t('knockout.champion')}</p>
          <p className="mt-1 text-xl font-bold">🏆 {data.champion.name}</p>
          {data.runnerUp ? <p className="mt-1 text-sm text-text-secondary">{t('knockout.runnerUp')}: {data.runnerUp.name}</p> : null}
        </div>
      ) : null}
      {data.rounds.map((round) => (
        <section key={round.round} className="mb-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-primary">{t(`knockout.round.${round.round}`, { defaultValue: round.label })}</h3>
          <ul className="flex flex-col gap-2">
            {round.matches.map((match) => (
              <li key={match.id} className="rounded-card border border-border p-3">
                <p className="text-xs text-text-secondary">{match.title}</p>
                <p className="mt-1 font-semibold">
                  {match.homeTeam.name} <span className="text-text-secondary">vs</span> {match.awayTeam.name}
                </p>
                {match.resultWinner ? (
                  <p className="mt-1 text-sm font-bold text-primary">{match.resultWinner.name}</p>
                ) : (
                  <p className="mt-1 text-xs uppercase text-text-secondary">{match.status}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {canManage && !data.champion ? (
        <Button className="w-full" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {t('knockout.regenerate')}
        </Button>
      ) : null}
    </div>
  );
}
