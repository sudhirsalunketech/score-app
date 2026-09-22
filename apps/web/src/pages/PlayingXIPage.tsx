import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { assignExclusiveRole, toggleSelectedPlayer, validatePlayingXi } from '@/lib/playing-xi';
import { filterPlayersForSearch } from '@/lib/player-search';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { playerRoleLabel } from '@/lib/match-result';
import { useAuth } from '@/context/AuthContext';
import { canManageThisMatch } from '@/lib/roles';
import { hasMatchPerm } from '@/lib/access';
import type { Match, Player, PlayingXiDto, PlayingXiPlayer } from '@/types/api';
import { IconBack } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input, NumericInput, Select } from '@/components/ui/Input';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { cn } from '@/lib/cn';

type RoleKey = 'captain' | 'vice' | 'wk';

export function PlayingXIPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [selected, setSelected] = useState<PlayingXiPlayer[]>([]);
  const [rolePick, setRolePick] = useState<RoleKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createRole, setCreateRole] = useState('BATTER');
  const [createJersey, setCreateJersey] = useState('');
  const [addedIds, setAddedIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDq(q.trim().toLowerCase()), 200);
    return () => window.clearTimeout(timer);
  }, [q]);

  const match = useQuery({
    queryKey: keys.match(id),
    queryFn: () => api<Match>(`/api/v1/matches/${id}`),
  });
  const xi = useQuery({
    queryKey: keys.playingXi(id),
    queryFn: () => api<PlayingXiDto>(`/api/v1/matches/${id}/playing-xi`),
  });

  const data = xi.data;
  const activeId = teamId ?? data?.home.teamId ?? null;
  const side = activeId === data?.away.teamId ? data?.away : data?.home;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const canEdit =
    Boolean(match.data && user && (hasMatchPerm(match.data, 'MATCH_MANAGE_PLAYING_XI') || hasMatchPerm(match.data, 'MATCH_MANAGE_PLAYERS') || canManageThisMatch(user, match.data))) &&
    (!data?.locked || isAdmin);

  useEffect(() => {
    if (!side) return;
    setSelected(
      side.players.map((p) => ({
        ...p,
        isCaptain: p.isCaptain,
        isViceCaptain: p.isViceCaptain,
        isWicketKeeper: p.isWicketKeeper,
      })),
    );
  }, [side?.teamId, xi.dataUpdatedAt]);

  const roster = useMemo(() => {
    const list = side?.roster ?? [];
    if (!dq) return list;
    return list.filter((p) => {
      const hay = `${p.name} ${p.jerseyNo ?? ''} ${p.role ?? ''}`.toLowerCase();
      return hay.includes(dq);
    });
  }, [side?.roster, dq]);

  const rosterIds = (side?.roster ?? []).map((p) => p.playerId);
  const playerSearch = useQuery({
    queryKey: keys.playerSearch(dq),
    queryFn: () => api<Player[]>(`/api/v1/players?q=${encodeURIComponent(dq)}&limit=20`),
    enabled: addOpen && dq.length >= 2,
  });
  const searchHits = filterPlayersForSearch(
    (playerSearch.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      profileCode: p.profileCode,
      role: p.role,
      jerseyNo: p.profile?.jerseyNo ?? null,
    })),
    dq,
    rosterIds,
  );

  const refreshRoster = () => {
    void qc.invalidateQueries({ queryKey: keys.playingXi(id) });
    void qc.invalidateQueries({ queryKey: keys.match(id) });
    void qc.invalidateQueries({ queryKey: keys.playerSearch(dq) });
  };

  const addToTeam = useMutation({
    mutationFn: (playerId: string) =>
      api(`/api/v1/teams/${activeId}/players`, { method: 'POST', body: { playerId } }),
    onSuccess: (_row, playerId) => {
      setAddedIds((cur) => (cur.includes(playerId) ? cur : [...cur, playerId]));
      refreshRoster();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const createPlayer = useMutation({
    mutationFn: () =>
      api<Player>('/api/v1/players', {
        method: 'POST',
        body: {
          name: createName.trim(),
          teamId: activeId,
          role: createRole,
          jerseyNo: createJersey ? Number(createJersey) : undefined,
        },
      }),
    onSuccess: () => {
      setCreateName('');
      setCreateJersey('');
      refreshRoster();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const save = useMutation({
    mutationFn: () =>
      api<PlayingXiDto>(`/api/v1/matches/${id}/playing-xi`, {
        method: 'PUT',
        body: {
          teamId: activeId,
          force: Boolean(data?.locked && isAdmin),
          players: selected.map((p) => ({
            playerId: p.playerId,
            isCaptain: Boolean(p.isCaptain),
            isViceCaptain: Boolean(p.isViceCaptain),
            isWicketKeeper: Boolean(p.isWicketKeeper),
          })),
        },
      }),
    onSuccess: (next) => {
      void qc.setQueryData(keys.playingXi(id), next);
      void qc.invalidateQueries({ queryKey: keys.match(id) });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const max = data?.playingPerSide ?? 8;
  const captain = selected.find((p) => p.isCaptain);
  const vice = selected.find((p) => p.isViceCaptain);
  const wk = selected.find((p) => p.isWicketKeeper);

  const toggle = (player: PlayingXiPlayer) => {
    if (!canEdit) return;
    const ids = toggleSelectedPlayer(
      selected.map((p) => p.playerId),
      player.playerId,
      max,
    );
    setSelected((cur) => {
      if (!ids.includes(player.playerId)) return cur.filter((p) => p.playerId !== player.playerId);
      if (cur.some((p) => p.playerId === player.playerId)) return cur;
      return [...cur, { ...player, isCaptain: false, isViceCaptain: false, isWicketKeeper: false }];
    });
  };

  const assign = (playerId: string, role: RoleKey) => {
    const flag = role === 'captain' ? 'isCaptain' : role === 'vice' ? 'isViceCaptain' : 'isWicketKeeper';
    setSelected((cur) => assignExclusiveRole(cur, playerId, flag));
    setRolePick(null);
  };

  const localErrors =
    side && data
      ? validatePlayingXi({
          teamId: side.teamId,
          matchTeamIds: [data.home.teamId, data.away.teamId],
          playingPerSide: data.playingPerSide,
          rosterPlayerIds: side.roster.map((p) => p.playerId),
          players: selected,
        })
      : [];

  if (xi.isLoading) return <Spinner />;
  if (xi.isError || !data) return <ErrorRetry onRetry={() => void xi.refetch()} />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col bg-bg pb-[max(5.5rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 flex min-h-16 items-center border-b border-border bg-bg pt-[env(safe-area-inset-top)]">
        <button type="button" className="touch-target inline-flex items-center justify-center" aria-label={t('common.back')} onClick={() => nav(-1)}>
          <IconBack />
        </button>
        <h1 className="flex-1 text-center text-lg font-bold">{t('playingXI.title')}</h1>
        <span className="touch-target" />
      </header>

      <div className="px-[var(--gutter)] pt-5">
        <div className="mb-5 grid grid-cols-2 gap-3 text-center">
          <p className="text-base font-bold uppercase">{data.home.name}</p>
          <p className="text-base font-bold uppercase">{data.away.name}</p>
          <p className="text-xs font-semibold text-text-secondary">{t('playingXI.title')}</p>
          <p className="text-xs font-semibold text-text-secondary">{t('playingXI.title')}</p>
        </div>

        <div className="mb-4 flex rounded-pill bg-muted p-1">
          {[data.home, data.away].map((team) => (
            <button
              key={team.teamId}
              type="button"
              className={cn(
                'min-h-touch flex-1 rounded-pill px-2 text-sm font-bold uppercase',
                activeId === team.teamId ? 'bg-primary text-on-dark' : 'text-text-secondary',
              )}
              onClick={() => setTeamId(team.teamId)}
            >
              {team.shortName || team.name}
            </button>
          ))}
        </div>

        {data.locked ? <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm text-text-secondary">{t('playingXI.locked')}</p> : null}

        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('playingXI.search')} underline />
        <p className="mt-2 text-sm text-text-secondary">
          {t('playingXI.selectedCount', { count: selected.length, max })}
        </p>

        <ul className="mt-2 divide-y divide-border">
          {roster.map((player) => {
            const on = selected.some((p) => p.playerId === player.playerId);
            const row = selected.find((p) => p.playerId === player.playerId);
            return (
              <li key={player.playerId}>
                <button
                  type="button"
                  disabled={!canEdit && !on}
                  className="flex min-h-touch w-full items-center gap-3 py-3 text-start"
                  onClick={() => toggle(player)}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold',
                      on ? 'border-primary bg-primary text-on-dark' : 'border-border text-text-secondary',
                    )}
                    aria-hidden
                  >
                    {on ? '✓' : ''}
                  </span>
                  <Avatar name={player.name} src={player.photoUrl} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="truncate">{player.name}</span>
                      {row?.isCaptain ? <span className="rounded bg-primary px-1.5 text-[10px] font-bold text-on-dark">C</span> : null}
                      {row?.isViceCaptain ? <span className="rounded bg-muted px-1.5 text-[10px] font-bold">VC</span> : null}
                      {row?.isWicketKeeper ? <span className="rounded bg-muted px-1.5 text-[10px] font-bold">WK</span> : null}
                    </span>
                    <span className="block text-xs text-text-secondary">
                      {t(`playingXI.${playerRoleLabel(player.role)}`)}
                      {player.jerseyNo != null ? ` · #${player.jerseyNo}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {canEdit ? (
          <button type="button" className="mt-3 min-h-touch w-full text-start text-sm font-bold text-primary" onClick={() => setAddOpen(true)}>
            {t('playingXI.searchAdd')}
          </button>
        ) : null}

        <div className="mt-4 space-y-2">
          <RoleRow label={t('playingXI.captain')} value={captain?.name} disabled={!canEdit} onClick={() => setRolePick('captain')} selectLabel={t('playingXI.select')} />
          <RoleRow label={t('playingXI.viceCaptain')} value={vice?.name} disabled={!canEdit} onClick={() => setRolePick('vice')} selectLabel={t('playingXI.select')} />
          <RoleRow label={t('playingXI.wicketKeeper')} value={wk?.name} disabled={!canEdit} onClick={() => setRolePick('wk')} selectLabel={t('playingXI.select')} />
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {localErrors[0] && canEdit ? <p className="mt-3 text-sm text-danger">{localErrors[0].message}</p> : null}
      </div>

      {canEdit ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg px-[var(--gutter)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button className="h-12 w-full" disabled={save.isPending || localErrors.length > 0} onClick={() => void save.mutate()}>
            {t('playingXI.save')}
          </Button>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg px-[var(--gutter)] py-3">
          <Button className="h-12 w-full" variant="outline" onClick={() => nav(`/matches/${id}`)}>
            {t('playingXI.continue')}
          </Button>
        </div>
      )}

      <BottomSheet open={rolePick !== null} title={rolePick === 'captain' ? t('playingXI.captain') : rolePick === 'vice' ? t('playingXI.viceCaptain') : t('playingXI.wicketKeeper')} onClose={() => setRolePick(null)} orange={false}>
        <ul className="divide-y divide-border">
          {selected.map((p) => (
            <li key={p.playerId}>
              <button type="button" className="flex min-h-touch w-full items-center gap-3 py-3 text-start" onClick={() => rolePick && assign(p.playerId, rolePick)}>
                <Avatar name={p.name} src={p.photoUrl} size={40} />
                <span className="font-semibold">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet open={addOpen} title={t('playingXI.searchPlayers')} onClose={() => setAddOpen(false)} orange={false}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('playingXI.search')} underline />
        {playerSearch.isFetching ? <p className="mt-3 text-sm text-text-secondary">{t('common.loading')}</p> : null}
        <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto">
          {searchHits.map((player) => {
            const added = addedIds.includes(player.id) || rosterIds.includes(player.id);
            return (
              <li key={player.id} className="flex min-h-touch items-center gap-3 py-2">
                <Avatar name={player.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{player.name}</span>
                  <span className="block text-xs text-text-secondary">
                    {t(`playingXI.${playerRoleLabel(player.role)}`)}
                    {player.jerseyNo != null ? ` · #${player.jerseyNo}` : ''}
                    {player.profileCode ? ` · ${player.profileCode}` : ''}
                  </span>
                </span>
                <Button
                  type="button"
                  variant={added ? 'outline' : 'primary'}
                  className="min-h-11 px-3 text-xs"
                  disabled={added || addToTeam.isPending || !activeId}
                  onClick={() => void addToTeam.mutate(player.id)}
                >
                  {added ? t('playingXI.added') : t('playingXI.add')}
                </Button>
              </li>
            );
          })}
        </ul>
        {dq.length >= 2 && !playerSearch.isFetching && searchHits.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t('playingXI.noSearchResults')}</p>
        ) : null}
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (createName.trim().length >= 2) createPlayer.mutate();
          }}
        >
          <p className="text-sm font-bold">{t('playingXI.createPlayer')}</p>
          <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={t('common.name')} />
          <Select value={createRole} onChange={(e) => setCreateRole(e.target.value)} label={t('playingXI.role')}>
            <option value="BATTER">{t('playingXI.batter')}</option>
            <option value="BOWLER">{t('playingXI.bowler')}</option>
            <option value="ALL_ROUNDER">{t('playingXI.allRounder')}</option>
            <option value="WICKET_KEEPER">{t('playingXI.wk')}</option>
          </Select>
          <NumericInput value={createJersey} onChange={(e) => setCreateJersey(e.target.value)} placeholder={t('playingXI.jersey')} />
          <Button type="submit" className="h-12 w-full" disabled={createPlayer.isPending || createName.trim().length < 2}>
            {t('playingXI.createPlayer')}
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
}

function RoleRow({
  label,
  value,
  disabled,
  onClick,
  selectLabel,
}: {
  label: string;
  value?: string;
  disabled: boolean;
  onClick: () => void;
  selectLabel: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex min-h-touch w-full items-center justify-between border-b border-border py-2 text-start"
      onClick={onClick}
    >
      <span className="text-sm font-semibold text-text-secondary">{label}</span>
      <span className={cn('font-bold', value ? 'text-primary' : 'text-text-secondary')}>{value || selectLabel}</span>
    </button>
  );
}
