import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { updateMe } from '@/lib/auth';
import { PhotoField } from '@/components/ui/PhotoField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PillTabs } from '@/components/ui/Pills';
import { PlayerProfileView } from '@/components/profile/PlayerProfileView';
import { ProfileStatsPanel } from '@/components/profile/ProfileStatsPanel';
import { InsightsPanel } from '@/components/profile/InsightsPanel';
import { ComparePanel } from '@/components/profile/ComparePanel';
import { MatchWiseList } from '@/components/profile/MatchWiseList';
import { RecentForm } from '@/components/profile/RecentForm';
import { YearlyOverviewCard } from '@/components/profile/YearlyOverviewCard';
import { BestAgainstTeamCard } from '@/components/profile/BestAgainstTeamCard';
import { PlayerAwardsCard } from '@/components/profile/PlayerAwardsCard';
import { JerseyWatermark } from '@/components/profile/JerseyWatermark';
import { ApiError, api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { recentFormHistory, type PlayerProfileStats } from '@/lib/player-profile';
import { parseProfileTab, parseStatsPanel } from '@/lib/profile-tab';
import { ErrorRetry, Skeleton, Spinner } from '@/components/ui/Feedback';

const schema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().max(20).optional(),
});

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = parseProfileTab(params.get('tab'));
  const panel = parseStatsPanel(params.get('panel'), params.get('tab'));
  const setTab = (next: string) => {
    const copy = new URLSearchParams(params);
    copy.set('tab', next);
    if (next !== 'statistics') copy.delete('panel');
    setParams(copy, { replace: false });
  };
  const setPanel = (next: string) => {
    const copy = new URLSearchParams(params);
    copy.set('tab', 'statistics');
    copy.set('panel', next);
    setParams(copy, { replace: false });
  };
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm({
    resolver: zodResolver(schema),
    values: { name: user?.name ?? '', phone: user?.phone ?? '' },
  });
  const player = user?.player;
  const loadStats = Boolean(player && tab !== 'overview');
  const overviewStats = usePlayerStats(player?.id ?? '', Boolean(player) && tab === 'overview');
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-xl px-[var(--gutter)] py-4 md:max-w-2xl md:py-6 xl:max-w-4xl xl:py-8">
      <PillTabs
        tone="ink"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: t('profile.overview') },
          { id: 'statistics', label: t('common.statistics') },
          { id: 'matches', label: t('common.matches') },
          { id: 'teams', label: t('common.teams') },
          { id: 'tournaments', label: t('common.tournaments') },
        ]}
      />
      <div className="mt-5" role="tabpanel">
        {tab === 'overview' ? (
          <>
            <PlayerProfileView
              name={player?.name ?? user.name}
              photoUrl={user.avatarUrl ?? player?.photoUrl}
              role={player?.role}
              battingStyle={player?.battingStyle}
              bowlingStyle={player?.bowlingStyle}
              profileCode={player?.profileCode}
              stats={player?.stats}
              photoSlot={
                editing ? (
                  <PhotoField
                    kind="person"
                    name={user.name}
                    value={user.avatarUrl}
                    onUploaded={async (url) => {
                      await updateMe({ avatarUrl: url });
                      await refreshUser();
                      setSaved(true);
                    }}
                  />
                ) : undefined
              }
            />
            <div className="mt-5 flex flex-nowrap items-center justify-center gap-5 text-sm font-semibold">
              <button type="button" className="inline-flex h-10 items-center whitespace-nowrap text-primary" onClick={() => setEditing((v) => !v)}>
                {editing ? t('common.cancel') : t('profile.edit')}
              </button>
              <Link to="/settings" className="inline-flex h-10 items-center whitespace-nowrap text-primary">{t('common.settings')}</Link>
              <Link to="/following" className="inline-flex h-10 items-center whitespace-nowrap text-primary">{t('drawer.following')}</Link>
              {user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? (
                <Link to="/access" className="inline-flex h-10 items-center whitespace-nowrap text-primary">{t('access.dashboard')}</Link>
              ) : null}
            </div>
            {editing ? (
              <form
                className="mx-auto mt-4 flex max-w-md flex-col gap-3"
                onSubmit={form.handleSubmit(async (v) => {
                  setError(null);
                  setSaved(false);
                  try {
                    await updateMe({ name: v.name, phone: v.phone || undefined });
                    await refreshUser();
                    setSaved(true);
                    setEditing(false);
                  } catch (e) {
                    setError(e instanceof ApiError ? e.message : t('common.error'));
                  }
                })}
              >
                <Input label={t('auth.name')} underline {...form.register('name')} error={form.formState.errors.name?.message} />
                <Input label={t('profile.phone')} underline {...form.register('phone')} />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                <Button type="submit" variant="primaryDark" disabled={form.formState.isSubmitting}>
                  {t('common.save')}
                </Button>
              </form>
            ) : null}
            {saved ? <p className="mt-3 text-center text-sm text-primary">{t('profile.saved')}</p> : null}
            {overviewStats.isLoading ? (
              <div className="mt-6 flex flex-col gap-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                {(() => {
                  const { battingHistory, bowlingHistory } = recentFormHistory(overviewStats.data?.matches);
                  return <RecentForm battingHistory={battingHistory} bowlingHistory={bowlingHistory} />;
                })()}
                {overviewStats.data?.yearly ? (
                  <YearlyOverviewCard thisYear={overviewStats.data.yearly.thisYear} lastYear={overviewStats.data.yearly.lastYear} />
                ) : null}
                {overviewStats.data?.bestAgainstTeam ? <BestAgainstTeamCard teams={overviewStats.data.bestAgainstTeam} /> : null}
                <PlayerAwardsCard playerOfMatchCount={overviewStats.data?.playerOfMatchCount ?? 0} />
              </>
            )}
            <JerseyWatermark jerseyNo={player?.jerseyNo} />
          </>
        ) : null}
        {tab === 'statistics' ? (
          <>
            <div className="mb-4">
              <PillTabs
                tone="ink"
                value={panel}
                onChange={setPanel}
                items={[
                  { id: 'stats', label: t('common.statistics') },
                  { id: 'insights', label: t('profile.insights') },
                  { id: 'compare', label: t('profile.compare') },
                  { id: 'fan', label: t('profile.fan') },
                ]}
              />
            </div>
            {panel === 'stats' ? (
              player ? <OwnStats playerId={player.id} enabled={loadStats} /> : <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noStatsYet')}</p>
            ) : null}
            {panel === 'insights' && player ? <OwnInsights playerId={player.id} /> : null}
            {panel === 'compare' && player ? <OwnCompare playerId={player.id} name={player.name ?? user.name} role={player.role} /> : null}
            {panel === 'fan' ? <FanProfileCard /> : null}
          </>
        ) : null}
        {tab === 'matches' ? (
          player ? <OwnMatches playerId={player.id} enabled={loadStats} /> : <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noMatchesYet')}</p>
        ) : null}
        {tab === 'teams' ? (
          <Link to="/my-teams" className="block py-6 text-center text-sm font-bold text-primary">{t('drawer.myTeams')}</Link>
        ) : null}
        {tab === 'tournaments' ? (
          <Link to="/my-tournaments" className="block py-6 text-center text-sm font-bold text-primary">{t('drawer.myTournaments')}</Link>
        ) : null}
      </div>
    </div>
  );
}

