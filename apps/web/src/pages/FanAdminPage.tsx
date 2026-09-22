import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import type { FanQuizQuestion } from '@/lib/fan-quiz';
import type { Tournament } from '@/types/api';

type Settings = {
  chatEnabled: boolean;
  publicChat: boolean;
  loginRequiredToChat: boolean;
  predictionsEnabled: boolean;
  quizzesEnabled: boolean;
};

type QuizResults = {
  participants: number;
  totalAnswers: number;
  correctAnswers: number;
  incorrectAnswers: number;
  questions: Array<{ id: string; question: string; answers: number; correct: number; incorrect: number; participationRate: number }>;
};

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

function optionsFromRow(row: FanQuizQuestion): string[] {
  const labels = row.options.map((o) => o.label);
  while (labels.length < MIN_OPTIONS) labels.push('');
  return labels;
}

export function FanAdminPage({ scope }: { scope: 'match' | 'tournament' }) {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'PREDICTION' | 'QUIZ'>('PREDICTION');
  const [editing, setEditing] = useState<FanQuizQuestion | null>(null);
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [correct, setCorrect] = useState(0);
  const [matchId, setMatchId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ['fan', 'settings', scope, id],
    queryFn: () => api<Settings>(scope === 'match' ? `/api/v1/matches/${id}/fan/settings` : `/api/v1/tournaments/${id}/fan/settings`),
  });
  const tournament = useQuery({
    queryKey: keys.tournament(id),
    queryFn: () => api<Tournament>(`/api/v1/tournaments/${id}`),
    enabled: scope === 'tournament',
  });
  const questions = useQuery({
    queryKey: keys.fanQuizAdmin(id),
    queryFn: () => api<FanQuizQuestion[]>(`/api/v1/tournaments/${id}/fan/quiz/questions`),
    enabled: scope === 'tournament',
  });
  const results = useQuery({
    queryKey: keys.fanQuizResults(id),
    queryFn: () => api<QuizResults>(`/api/v1/tournaments/${id}/fan/quiz/results`),
    enabled: scope === 'tournament' && Boolean(settings.data?.quizzesEnabled),
  });
  const reports = useQuery({
    queryKey: ['fan', 'reports', id],
    queryFn: () =>
      api<Array<{ id: string; reason: string; message: { id: string; body: string; user?: { name: string }; match: { title: string } } }>>(
        `/api/v1/fan/moderation/reports?matchId=${scope === 'match' ? id : ''}`,
      ),
    enabled: scope === 'match',
  });

  const save = useMutation({
    mutationFn: (body: Partial<Settings>) =>
      api(`/api/v1/${scope === 'match' ? 'matches' : 'tournaments'}/${id}/fan/settings`, { method: 'PATCH', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fan', 'settings', scope, id] }),
  });

  const addOption = () => setOptions((cur) => (cur.length >= MAX_OPTIONS ? cur : [...cur, '']));
  const removeOption = (i: number) => {
    setOptions((cur) => (cur.length <= MIN_OPTIONS ? cur : cur.filter((_, n) => n !== i)));
    setCorrect((cur) => {
      if (i === cur) return 0;
      if (i < cur) return cur - 1;
      return cur;
    });
  };

  const resetForm = () => {
    setTitle('');
    setOptions(['', '']);
    setCorrect(0);
    setMatchId('');
    setEditing(null);
    setError(null);
  };

  const create = useMutation({
    mutationFn: () => {
      const labels = options.map((l) => l.trim()).filter(Boolean);
      if (kind === 'QUIZ') {
        const body = {
          kind: 'QUIZ',
          type: 'SINGLE_CHOICE',
          scope: matchId ? 'MATCH' : 'TOURNAMENT',
          tournamentId: scope === 'tournament' ? id : undefined,
          matchId: matchId || (scope === 'match' ? id : undefined),
          title,
          question: title,
          publish: true,
          options: labels.map((label) => ({ label })),
          correctOptionIndexes: [correct],
        };
        return editing
          ? api(`/api/v1/fan/questions/${editing.id}`, { method: 'PATCH', body: { ...body, publish: editing.status === 'OPEN' } })
          : api('/api/v1/fan/questions', { method: 'POST', body });
      }
      return api('/api/v1/fan/questions', {
        method: 'POST',
        body: {
          kind: 'PREDICTION',
          type: 'SINGLE_CHOICE',
          scope: scope === 'match' ? 'MATCH' : 'TOURNAMENT',
          matchId: scope === 'match' ? id : undefined,
          tournamentId: scope === 'tournament' ? id : undefined,
          title,
          question: title,
          publish: true,
          options: labels.map((label) => ({ label })),
        },
      });
    },
    onSuccess: () => {
      setOpen(false);
      resetForm();
      void qc.invalidateQueries({ queryKey: keys.fanQuizAdmin(id) });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('common.error')),
  });

  if (settings.isLoading) return <Spinner />;
  if (settings.isError) return <ErrorRetry onRetry={() => void settings.refetch()} />;

  const matches = tournament.data?.matches ?? [];

  return (
    <div className="px-[var(--gutter)] py-4">
      <h1 className="mb-4 text-center text-lg font-bold uppercase">{scope === 'tournament' ? t('fans.fanQuiz') : t('fans.admin')}</h1>
      {settings.data && scope === 'match' ? (
        <div className="mb-6 flex flex-col gap-2 text-sm">
          {(
            [
              ['chatEnabled', t('fans.chat')],
              ['publicChat', t('fans.publicChat')],
              ['loginRequiredToChat', t('fans.loginRequired')],
              ['predictionsEnabled', t('fans.predictions')],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex min-h-touch items-center justify-between">
              {label}
              <input
                type="checkbox"
                checked={Boolean(settings.data?.[key])}
                onChange={(e) => save.mutate({ [key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      ) : null}

      {scope === 'tournament' ? (
        <section className="mb-8">
          {!settings.data?.quizzesEnabled ? (
            <div className="rounded-xl border border-border p-4 text-center">
              <p className="font-bold">{t('fans.quizNotConfigured')}</p>
              <p className="mt-1 text-sm text-text-secondary">{t('info.fanQuiz.enable')}</p>
              <Button className="mt-4 w-full" variant="primaryDark" onClick={() => nav(`/tournaments/${id}/edit`)}>
                {t('fans.manageQuizzes')}
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  variant="primaryDark"
                  onClick={() => {
                    setKind('QUIZ');
                    resetForm();
                    setOpen(true);
                  }}
                >
                  + {t('fans.addQuestion')}
                </Button>
                <Button variant="outline" onClick={() => nav(`/tournaments/${id}/quiz?preview=1`)}>
                  {t('fans.previewQuiz')}
                </Button>
              </div>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] text-start text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-secondary">
                      <th className="py-2 pe-2">#</th>
                      <th className="py-2 pe-2">{t('fans.question')}</th>
                      <th className="py-2 pe-2">{t('fans.quizType')}</th>
                      <th className="py-2 pe-2">{t('fans.quizStatus')}</th>
                      <th className="py-2 pe-2">{t('fans.answers')}</th>
                      <th className="py-2">{t('match.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(questions.data ?? []).map((row, i) => (
                      <tr key={row.id} className="border-b border-border">
                        <td className="py-3 pe-2">{i + 1}</td>
                        <td className="py-3 pe-2 font-semibold">{row.question}</td>
                        <td className="py-3 pe-2">{t('fans.multipleChoice')}</td>
                        <td className="py-3 pe-2">{row.status}</td>
                        <td className="py-3 pe-2">{row.answerCount ?? 0}</td>
                        <td className="py-3">
                          <QuestionActions
                            row={row}
                            ids={(questions.data ?? []).map((q) => q.id)}
                            onEdit={() => {
                              setKind('QUIZ');
                              setEditing(row);
                              setTitle(row.question);
                              setOptions(optionsFromRow(row));
                              setCorrect(Math.max(0, row.options.findIndex((o) => row.correctOptionIds.includes(o.id))));
                              setMatchId(row.matchId ?? '');
                              setOpen(true);
                            }}
                            onChanged={() => void questions.refetch()}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-col gap-3 md:hidden">
                {(questions.data ?? []).map((row, i) => (
                  <article key={row.id} className="rounded-xl border border-border p-4">
                    <p className="text-xs text-text-secondary">#{i + 1} · {row.status}</p>
                    <p className="mt-1 font-bold">{row.question}</p>
                    <p className="mt-1 text-xs text-text-secondary">{t('fans.answers')}: {row.answerCount ?? 0}</p>
                    <div className="mt-3">
                      <QuestionActions
                        row={row}
                        ids={(questions.data ?? []).map((q) => q.id)}
                        onEdit={() => {
                          setKind('QUIZ');
                          setEditing(row);
                          setTitle(row.question);
                          setOptions(optionsFromRow(row));
                          setCorrect(Math.max(0, row.options.findIndex((o) => row.correctOptionIds.includes(o.id))));
                          setMatchId(row.matchId ?? '');
                          setOpen(true);
                        }}
                        onChanged={() => void questions.refetch()}
                      />
                    </div>
                  </article>
                ))}
              </div>
              {results.data ? (
                <section className="mt-8">
                  <h2 className="mb-3 font-bold">{t('fans.quizResults')}</h2>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <Stat label={t('fans.participants')} value={results.data.participants} />
                    <Stat label={t('fans.totalAnswers')} value={results.data.totalAnswers} />
                    <Stat label={t('fans.correctAnswers')} value={results.data.correctAnswers} />
                    <Stat label={t('fans.incorrectAnswers')} value={results.data.incorrectAnswers} />
                  </dl>
                </section>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {scope === 'match' ? (
        <>
          <Button className="mb-3 w-full" variant="primaryDark" onClick={() => { setKind('PREDICTION'); resetForm(); setOpen(true); }}>
            + {t('fans.createPrediction')}
          </Button>
          <h2 className="mb-2 font-bold">{t('fans.moderation')}</h2>
          <ul className="divide-y divide-border">
            {(reports.data ?? []).map((row) => (
              <li key={row.id} className="py-3 text-sm">
                <p className="font-semibold">{row.message.user?.name ?? t('fans.system')}</p>
                <p>{row.message.body}</p>
                <p className="text-xs text-text-secondary">{row.message.match.title} · {row.reason}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Button className="mb-6 w-full" variant="outline" onClick={() => { setKind('PREDICTION'); resetForm(); setOpen(true); }}>
          + {t('fans.createPrediction')}
        </Button>
      )}

      <BottomSheet open={open} title={kind === 'QUIZ' ? (editing ? t('fans.editQuestion') : t('fans.addQuestion')) : t('fans.createPrediction')} onClose={() => setOpen(false)} orange={false}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input label={t('fans.question')} value={title} onChange={(e) => setTitle(e.target.value)} underline />
          {kind === 'QUIZ' ? (
            <>
              {options.map((opt, i) => (
                <label key={i} className="flex min-h-touch items-center gap-2 text-sm">
                  <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} />
                  <Input
                    className="flex-1"
                    label={`${String.fromCharCode(65 + i)}`}
                    value={opt}
                    onChange={(e) => setOptions((cur) => cur.map((x, n) => (n === i ? e.target.value : x)))}
                    underline
                  />
                  {options.length > MIN_OPTIONS ? (
                    <button
                      type="button"
                      className="touch-target text-danger"
                      aria-label={t('fans.removeOption')}
                      onClick={() => removeOption(i)}
                    >
                      ×
                    </button>
                  ) : null}
                </label>
              ))}
              {options.length < MAX_OPTIONS ? (
                <Button type="button" variant="outline" onClick={addOption}>
                  + {t('fans.addOption')}
                </Button>
              ) : null}
              <p className="text-xs text-text-secondary">{t('fans.correctAnswerHint')}</p>
              {scope === 'tournament' && matches.length ? (
                <Select label={t('fans.questionMatch')} value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                  <option value="">{t('fans.tournamentWide')}</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title || `${m.homeTeam.name} vs ${m.awayTeam.name}`}
                    </option>
                  ))}
                </Select>
              ) : null}
            </>
          ) : (
            <label className="text-sm font-semibold">
              {t('fans.options')}
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg border border-border px-3 py-2"
                value={options.filter(Boolean).join('\n') || 'Yes\nNo'}
                onChange={(e) => setOptions(e.target.value.split('\n'))}
              />
            </label>
          )}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="primaryDark" disabled={create.isPending}>
            {t('common.save')}
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
}

function QuestionActions({
  row,
  onEdit,
  onChanged,
  ids,
}: {
  row: FanQuizQuestion;
  onEdit: () => void;
  onChanged: () => void;
  ids: string[];
}) {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const i = ids.indexOf(row.id);
  const move = (dir: -1 | 1) => {
    const next = [...ids];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    void api(`/api/v1/tournaments/${id}/fan/quiz/reorder`, { method: 'POST', body: { ids: next } }).then(onChanged);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => move(-1)} disabled={i <= 0}>↑</Button>
      <Button variant="outline" onClick={() => move(1)} disabled={i < 0 || i >= ids.length - 1}>↓</Button>
      <Button variant="outline" onClick={onEdit}>{t('fans.edit')}</Button>
      <Button
        variant="outline"
        onClick={() =>
          api(`/api/v1/fan/questions/${row.id}`, {
            method: 'PATCH',
            body: { publish: row.status !== 'OPEN' },
          }).then(onChanged)
        }
      >
        {row.status === 'OPEN' ? t('fans.unpublish') : t('fans.publish')}
      </Button>
      <Button
        variant="danger"
        onClick={() => api(`/api/v1/fan/questions/${row.id}`, { method: 'DELETE' }).then(onChanged)}
      >
        {t('fans.delete')}
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="text-lg font-bold">{value}</dd>
    </div>
  );
}
