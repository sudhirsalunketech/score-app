import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { getSocket } from '@/lib/socket';
import { LIVE_SOCKET_EVENTS } from '@/lib/live-events';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input, NumericInput } from '@/components/ui/Input';
import { PillTabs } from '@/components/ui/Pills';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';

export type FanTab = 'chat' | 'predict' | 'quiz' | 'rank';

const REACT_EMOJIS = ['🔥', '👏', '❤️', '😂', '🏏'] as const;

type ChatMsg = {
  id: string;
  matchId?: string;
  body: string;
  kind: 'USER' | 'SYSTEM';
  createdAt: string;
  parentId?: string | null;
  replyTo?: { id: string; body: string; name: string | null } | null;
  reactions?: Array<{ emoji: string; count: number; mine: boolean }>;
  user?: { id: string; name: string; avatarUrl?: string | null } | null;
};

type Question = {
  id: string;
  matchId?: string | null;
  tournamentId?: string | null;
  kind: string;
  type: string;
  title: string;
  question: string;
  points: number;
  status: string;
  templateKey?: string | null;
  closesInSec?: number | null;
  showPercentages?: boolean;
  options: Array<{ id: string; label: string; percent?: number | null }>;
  myAnswer?: { optionIds: string[]; numberValue?: number | null } | null;
  correctOptionIds: string[];
  answerCount: number;
};

const BADGE_EMOJI: Record<string, string> = {
  HOT_PREDICTOR: '🔥',
  PREDICTION_MASTER: '🎯',
  QUIZ_KING: '🧠',
  TOURNAMENT_EXPERT: '🏆',
  FAST_THINKER: '⚡',
  TOP_FAN: '👑',
  CENTURY_PREDICTOR: '💯',
  PERFECT_MATCH: '🎯',
  TOP_10_FAN: '🏅',
};

type Board = {
  rows: Array<{ userId: string; name: string; avatarUrl?: string | null; points: number; rank: number; badges: string[] }>;
  me: { rank: number; points: number } | null;
};

export function FanZone({
  matchId,
  tournamentId,
  initialTab = 'chat',
  compact = false,
  loginNext,
}: {
  matchId?: string;
  tournamentId?: string;
  initialTab?: FanTab;
  compact?: boolean;
  loginNext?: string;
}) {
  const { t } = useTranslation();
  const start: FanTab = !matchId && initialTab === 'chat' ? 'predict' : initialTab;
  const [tab, setTab] = useState<FanTab>(start);
  const overview = useQuery({
    queryKey: keys.fanOverview(matchId ?? ''),
    queryFn: () => api<{ chatCount: number; canManage: boolean; fanQuiz?: { show: boolean } }>(`/api/v1/matches/${matchId}/fan`),
    enabled: Boolean(matchId),
  });
  const tournamentQuiz = useQuery({
    queryKey: keys.fanQuiz('tournament', tournamentId ?? ''),
    queryFn: () => api<{ visibility: { show: boolean } }>(`/api/v1/tournaments/${tournamentId}/fan/quiz`),
    enabled: Boolean(tournamentId) && !matchId,
  });
  const showQuiz = matchId ? Boolean(overview.data?.fanQuiz?.show) : Boolean(tournamentQuiz.data?.visibility.show);
  const next = loginNext ?? (matchId ? `/matches/${matchId}/fan` : `/tournaments/${tournamentId}/fan`);
  return (
    <div className={compact ? 'px-[var(--gutter)] pb-8' : 'px-[var(--gutter)] py-4 pb-8'}>
      <p className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-primary">{t('fans.zone')}</p>
      {overview.data?.canManage && matchId ? (
        <Link to={`/matches/${matchId}/fan/admin`} className="mb-3 block text-center text-xs font-semibold text-primary">
          {t('fans.manage')}
        </Link>
      ) : null}
      <PillTabs
        value={tab}
        onChange={(id) => setTab(id as FanTab)}
        items={[
          ...(matchId
            ? [{ id: 'chat', label: overview.data?.chatCount ? `${t('fans.chat')} ${overview.data.chatCount}` : t('fans.chat') }]
            : []),
          { id: 'predict', label: t('fans.predict') },
          ...(showQuiz ? [{ id: 'quiz', label: t('fans.quiz') }] : []),
          { id: 'rank', label: t('fans.leaderboard') },
        ]}
      />
      <div className="mt-4">
        {tab === 'chat' && matchId ? <FanChat matchId={matchId} loginNext={next} /> : null}
        {tab === 'predict' ? <FanQuestions kind="predictions" matchId={matchId} tournamentId={tournamentId} loginNext={next} /> : null}
        {tab === 'quiz' && showQuiz ? <FanQuestions kind="quizzes" matchId={matchId} tournamentId={tournamentId} loginNext={next} /> : null}
        {tab === 'rank' ? <FanBoard matchId={matchId} tournamentId={tournamentId} /> : null}
      </div>
    </div>
  );
}

