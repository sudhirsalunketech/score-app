import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { canCreateMatch, canScoreRole, filterMatches, isPlayerRole } from '@/lib/roles';
import { PlayerHome } from '@/components/home/PlayerHome';
import type { Club, HomeData, Match } from '@/types/api';
import { SectionHeader } from '@/components/home/SectionHeader';
import { HomeClubCard } from '@/components/home/HomeClubCard';
import { CarouselDots, MatchCarousel } from '@/components/home/MatchCard';
import { ProfileSplitCard } from '@/components/home/ProfileSplitCard';
import { TournamentCard } from '@/components/home/TournamentCard';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';
import { HomeSectionInfo } from '@/components/ui/InfoTooltip';
import { BetaBadge } from '@/components/beta/BetaBadge';
import { IconClub, IconGroup, IconMatches, IconPlay, IconTrophy } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import type { ComponentType, ReactNode, SVGProps } from 'react';

type Welcome = {
  greeting: string;
  matches: Array<{ id: string; title: string; access: string | null; home?: string; away?: string }>;
};

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const q = useQuery({ queryKey: keys.home, queryFn: () => api<HomeData>('/api/v1/home') });
  const clubsQ = useQuery({ queryKey: keys.clubs, queryFn: () => api<Club[]>('/api/v1/clubs') });
  const welcome = useQuery({
    queryKey: keys.betaWelcome,
    queryFn: () => api<Welcome>('/api/v1/beta/welcome'),
    enabled: Boolean(user),
  });

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;

  const data = q.data!;
  const all = data.matches ?? [];
  const live = data.liveMatches ?? filterMatches(all, 'live');
  const upcoming = data.upcomingMatches ?? filterMatches(all, 'upcoming');
  const recent = data.recentMatches ?? filterMatches(all, 'completed');
  const mine = data.myMatches ?? filterMatches(all, 'mine', user?.id);
  const tournaments = data.tournaments ?? [];
  const clubs = clubsQ.data ?? [];
  const profileUser = data.user ?? user;
  const canCreate = canCreateMatch(user?.role);
  if (isPlayerRole(user?.role)) {
    return <PlayerHome data={data} />;
  }
  const hour = new Date().getHours();
  const greetKey = hour < 12 ? 'home.goodMorning' : hour < 17 ? 'home.goodAfternoon' : 'home.goodEvening';
  const snap = data.profileSnapshot;
  const teams = snap?.teams ?? [];

  return (
    <div className="py-4">
      {user ? (
        <div className="mb-4 px-[var(--gutter)]">
          <h1 className="page-title flex items-center gap-2">
            {t(greetKey, { name: user.name.split(' ')[0] })}
            <BetaBadge />
          </h1>
        </div>
      ) : null}
      {user && (user.isBeta || (welcome.data?.matches.length ?? 0) > 0) ? (
        <div className="mb-6 mx-[var(--gutter)] rounded-card border border-border p-4">
          <p className="font-bold">{t('beta.welcome')}</p>
          <p className="mt-1 text-sm text-text-secondary">{t('beta.youHaveAccess')}</p>
          {(welcome.data?.matches ?? []).slice(0, 3).map((m) => (
            <div key={m.id} className="mt-3 rounded-lg bg-primary-light p-3">
              <p className="text-sm font-semibold">
                {t('beta.match')}: {m.home && m.away ? `${m.home} vs ${m.away}` : m.title}
              </p>
              {m.access ? (
                <p className="text-xs text-text-secondary">
                  {t('beta.access')}: {t(`access.level.${m.access}`, { defaultValue: m.access })}
                </p>
              ) : null}
              <Link to={m.access === 'SCORER' || m.access === 'MATCH_ADMIN' ? `/matches/${m.id}/score` : `/matches/${m.id}/centre`} className="mt-2 inline-block text-sm font-bold text-primary">
                {t('access.openMatch')}
              </Link>
            </div>
          ))}
        </div>
      ) : null}
      {canCreate || canScoreRole(user?.role) ? (
        <div className="mb-6 grid grid-cols-4 gap-2 px-[var(--gutter)] sm:grid-cols-5">
          {user ? (
            <HomeAction to="/clubs/register" icon={IconClub} label={t('home.actionClub')} title={t('drawer.registerAsClub')} />
          ) : null}
          {canCreate ? (
            <HomeAction to="/tournaments/new" icon={IconTrophy} label={t('home.actionTournament')} title={t('drawer.createTournament')} />
          ) : null}
          {canCreate ? (
            <HomeAction to="/teams?create=1" icon={IconGroup} label={t('home.actionTeam')} title={t('drawer.createTeam')} />
          ) : null}
          {canCreate ? (
            <HomeAction to="/matches/new" icon={IconMatches} label={t('home.actionMatch')} title={t('home.createMatch')} primary />
          ) : null}
          <HomeAction to="/live-matches" icon={IconPlay} label={t('home.actionLive')} title={t('home.viewLive')} />
        </div>
      ) : user ? (
        <div className="mb-6 px-[var(--gutter)]">
          <Link to="/live-matches">
            <Button className="w-full" variant="primaryDark">
              {t('home.viewLive')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mb-6 px-[var(--gutter)]">
          <Link to="/matches/new">
            <Button className="w-full" variant="primaryDark">
              {t('drawer.startMatch')}
            </Button>
          </Link>
        </div>
      )}

      {live[0] || tournaments[0] ? (
        <div className="mb-6 mx-[var(--gutter)] rounded-card border border-border p-4">
          <p className="font-bold text-primary">{t('fans.zone')}</p>
          <p className="mt-1 text-sm text-text-secondary">{t('fans.homeHint')}</p>
          {live[0] ? (
            <Link to={`/matches/${live[0].id}/fan`} className="mt-3 block text-sm font-bold text-primary">
              {t('fans.openLive')}
            </Link>
          ) : null}
          {tournaments[0] ? (
            <Link to={`/tournaments/${tournaments[0].id}/fan`} className="mt-2 block text-sm font-bold text-primary">
              {t('fans.openTournament')}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        <SectionHeader title={t('common.clubs')} to="/clubs" info={<HomeSectionInfo kind="club" />} />
        {clubsQ.isLoading ? (
          <p className="px-[var(--gutter)] text-sm text-text-secondary">{t('common.loading')}</p>
        ) : clubs.length ? (
          <div className="flex gap-3 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {clubs.map((club) => (
              <HomeClubCard key={club.id} club={club} />
            ))}
          </div>
        ) : (
          <p className="px-[var(--gutter)] text-sm text-text-secondary">{t('clubs.noClubs')}</p>
        )}
      </div>

      <div className="mt-8">
        <SectionHeader title={t('home.tournaments')} to="/tournaments" info={<HomeSectionInfo kind="tournament" />} />
        {tournaments.length ? (
          <div className="flex gap-3 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tournaments.map((tn) => (
              <TournamentCard key={tn.id} tournament={tn} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={t('home.noTournaments')}
            action={
              canCreate ? (
                <Link to="/tournaments/new">
                  <Button variant="outline">{t('drawer.createTournament')}</Button>
                </Link>
              ) : undefined
            }
          />
        )}
      </div>

      <div className="mt-8">
        <SectionHeader title={user ? t('home.myTeams') : t('common.teams')} to="/teams" info={<HomeSectionInfo kind="team" />} />
        {teams.length ? (
          <div className="flex gap-3 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {teams.map((team) => (
              <Link key={team.id} to={`/teams/${team.id}`} className="shrink-0 rounded-card border border-border px-4 py-3 text-sm font-semibold">
                {team.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-[var(--gutter)] text-sm text-text-secondary">{t('teams.noTeams')}</p>
        )}
      </div>

      <MatchSection title={t('home.live')} to="/matches?filter=live" matches={live} empty={t('home.noLive')} info={<HomeSectionInfo kind="match" />} />
      <MatchSection title={t('home.upcoming')} to="/matches?filter=upcoming" matches={upcoming} empty={t('home.noUpcoming')} info={<HomeSectionInfo kind="match" />} />
      {user ? <MatchSection title={t('home.myMatches')} to="/matches?filter=mine" matches={mine} empty={t('home.noMyMatches')} info={<HomeSectionInfo kind="match" />} /> : null}
      <MatchSection title={t('home.recent')} to="/matches?filter=completed" matches={recent} empty={t('home.noRecent')} info={<HomeSectionInfo kind="match" />} />

      {profileUser ? (
        <div className="mt-8">
          <ProfileSplitCard
            user={profileUser}
            matches={data.profileSnapshot?.matches ?? 0}
            runs={data.profileSnapshot?.runs ?? 0}
            wickets={data.profileSnapshot?.wickets ?? 0}
          />
        </div>
      ) : null}
    </div>
  );
}

function HomeAction({
  to,
  icon: Icon,
  label,
  title,
  primary,
}: {
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  label: string;
  title: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      title={title}
      aria-label={title}
      className={cn(
        'flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center',
        primary ? 'bg-primary-dark text-on-dark' : 'border border-primary text-primary',
      )}
    >
      <Icon size={22} />
      <span className="max-w-full truncate text-[10px] font-bold uppercase leading-tight tracking-wide sm:text-xs">
        {label}
      </span>
    </Link>
  );
}

function MatchSection({
  title,
  to,
  matches,
  empty,
  info,
}: {
  title: string;
  to: string;
  matches: Match[];
  empty: string;
  info?: ReactNode;
}) {
  return (
    <div className="mt-6 first:mt-0">
      <SectionHeader title={title} to={to} info={info} />
      {matches.length ? (
        <>
          <MatchCarousel matches={matches} />
          <CarouselDots count={Math.min(matches.length, 5)} index={0} />
        </>
      ) : (
        <p className="px-[var(--gutter)] text-sm text-text-secondary">{empty}</p>
      )}
    </div>
  );
}