function usePlayerStats(playerId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.playerStats(playerId),
    queryFn: () => api<PlayerProfileStats>(`/api/v1/players/${playerId}/statistics`),
    enabled,
  });
}

function OwnStats({ playerId, enabled }: { playerId: string; enabled: boolean }) {
  const stats = usePlayerStats(playerId, enabled);
  if (stats.isLoading) return <Spinner />;
  return <ProfileStatsPanel playerId={playerId} data={stats.data} />;
}

function OwnMatches({ playerId, enabled }: { playerId: string; enabled: boolean }) {
  const stats = usePlayerStats(playerId, enabled);
  if (stats.isLoading) return <Spinner />;
  return <MatchWiseList matches={stats.data?.matches ?? []} />;
}

function OwnInsights({ playerId }: { playerId: string }) {
  const { t } = useTranslation();
  const stats = usePlayerStats(playerId, true);
  if (stats.isLoading) return <Spinner />;
  if (!stats.data?.insights) return <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noStatsYet')}</p>;
  return <InsightsPanel insights={stats.data.insights} />;
}

function OwnCompare({ playerId, name, role }: { playerId: string; name: string; role?: string | null }) {
  const { t } = useTranslation();
  const stats = usePlayerStats(playerId, true);
  if (stats.isLoading) return <Spinner />;
  if (!stats.data?.tables?.overall) return <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noStatsYet')}</p>;
  return <ComparePanel selfId={playerId} selfName={name} selfRole={role} self={stats.data.tables.overall} />;
}

function FanProfileCard() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: keys.fanProfile,
    queryFn: () =>
      api<{
        points: number;
        rank: number | null;
        predictions: number;
        predictionsCorrect: number;
        accuracy: number;
        quizzes: number;
        quizzesCorrect: number;
        badges: string[];
        history: Array<{ id: string; points: number; reason: string }>;
      }>('/api/v1/users/me/fan-profile'),
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  if (!q.data) return <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noStatsYet')}</p>;
  return (
    <div className="rounded-card border border-border p-4">
      <p className="text-sm font-bold uppercase text-primary">{t('fans.profile')}</p>
      <p className="mt-2 text-2xl font-bold">{q.data.points} {t('fans.fanPoints')}</p>
      <p className="text-sm text-text-secondary">{t('fans.yourRank')}: {q.data.rank ? `#${q.data.rank}` : '—'}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-text-secondary">{t('fans.predictions')}</dt><dd className="font-semibold">{q.data.predictions}</dd></div>
        <div><dt className="text-text-secondary">{t('fans.correctAnswer')}</dt><dd className="font-semibold">{q.data.predictionsCorrect}</dd></div>
        <div><dt className="text-text-secondary">{t('fans.accuracy')}</dt><dd className="font-semibold">{q.data.accuracy}%</dd></div>
        <div><dt className="text-text-secondary">{t('fans.quiz')}</dt><dd className="font-semibold">{q.data.quizzes} / {q.data.quizzesCorrect}</dd></div>
      </dl>
      <p className="mt-3 text-sm">{q.data.badges.map((b) => t(`fans.badge.${b}`, { defaultValue: b })).join(' ')}</p>
      <h3 className="mt-4 font-bold">{t('fans.history')}</h3>
      <ul className="mt-2 divide-y divide-border text-sm">
        {q.data.history.map((row) => (
          <li key={row.id} className="flex justify-between py-2">
            <span>{row.reason}</span>
            <span className="font-semibold">+{row.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