function FanChat({ matchId, loginNext }: { matchId: string; loginNext: string }) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [reply, setReply] = useState<ChatMsg | null>(null);
  const [menu, setMenu] = useState<ChatMsg | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: keys.fanChat(matchId),
    queryFn: () => api<{ messages: ChatMsg[]; online: number; canManage: boolean }>(`/api/v1/matches/${matchId}/chat`),
  });
  useEffect(() => {
    const s = getSocket();
    const onMsg = (msg: ChatMsg) => {
      if (msg.matchId && msg.matchId !== matchId) return;
      void qc.invalidateQueries({ queryKey: keys.fanChat(matchId) });
    };
    s.on(LIVE_SOCKET_EVENTS.fanChatMessage, onMsg);
    s.on(LIVE_SOCKET_EVENTS.fanChatDeleted, onMsg);
    s.on(LIVE_SOCKET_EVENTS.fanChatModerated, onMsg);
    s.on(LIVE_SOCKET_EVENTS.fanChatReaction, onMsg);
    return () => {
      s.off(LIVE_SOCKET_EVENTS.fanChatMessage, onMsg);
      s.off(LIVE_SOCKET_EVENTS.fanChatDeleted, onMsg);
      s.off(LIVE_SOCKET_EVENTS.fanChatModerated, onMsg);
      s.off(LIVE_SOCKET_EVENTS.fanChatReaction, onMsg);
    };
  }, [matchId, qc]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [q.data?.messages.length]);
  const send = useMutation({
    mutationFn: () =>
      api(`/api/v1/matches/${matchId}/chat`, {
        method: 'POST',
        body: { body: text, parentId: reply?.id },
      }),
    onSuccess: () => {
      setText('');
      setReply(null);
      void qc.invalidateQueries({ queryKey: keys.fanChat(matchId) });
    },
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const messages = q.data?.messages ?? [];
  return (
    <div>
      <p className="mb-2 text-xs text-text-secondary">🟢 {q.data?.online ?? 0} {t('fans.fansOnline')}</p>
      {messages.length ? (
        <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {messages.map((m) => (
            <li key={m.id} className="flex gap-2">
              <Avatar name={m.user?.name ?? t('fans.system')} src={m.user?.avatarUrl} kind="person" size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{m.kind === 'SYSTEM' ? t('fans.system') : m.user?.name}</p>
                  <button type="button" className="text-xs text-text-secondary" onClick={() => setMenu(m)}>
                    ⋮
                  </button>
                </div>
                {m.replyTo ? (
                  <p className="mb-1 truncate text-[11px] text-text-secondary">
                    {t('fans.reply')} {m.replyTo.name ? `@${m.replyTo.name}` : ''}: {m.replyTo.body}
                  </p>
                ) : null}
                <p className="text-sm">{m.body}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {REACT_EMOJIS.map((emoji) => {
                    const row = m.reactions?.find((r) => r.emoji === emoji);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        className={`rounded-pill px-1.5 text-xs ${row?.mine ? 'bg-primary-light' : 'bg-muted'}`}
                        aria-label={t('fans.react')}
                        onClick={() => {
                          if (!isAuthenticated) {
                            nav(`/login?next=${encodeURIComponent(loginNext)}`);
                            return;
                          }
                          void api(`/api/v1/chat/${m.id}/react`, { method: 'POST', body: { emoji } }).then(() =>
                            qc.invalidateQueries({ queryKey: keys.fanChat(matchId) }),
                          );
                        }}
                      >
                        {emoji}
                        {row?.count ? ` ${row.count}` : ''}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-text-secondary">{new Date(m.createdAt).toLocaleTimeString()}</p>
              </div>
            </li>
          ))}
          <div ref={bottom} />
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-text-secondary">{t('fans.emptyChat')}</p>
      )}
      {isAuthenticated ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send.mutate();
          }}
        >
          {reply ? (
            <p className="text-xs text-text-secondary">
              {t('fans.reply')} {reply.user?.name}: {reply.body}
              <button type="button" className="ms-2 font-semibold text-primary" onClick={() => setReply(null)}>
                {t('common.cancel')}
              </button>
            </p>
          ) : null}
          <div className="flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('fans.typeMessage')} maxLength={300} />
            <Button type="submit" variant="primaryDark" disabled={send.isPending}>
              {t('fans.send')}
            </Button>
          </div>
        </form>
      ) : (
        <Button className="mt-3 w-full" variant="outline" onClick={() => nav(`/login?next=${encodeURIComponent(loginNext)}`)}>
          {t('fans.loginToChat')}
        </Button>
      )}
      {send.error instanceof ApiError ? <p className="mt-2 text-sm text-danger">{send.error.message}</p> : null}
      <BottomSheet open={Boolean(menu)} title={t('fans.message')} onClose={() => setMenu(null)} orange={false}>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!menu) return;
              setReply(menu);
              setMenu(null);
            }}
          >
            {t('fans.reply')}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (!menu) return;
              await api(`/api/v1/chat/${menu.id}/report`, { method: 'POST', body: { reason: 'report' } });
              setMenu(null);
            }}
          >
            {t('fans.report')}
          </Button>
          {menu && (menu.user?.id === user?.id || q.data?.canManage) ? (
            <Button
              variant="danger"
              onClick={async () => {
                if (!menu) return;
                await api(`/api/v1/chat/${menu.id}`, { method: 'DELETE' });
                void qc.invalidateQueries({ queryKey: keys.fanChat(matchId) });
                setMenu(null);
              }}
            >
              {t('fans.delete')}
            </Button>
          ) : null}
          {menu && q.data?.canManage && menu.user?.id ? (
            <>
              <Button
                variant="outline"
                onClick={async () => {
                  await api(`/api/v1/chat/${menu.id}/mute`, { method: 'POST' });
                  setMenu(null);
                }}
              >
                {t('fans.mute')}
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await api(`/api/v1/chat/${menu.id}/block`, { method: 'POST' });
                  setMenu(null);
                }}
              >
                {t('fans.block')}
              </Button>
            </>
          ) : null}
        </div>
      </BottomSheet>
    </div>
  );
}

