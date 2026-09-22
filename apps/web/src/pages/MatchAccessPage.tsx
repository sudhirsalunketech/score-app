import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import {
  ACCESS_PRESETS,
  matchChecklist,
  tournamentChecklist,
  type AccessLevelKey,
} from '@/lib/access';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { IconBack } from '@/components/ui/Icons';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';

type AccessRow = {
  id: string;
  level: AccessLevelKey;
  permissions: string[];
  status: string;
  expiresAt?: string | null;
  grantedAt?: string;
  user?: { id: string; name: string; email?: string; role?: string; avatarUrl?: string | null };
  grantedBy?: { id: string; name: string } | null;
};

type SearchHit = {
  users: Array<{ id: string; name: string; email: string; role: string; avatarUrl?: string | null; player?: { id: string; name: string } | null }>;
  players: Array<{ id: string; name: string; profileCode?: string | null; photoUrl?: string | null; userId?: string | null; user?: { id: string; email: string } | null }>;
};

const LEVELS: AccessLevelKey[] = ['VIEWER', 'PLAYER', 'SCORER', 'MATCH_ADMIN', 'CUSTOM'];

export function EntityAccessPage({ entity }: { entity: 'match' | 'tournament' }) {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [giveOpen, setGiveOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<AccessRow | null>(null);
  const listKey = entity === 'match' ? keys.matchAccess(id) : keys.tournamentAccess(id);
  const path = entity === 'match' ? `/api/v1/matches/${id}/access` : `/api/v1/tournaments/${id}/access`;
  const rows = useQuery({ queryKey: listKey, queryFn: () => api<AccessRow[]>(path) });
  const logs = useQuery({
    queryKey: keys.accessLogs(entity === 'match' ? 'Match' : 'Tournament', id),
    queryFn: () =>
      api<Array<{ id: string; action: string; createdAt: string; user?: { name: string } | null; meta?: { allowed?: boolean } }>>(
        `/api/v1/access/logs?entity=${entity === 'match' ? 'Match' : 'Tournament'}&entityId=${id}`,
      ),
  });

  const revoke = useMutation({
    mutationFn: (accessId: string) => api(`${path}/${accessId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: listKey }),
  });

  if (rows.isLoading) return <Spinner />;
  if (rows.isError) return <ErrorRetry onRetry={() => void rows.refetch()} />;

  return (
    <div className="px-[var(--gutter)] py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-4 flex items-center gap-2">
        <button type="button" className="touch-target inline-flex items-center justify-center" aria-label={t('common.back')} onClick={() => nav(-1)}>
          <IconBack />
        </button>
        <h1 className="flex-1 text-center text-lg font-bold uppercase">{t('access.title')}</h1>
        <span className="w-10" />
      </header>
      <Button className="mb-4 w-full" variant="primaryDark" onClick={() => setGiveOpen(true)}>
        + {t('access.giveAccess')}
      </Button>
      <div className="flex flex-col gap-3">
        {(rows.data ?? []).map((row) => (
          <article key={row.id} className="rounded-card border border-border p-3">
            <div className="flex items-center gap-3">
              <Avatar name={row.user?.name ?? t('access.player')} src={row.user?.avatarUrl} kind="person" size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{row.user?.name}</p>
                <p className="text-xs text-text-secondary">
                  {t(`access.level.${row.level}`)} · {t(`access.status.${row.status}`)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              {t('access.grantedBy')}: {row.grantedBy?.name ?? '—'} · {row.grantedAt ? new Date(row.grantedAt).toLocaleDateString() : '—'} ·{' '}
              {t('access.expires')}: {row.expiresAt ? new Date(row.expiresAt).toLocaleString() : t('access.never')}
            </p>
            <div className="mt-2 flex gap-3">
              <button type="button" className="min-h-touch text-sm font-semibold text-primary" onClick={() => setEditing(row)}>
                {t('access.editAccess')}
              </button>
              <button type="button" className="min-h-touch text-sm font-semibold text-danger" onClick={() => void revoke.mutate(row.id)}>
                {t('access.removeAccess')}
              </button>
            </div>
          </article>
        ))}
      </div>
      <button type="button" className="mt-4 min-h-touch text-sm font-semibold text-primary" onClick={() => setInviteOpen(true)}>
        {t('access.invitePlayer')}
      </button>
      {logs.data?.length ? (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase text-text-secondary">{t('access.history')}</h2>
          <ul className="space-y-2 text-sm">
            {logs.data.slice(0, 12).map((log) => (
              <li key={log.id} className="border-b border-border py-2">
                <span className="font-semibold">{log.user?.name ?? '—'}</span> · {log.action}
                {log.meta?.allowed === false ? ` · ${t('access.denied')}` : ''}
                <span className="block text-xs text-text-secondary">{new Date(log.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <GiveAccessSheet
        open={giveOpen || Boolean(editing)}
        entity={entity}
        entityId={id}
        editing={editing}
        onClose={() => {
          setGiveOpen(false);
          setEditing(null);
        }}
        onInvite={() => {
          setGiveOpen(false);
          setInviteOpen(true);
        }}
      />
      <InviteSheet open={inviteOpen} entity={entity} entityId={id} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

function GiveAccessSheet({
  open,
  entity,
  entityId,
  editing,
  onClose,
  onInvite,
}: {
  open: boolean;
  entity: 'match' | 'tournament';
  entityId: string;
  editing: AccessRow | null;
  onClose: () => void;
  onInvite: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState(editing?.user?.id ?? '');
  const [level, setLevel] = useState<AccessLevelKey>(editing?.level ?? 'VIEWER');
  const [custom, setCustom] = useState<string[]>(editing?.permissions ?? []);
  const [expiresAt, setExpiresAt] = useState(editing?.expiresAt ? editing.expiresAt.slice(0, 16) : '');
  const search = useQuery({
    queryKey: keys.peopleSearch(q),
    queryFn: () => api<SearchHit>(`/api/v1/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2 && !editing,
  });
  const levels: AccessLevelKey[] =
    entity === 'tournament'
      ? ['VIEWER', 'PLAYER', 'SCORER', 'MATCH_ADMIN', 'TOURNAMENT_ADMIN', 'CUSTOM']
      : ['VIEWER', 'PLAYER', 'SCORER', 'MATCH_ADMIN', 'CUSTOM'];
  const checklist = entity === 'match' ? matchChecklist() : tournamentChecklist();
  const path = entity === 'match' ? `/api/v1/matches/${entityId}/access` : `/api/v1/tournaments/${entityId}/access`;

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        userId,
        level,
        permissions: level === 'CUSTOM' ? custom : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      };
      if (editing) return api(`${path}/${editing.id}`, { method: 'PATCH', body });
      return api(path, { method: 'POST', body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: entity === 'match' ? keys.matchAccess(entityId) : keys.tournamentAccess(entityId) });
      onClose();
    },
  });

  return (
    <BottomSheet open={open} title={editing ? t('access.editAccess') : t('access.giveAccess')} onClose={onClose} orange={false}>
      {!editing ? (
        <>
          <Input label={t('access.searchUser')} value={q} onChange={(e) => setQ(e.target.value)} underline placeholder={t('access.searchHint')} />
          <div className="mt-2 max-h-40 overflow-y-auto">
            {(search.data?.users ?? []).map((u) => (
              <button
                key={u.id}
                type="button"
                className={`flex min-h-touch w-full items-center gap-2 text-start text-sm ${userId === u.id ? 'font-bold text-primary' : ''}`}
                onClick={() => setUserId(u.id)}
              >
                {u.name} · {u.email}
              </button>
            ))}
            {(search.data?.players ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex min-h-touch w-full items-center justify-between text-start text-sm"
                onClick={() => {
                  if (p.userId || p.user?.id) setUserId(p.userId ?? p.user!.id);
                  else onInvite();
                }}
              >
                <span>
                  {p.name}
                  {p.user ? ` · ${p.user.email}` : ` · ${t('access.linkAccount')}`}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
      <p className="mt-4 text-sm font-semibold">{t('access.accessLevel')}</p>
      <div className="mt-2 flex flex-col gap-1">
        {levels.map((id) => (
          <label key={id} className="flex min-h-touch items-center gap-2 text-sm">
            <input type="radio" name="level" checked={level === id} onChange={() => setLevel(id)} />
            {t(`access.level.${id}`)}
          </label>
        ))}
      </div>
      {level === 'CUSTOM' ? (
        <div className="mt-3 max-h-48 overflow-y-auto">
          {checklist.map((perm) => (
            <label key={perm} className="flex min-h-touch items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={custom.includes(perm)}
                onChange={() => setCustom((cur) => (cur.includes(perm) ? cur.filter((x) => x !== perm) : [...cur, perm]))}
              />
              {t(`access.perm.${perm}`)}
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-text-secondary">{ACCESS_PRESETS[level].map((p) => t(`access.perm.${p}`)).join(' · ')}</p>
      )}
      <Input label={t('access.expires')} type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} underline />
      <p className="text-xs text-text-secondary">{t('access.never')}</p>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button className="flex-1" variant="primaryDark" disabled={!userId && !editing} onClick={() => void save.mutate()}>
          {t('access.grant')}
        </Button>
      </div>
      {!editing ? (
        <button type="button" className="mt-3 min-h-touch w-full text-center text-sm font-semibold text-primary" onClick={onInvite}>
          {t('access.inviteNew')}
        </button>
      ) : null}
    </BottomSheet>
  );
}

function InviteSheet({
  open,
  entity,
  entityId,
  onClose,
}: {
  open: boolean;
  entity: 'match' | 'tournament';
  entityId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [level, setLevel] = useState<AccessLevelKey>('PLAYER');
  const [link, setLink] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: () =>
      api<{ invited?: boolean; granted?: boolean; inviteUrl?: string }>(
        entity === 'match' ? `/api/v1/matches/${entityId}/invitations` : '/api/v1/invitations',
        {
          method: 'POST',
          body: {
            name,
            email,
            phone: phone || undefined,
            level,
            matchId: entity === 'match' ? entityId : undefined,
            tournamentId: entity === 'tournament' ? entityId : undefined,
          },
        },
      ),
    onSuccess: (res) => {
      if (res.inviteUrl) setLink(res.inviteUrl);
      else onClose();
    },
  });
  const levels = useMemo(() => LEVELS.filter((l) => l !== 'CUSTOM'), []);

  return (
    <BottomSheet open={open} title={t('access.invitePlayer')} onClose={onClose} orange={false}>
      {link ? (
        <div>
          <p className="text-sm text-text-secondary">{t('access.inviteCopy')}</p>
          <p className="mt-2 break-all text-sm font-semibold">{link}</p>
          <Button className="mt-4 w-full" onClick={onClose}>
            {t('common.done')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} underline />
          <Input label={t('common.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} underline />
          <Input label={`${t('access.phone')} (${t('access.optional')})`} value={phone} onChange={(e) => setPhone(e.target.value)} underline />
          <p className="text-sm font-semibold">{t('access.accessLevel')}</p>
          {levels.map((id) => (
            <label key={id} className="flex min-h-touch items-center gap-2 text-sm">
              <input type="radio" checked={level === id} onChange={() => setLevel(id)} />
              {t(`access.level.${id}`)}
            </label>
          ))}
          <div className="mt-2 flex gap-2">
            <Button className="flex-1" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button className="flex-1" variant="primaryDark" disabled={!name || !email} onClick={() => void invite.mutate()}>
              {t('access.sendInvite')}
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

export function MatchAccessPage() {
  return <EntityAccessPage entity="match" />;
}

export function TournamentAccessPage() {
  return <EntityAccessPage entity="tournament" />;
}
