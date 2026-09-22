import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Feedback';
import { CreateTeamModal, type CreateTeamValues } from '@/components/forms/CreateTeamModal';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { canCreateMatch } from '@/lib/roles';
import type { Club, Team } from '@/types/api';

export function TeamPicker({
  open,
  onClose,
  onPick,
  excludeId,
  excludeIds,
  includeIds,
  minPlayers,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (team: Team) => void;
  excludeId?: string | null;
  excludeIds?: string[];
  /** When set, only these team IDs are shown (e.g. scoping to one tournament group's teams) — the "create team" shortcut is also hidden, since a newly created team wouldn't belong to that group yet. */
  includeIds?: string[];
  /** When set, only teams whose active roster has at least this many players are shown (e.g. the match's playing XI count). */
  minPlayers?: number;
}) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [clubId, setClubId] = useState('');
  const [creating, setCreating] = useState(false);
  const teams = useQuery({
    queryKey: keys.teams,
    queryFn: () => api<Team[]>('/api/v1/teams'),
    enabled: open,
  });
  const clubs = useQuery({
    queryKey: keys.clubs,
    queryFn: () => api<Club[]>('/api/v1/clubs'),
    enabled: open,
  });
  const create = useMutation({
    mutationFn: (v: CreateTeamValues) => api<Team>('/api/v1/teams', { method: 'POST', body: v }),
    onSuccess: (team) => {
      void qc.invalidateQueries({ queryKey: keys.teams });
      setCreating(false);
      onPick(team);
      onClose();
    },
  });
  const blocked = new Set([excludeId, ...(excludeIds ?? [])].filter(Boolean) as string[]);
  const allowed = includeIds ? new Set(includeIds) : null;
  const rosterSize = (x: Team) => x._count?.players ?? x.players?.length ?? 0;
  const list = (teams.data ?? []).filter((x) => {
    if (blocked.has(x.id)) return false;
    if (allowed && !allowed.has(x.id)) return false;
    if (clubId && x.clubId !== clubId) return false;
    return x.name.toLowerCase().includes(q.toLowerCase());
  });
  const canCreate = isAuthenticated && canCreateMatch(user?.role) && !includeIds;

  return (
    <>
      <BottomSheet open={open && !creating} title={t('match.selectTeam')} onClose={onClose} orange={false}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} underline />
        {typeof minPlayers === 'number' ? (
          <p className="mt-2 text-xs text-text-secondary">{t('match.minPlayersHint', { count: minPlayers })}</p>
        ) : null}
        {(clubs.data ?? []).length ? (
          <select
            className="mt-3 min-h-touch w-full rounded-lg border border-border bg-bg px-3 text-sm"
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
          >
            <option value="">{t('match.filterAllClubs')}</option>
            {(clubs.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        {canCreate ? (
          <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setCreating(true)}>
            {t('teams.create')}
          </Button>
        ) : null}
        {teams.isLoading ? <Spinner /> : null}
        {!teams.isLoading && list.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t('common.empty')}</p>
        ) : null}
        <ul className="mt-3 max-h-[50vh] divide-y divide-border overflow-y-auto">
          {list.map((team) => {
            const short = typeof minPlayers === 'number' ? Math.max(0, minPlayers - rosterSize(team)) : 0;
            const insufficient = short > 0;
            return (
              <li key={team.id}>
                <button
                  type="button"
                  disabled={insufficient}
                  className={`flex min-h-touch w-full items-center gap-3 py-2 text-start ${insufficient ? 'opacity-50' : ''}`}
                  onClick={() => {
                    if (insufficient) return;
                    onPick(team);
                    onClose();
                  }}
                >
                  <Avatar name={team.name} src={team.logoUrl} kind="team" size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold uppercase">{team.name}</span>
                    {team.club?.name ? <span className="text-xs text-text-secondary">{team.club.name}</span> : null}
                    {insufficient ? <span className="block text-xs text-danger">{t('match.needsMorePlayers', { count: short })}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-text-secondary">
                    {rosterSize(team)} {t('common.players')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
      <CreateTeamModal
        open={creating}
        onClose={() => setCreating(false)}
        busy={create.isPending}
        defaultClubId={clubId || undefined}
        onCreate={async (v) => {
          await create.mutateAsync(v);
        }}
      />
    </>
  );
}