function FanQuestions({
  kind,
  matchId,
  tournamentId,
  loginNext,
}: {
  kind: 'predictions' | 'quizzes';
  matchId?: string;
  tournamentId?: string;
  loginNext: string;
}) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const path = matchId ? `/api/v1/matches/${matchId}/${kind}` : `/api/v1/tournaments/${tournamentId}/${kind}`;
  const q = useQuery({
    queryKey: keys.fanQuestions(kind, matchId ?? tournamentId ?? ''),
    queryFn: () => api<Question[]>(path),
    enabled: Boolean(matchId || tournamentId),
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const rows = q.data ?? [];
  if (!rows.length) {
    if (kind === 'quizzes') return null;
    return <p className="py-8 text-center text-sm text-text-secondary">{t('fans.emptyPredict')}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <QuestionCard
          key={row.id}
          row={row}
          kind={kind}
          loggedIn={isAuthenticated}
          onLogin={() => nav(`/login?next=${encodeURIComponent(loginNext)}`)}
          onAnswered={() => void qc.invalidateQueries({ queryKey: keys.fanQuestions(kind, matchId ?? tournamentId ?? '') })}
        />
      ))}
    </div>
  );
}

function QuestionCard({
  row,
  kind,
  loggedIn,
  onLogin,
  onAnswered,
}: {
  row: Question;
  kind: 'predictions' | 'quizzes';
  loggedIn: boolean;
  onLogin: () => void;
  onAnswered: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string[]>(row.myAnswer?.optionIds ?? []);
  const [number, setNumber] = useState(row.myAnswer?.numberValue?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const locked = row.status !== 'OPEN' || Boolean(row.myAnswer);
  const submit = useMutation({
    mutationFn: () =>
      api(`/api/v1/${kind === 'quizzes' ? 'quizzes' : 'predictions'}/${row.id}/answer`, {
        method: 'POST',
        body: row.type === 'NUMBER' ? { numberValue: Number(number) } : { optionIds: picked },
      }),
    onSuccess: onAnswered,
    onError: (e) => setError(e instanceof ApiError ? e.message : t('common.error')),
  });
  const toggle = (id: string) => {
    if (locked) return;
    if (row.type === 'MULTIPLE_CHOICE' || row.templateKey === 'TOURNAMENT_FINALISTS') {
      setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, 2)));
    } else {
      setPicked([id]);
    }
  };
  return (
    <article className="rounded-card border border-border p-4">
      <p className="text-xs font-bold uppercase text-primary">{kind === 'quizzes' ? t('fans.matchQuiz') : t('fans.predictWin')}</p>
      <h3 className="mt-2 font-bold">{row.question}</h3>
      {row.closesInSec != null && row.status === 'OPEN' ? (
        <p className="mt-1 text-xs font-semibold text-primary">
          {t('fans.closesIn')} {String(Math.floor(row.closesInSec / 60)).padStart(2, '0')}:{String(row.closesInSec % 60).padStart(2, '0')}
        </p>
      ) : null}
      {row.type === 'NUMBER' ? (
        <NumericInput className="mt-3" value={number} onChange={(e) => setNumber(e.target.value)} disabled={locked} />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {row.options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => toggle(opt.id)}
                className={`min-h-touch w-full rounded-lg border px-3 text-start text-sm ${picked.includes(opt.id) ? 'border-primary bg-primary-light font-semibold' : 'border-border'}`}
              >
                {opt.label}
                {row.showPercentages && opt.percent != null ? <span className="float-end text-xs text-text-secondary">{opt.percent}%</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-text-secondary">
        {t('fans.reward')}: +{row.points} {t('fans.points')}
      </p>
      {row.myAnswer ? (
        <p className="mt-1 text-sm font-semibold text-primary">
          {t('fans.yourPrediction')}: {row.options.filter((o) => row.myAnswer?.optionIds.includes(o.id)).map((o) => o.label).join(', ') || row.myAnswer.numberValue}
          {' · '}
          {t('fans.potentialPoints')}: +{row.points}
        </p>
      ) : null}
      {row.status === 'SETTLED' ? (
        <p className="mt-1 text-sm">
          {row.correctOptionIds.some((id) => row.myAnswer?.optionIds.includes(id)) ||
          (row.type === 'NUMBER' && row.myAnswer)
            ? t('fans.correctAnswer')
            : t('fans.wrongAnswer')}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {!row.myAnswer && row.status === 'OPEN' ? (
        loggedIn ? (
          <Button className="mt-3 w-full" variant="primaryDark" disabled={submit.isPending} onClick={() => submit.mutate()}>
            {kind === 'quizzes' ? t('fans.submitAnswer') : t('fans.makePrediction')}
          </Button>
        ) : (
          <Button className="mt-3 w-full" variant="outline" onClick={onLogin}>
            {t('common.login')}
          </Button>
        )
      ) : null}
      <button
        type="button"
        className="mt-2 w-full text-center text-xs font-semibold text-primary"
        onClick={() => {
          const url = `${window.location.origin}/fan/questions/${row.id}`;
          const text = kind === 'quizzes' ? t('fans.shareQuiz') : t('fans.sharePredict');
          if (navigator.share) void navigator.share({ title: row.question, text, url });
          else void navigator.clipboard.writeText(`${text} ${url}`);
        }}
      >
        {t('common.share')}
      </button>
    </article>
  );
}

function FanBoard({ matchId, tournamentId }: { matchId?: string; tournamentId?: string }) {
  const { t } = useTranslation();
  const [scope, setScope] = useState(matchId ? 'match' : tournamentId ? 'tournament' : 'global');
  const path =
    scope === 'match' && matchId
      ? `/api/v1/matches/${matchId}/leaderboard`
      : scope === 'tournament' && tournamentId
        ? `/api/v1/tournaments/${tournamentId}/leaderboard`
        : '/api/v1/leaderboard/global';
  const q = useQuery({ queryKey: keys.fanBoard(scope, matchId ?? tournamentId ?? 'global'), queryFn: () => api<Board>(path) });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const rows = q.data?.rows ?? [];
  return (
    <div>
      <PillTabs
        value={scope}
        onChange={setScope}
        items={[
          ...(matchId ? [{ id: 'match', label: t('fans.matchBoard') }] : []),
          ...(tournamentId ? [{ id: 'tournament', label: t('fans.tournamentBoard') }] : []),
          { id: 'global', label: t('fans.globalBoard') },
        ]}
      />
      {q.data?.me ? (
        <p className="mt-3 text-sm font-semibold">
          {t('fans.yourRank')}: #{q.data.me.rank} · {t('fans.yourPoints')}: {q.data.me.points}
        </p>
      ) : null}
      {rows.length ? (
        <div className="mt-3 rounded-card border border-border p-3">
          <p className="mb-2 text-xs font-bold uppercase text-primary">{t('fans.winners')}</p>
          <ol className="flex flex-col gap-1 text-sm">
            {rows.slice(0, 3).map((row) => (
              <li key={`win-${row.userId}`} className="flex justify-between">
                <span>
                  {row.rank}. {row.name}
                </span>
                <span className="font-semibold">+{row.points} {t('fans.pts')}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {rows.length ? (
        <ol className="mt-3 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.userId} className="flex items-center gap-3 py-2">
              <span className="w-6 font-bold">{row.rank}</span>
              <Avatar name={row.name} src={row.avatarUrl} kind="person" size={36} />
              <div className="flex-1">
                <p className="font-semibold">{row.name}</p>
                <p className="text-xs text-text-secondary">{row.badges.map((b) => BADGE_EMOJI[b] ?? '').join(' ')}</p>
              </div>
              <span className="font-bold">{row.points} {t('fans.pts')}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-8 text-center text-sm text-text-secondary">{t('fans.emptyBoard')}</p>
      )}
    </div>
  );
}
