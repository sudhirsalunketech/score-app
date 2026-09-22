import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import type { TournamentDashboard } from '@/types/api';
import { DashSection, EmptyStats, PlayerLink } from './dash-ui';

export function TournamentMvpPanel({ tournamentId, dash }: { tournamentId: string; dash: TournamentDashboard }) {
  const { t } = useTranslation();
  const mvp = dash.performers.mvp;
  return (
    <div className="pb-10">
      <DashSection title={t('tournaments.tournamentMvp')} info={dash.mvpFormula}>
        {mvp ? (
          <PlayerLink tournamentId={tournamentId} player={mvp}>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <Avatar name={mvp.playerName} src={mvp.photoUrl} size={64} />
                <div>
                  <p className="text-lg font-bold">{mvp.playerName}</p>
                  <p className="text-xs uppercase text-text-secondary">{mvp.teamName}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {t('tournaments.mvpScore')}: {mvp.score.toFixed(1)}
                  </p>
                </div>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {mvp.runs > 0 ? (
                  <li>
                    {t('profile.runs')}: {mvp.runs}
                  </li>
                ) : null}
                {mvp.wickets > 0 ? (
                  <li>
                    {t('profile.wickets')}: {mvp.wickets}
                  </li>
                ) : null}
                {mvp.catches > 0 ? (
                  <li>
                    {t('tournaments.catches')}: {mvp.catches}
                  </li>
                ) : null}
                <li>
                  {t('profile.matches')}: {mvp.matches}
                </li>
              </ul>
            </div>
          </PlayerLink>
        ) : (
          <EmptyStats title={t('tournaments.mvpPending')} hint={t('tournaments.statsAfterMatches')} />
        )}
      </DashSection>
      <DashSection title={t('tournaments.matchAwards')} info={t('tournaments.infoMatchAwards')}>
        {dash.matchAwards.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-text-secondary">
                    <th className="py-2 text-start">{t('common.matches')}</th>
                    <th className="py-2 text-start">{t('common.players')}</th>
                    <th className="py-2 text-start">{t('common.teams')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.matchAwards.map((row) => (
                    <tr key={row.matchId} className="border-b border-border">
                      <td className="py-2">
                        <Link to={`/matches/${row.matchId}/centre`} className="font-semibold text-primary">
                          {row.homeName} vs {row.awayName}
                        </Link>
                      </td>
                      <td className="py-2">
                        <Link to={`/tournaments/${tournamentId}/players/${row.playerId}`}>{row.playerName}</Link>
                      </td>
                      <td className="py-2">{row.teamName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 md:hidden">
              {dash.matchAwards.map((row) => (
                <article key={row.matchId} className="rounded-xl border border-border p-3">
                  <Link to={`/matches/${row.matchId}/centre`} className="text-sm font-semibold text-primary">
                    {row.homeName} vs {row.awayName}
                  </Link>
                  <p className="mt-1 font-bold">{row.playerName}</p>
                  <p className="text-xs uppercase text-text-secondary">{row.teamName}</p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyStats title={t('tournaments.noMatchAwards')} />
        )}
      </DashSection>
    </div>
  );
}
