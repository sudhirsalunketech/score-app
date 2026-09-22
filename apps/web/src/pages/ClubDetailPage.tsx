import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { canCreateMatch } from '@/lib/roles';
import type { Club, Team, Tournament } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { PhotoField } from '@/components/ui/PhotoField';
import { Button } from '@/components/ui/Button';
import { IconBack } from '@/components/ui/Icons';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';
import { CreateTeamModal, type CreateTeamValues } from '@/components/forms/CreateTeamModal';
import { Input } from '@/components/ui/Input';
import { isGlobalAdmin } from '@/lib/access';

export function ClubDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const clubQ = useQuery({
    queryKey: keys.club(id),
    queryFn: () => api<Club>(`/api/v1/clubs/${id}`),
    enabled: Boolean(id),
  });
  const teams = useQuery({ queryKey: keys.teams, queryFn: () => api<Team[]>('/api/v1/teams') });
  const tournaments = useQuery({ queryKey: keys.tournaments, queryFn: () => api<Tournament[]>('/api/v1/tournaments') });
  const save = useMutation({
    mutationFn: () =>
      api<Club>(`/api/v1/clubs/${id}`, {
        method: 'PATCH',
        body: { name, city, description, establishedYear: clubQ.data?.establishedYear },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.club(id) });
      void qc.invalidateQueries({ queryKey: keys.clubs });
      setEditing(false);
    },
  });
  const create = useMutation({
    mutationFn: (v: CreateTeamValues) => api<Team>('/api/v1/teams', { method: 'POST', body: { ...v, clubId: id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.teams });
      void qc.invalidateQueries({ queryKey: keys.clubs });
      setCreateOpen(false);
    },
  });

  const photo = useMutation({
    mutationFn: (logoUrl: string) => api<Club>(`/api/v1/clubs/${id}`, { method: 'PATCH', body: { logoUrl } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.club(id) });
      void qc.invalidateQueries({ queryKey: keys.clubs });
    },
  });
  const club = clubQ.data;
  if (clubQ.isLoading || (clubQ.isFetching && !club)) return <PageSkeleton />;
  if (clubQ.isError) return <ErrorRetry onRetry={() => void clubQ.refetch()} />;
  if (!club) return <EmptyState title={t('clubs.notFound')} />;

  const clubTeams = (teams.data ?? []).filter((team) => team.clubId === id);
  const clubTournaments = (tournaments.data ?? []).filter((tn) => tn.clubId === id);
  const canCreate = isAuthenticated && canCreateMatch(user?.role);
  const canEdit =
    isAuthenticated &&
    (isGlobalAdmin(user?.role) ||
      club.createdById === user?.id ||
      (club.members ?? []).some((m) => m.user.id === user?.id && (m.role === 'OWNER' || m.role === 'ADMIN')));

  return (
    <div className="px-[var(--gutter)] py-4">
      <header className="mb-4 flex items-center gap-2">
        <button type="button" className="touch-target -ms-2 inline-flex items-center justify-center" aria-label={t('common.back')} onClick={() => nav(-1)}>
          <IconBack />
        </button>
        <h1 className="page-title min-w-0 flex-1 truncate">{club.name}</h1>
        {canEdit ? (
          <Button
            variant="outline"
            onClick={() => {
              setName(club.name);
              setCity(club.city ?? '');
              setDescription(club.description ?? '');
              setEditing((v) => !v);
            }}
          >
            {editing ? t('common.cancel') : t('clubs.edit')}
          </Button>
        ) : null}
      </header>
      <div className="mb-6 flex items-center gap-3">
        {canEdit ? (
          <PhotoField
            kind="team"
            compact
            size={64}
            name={club.name}
            value={club.logoUrl}
            label={t('clubs.uploadLogo')}
            onUploaded={async (url) => {
              await photo.mutateAsync(url);
            }}
          />
        ) : (
          <Avatar name={club.name} src={club.logoUrl} size={64} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-secondary">
            {[club.city, club.establishedYear].filter(Boolean).join(' · ')}
          </p>
          <p className="text-sm text-text-secondary">
            {t('tournaments.teamCount', { count: clubTeams.length })}
          </p>
          {club.description ? <p className="mt-1 text-sm">{club.description}</p> : null}
        </div>
      </div>
      {editing ? (
        <form
          className="mb-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Input label={t('clubs.clubName')} value={name} onChange={(e) => setName(e.target.value)} />
          <Input label={t('clubs.city')} value={city} onChange={(e) => setCity(e.target.value)} />
          <Input label={t('clubs.descriptionLabel')} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button type="submit" variant="primaryDark" disabled={save.isPending}>
            {t('clubs.save')}
          </Button>
        </form>
      ) : null}
      {(club.members ?? []).length ? (
        <section className="mb-8">
          <h2 className="mb-3 font-bold">{t('clubs.members')}</h2>
          <ul className="divide-y divide-border">
            {club.members!.map((m) => (
              <li key={m.id} className="flex min-h-touch items-center justify-between gap-3 py-2">
                <span className="font-semibold">{m.user.name}</span>
                <span className="text-xs uppercase text-text-secondary">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{t('common.teams')}</h2>
        {canCreate ? (
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            {t('teams.create')}
          </Button>
        ) : null}
      </div>
      {clubTeams.length ? (
        <ul className="divide-y divide-border">
          {clubTeams.map((team) => (
            <li key={team.id}>
              <Link to={`/teams/${team.id}`} className="flex min-h-touch items-center gap-3 py-3">
                <Avatar name={team.name} src={team.logoUrl} kind="team" size={40} />
                <span className="font-semibold">{team.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t('teams.noTeams')} hint={t('teams.emptyHint')} />
      )}

      <h2 className="mb-3 mt-8 font-bold">{t('common.tournaments')}</h2>
      {clubTournaments.length ? (
        <ul className="divide-y divide-border">
          {clubTournaments.map((tn) => (
            <li key={tn.id}>
              <Link to={`/tournaments/${tn.id}`} className="flex min-h-touch items-center py-3 font-semibold">
                {tn.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">{t('home.noTournaments')}</p>
      )}

      <CreateTeamModal
        open={createOpen}
        defaultClubId={id}
        busy={create.isPending}
        onClose={() => setCreateOpen(false)}
        onCreate={async (v) => {
          await create.mutateAsync(v);
        }}
      />
    </div>
  );
}
