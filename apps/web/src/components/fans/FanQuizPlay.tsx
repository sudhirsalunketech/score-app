import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { IconBack } from '@/components/ui/Icons';
import type { FanQuizPlay as FanQuizPlayData, FanQuizQuestion } from '@/lib/fan-quiz';

export function FanQuizPlay({
  data,
  matchId,
  tournamentId,
  preview,
  loginNext,
}: {
  data: FanQuizPlayData;
  matchId?: string;
  tournamentId?: string;
  preview?: boolean;
  loginNext: string;
}) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const vis = data.visibility;
  const questions = data.questions;
  const firstOpen = questions.findIndex((q) => !q.myAnswer && q.status === 'OPEN');
  const firstUnanswered = questions.findIndex((q) => !q.myAnswer);
  const startIndex = firstOpen >= 0 ? firstOpen : firstUnanswered >= 0 ? firstUnanswered : Math.max(0, questions.length - 1);
  const [index, setIndex] = useState(startIndex);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localDone, setLocalDone] = useState(false);

  const completed = Boolean(data.result) || (preview && localDone);
  const question = questions[index] as FanQuizQuestion | undefined;
  const total = questions.length;
  const progress = total ? Math.round(((completed ? total : index) / total) * 100) : 0;

  const submit = useMutation({
    mutationFn: () =>
      api(`/api/v1/quizzes/${question!.id}/answer`, {
        method: 'POST',
        body: { optionIds: picked ? [picked] : [] },
      }),
    onSuccess: async () => {
      setPicked(null);
      setError(null);
      await qc.invalidateQueries({ queryKey: keys.fanQuiz(matchId ? 'match' : 'tournament', matchId ?? tournamentId ?? '') });
      if (index < total - 1) setIndex((i) => i + 1);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('common.error')),
  });

  const selected = question?.myAnswer?.optionIds[0] ?? picked;
  const closed = question?.status !== 'OPEN';
  const answered = Boolean(question?.myAnswer);

  const result = useMemo(() => data.result, [data.result]);

  if (!preview && !vis.show) {
    return (
      <QuizShell onBack={() => nav(-1)}>
        <p className="py-12 text-center text-sm text-text-secondary">{t('fans.quizUnavailable')}</p>
      </QuizShell>
    );
  }

  if (!preview && vis.comingSoon) {
    return (
      <QuizShell onBack={() => nav(-1)}>
        <p className="text-center text-xs font-bold uppercase tracking-wide text-primary">{vis.tournamentName}</p>
        <h2 className="mt-2 text-center text-xl font-bold">{vis.quizName || t('fans.fanQuiz')}</h2>
        <p className="mt-6 text-center text-sm text-text-secondary">{t('fans.quizComingSoon')}</p>
      </QuizShell>
    );
  }

  if (!questions.length) {
    return (
      <QuizShell onBack={() => nav(-1)}>
        <p className="py-12 text-center text-sm text-text-secondary">{t('fans.quizUnavailable')}</p>
      </QuizShell>
    );
  }

  if (completed && result) {
    return (
      <QuizShell onBack={() => nav(-1)}>
        <p className="text-center text-xs font-bold uppercase tracking-wide text-primary">{vis.tournamentName}</p>
        <h2 className="mt-2 text-center text-xl font-bold">{t('fans.quizCompleted')}</h2>
        <p className="mt-8 text-center text-4xl font-bold">
          {result.score} / {result.total}
        </p>
        <p className="mt-2 text-center text-sm text-text-secondary">
          {t('fans.accuracy')}: {result.accuracy}%
        </p>
        <Button className="mt-8 w-full" variant="primaryDark" onClick={() => nav(-1)}>
          {t('common.done')}
        </Button>
      </QuizShell>
    );
  }

  if (completed && preview) {
    return (
      <QuizShell onBack={() => nav(-1)}>
        <h2 className="text-center text-xl font-bold">{t('fans.quizPreviewDone')}</h2>
        <p className="mt-3 text-center text-sm text-text-secondary">{t('fans.quizPreviewHint')}</p>
        <Button className="mt-8 w-full" variant="primaryDark" onClick={() => nav(-1)}>
          {t('common.done')}
        </Button>
      </QuizShell>
    );
  }

  return (
    <QuizShell onBack={() => nav(-1)}>
      {preview ? <p className="mb-2 text-center text-xs font-bold uppercase text-primary">{t('fans.previewQuiz')}</p> : null}
      <p className="text-center text-xs font-bold uppercase tracking-wide text-primary">{vis.tournamentName}</p>
      <h2 className="mt-1 text-center text-lg font-bold">{vis.quizName || t('fans.fanQuiz')}</h2>
      <p className="mt-4 text-center text-sm font-semibold">
        {t('fans.questionOf', { current: index + 1, total })}
      </p>
      <div className="mx-auto mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
      <h3 className="mt-6 text-lg font-bold leading-snug">{question?.question}</h3>
      {closed && !answered ? (
        <p className="mt-4 text-sm font-semibold text-text-secondary">{t('fans.questionClosed')}</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {(question?.options ?? []).map((opt) => {
            const on = selected === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  disabled={answered || (closed && !preview)}
                  onClick={() => setPicked(opt.id)}
                  className={`flex min-h-11 w-full items-center rounded-xl border px-4 py-3 text-start text-base ${
                    on ? 'border-primary bg-primary-light font-semibold' : 'border-border'
                  }`}
                >
                  <span className={`me-3 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-primary' : 'border-border'}`}>
                    {on ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                  </span>
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="sticky bottom-0 mt-6 bg-bg pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {answered || (closed && !preview) ? (
          <Button
            className="w-full"
            variant="primaryDark"
            onClick={() => {
              if (index < total - 1) setIndex((i) => i + 1);
              else if (preview) setLocalDone(true);
            }}
          >
            {index < total - 1 ? t('fans.nextQuestion') : preview ? t('fans.finishPreview') : t('common.done')}
          </Button>
        ) : preview ? (
          <Button
            className="w-full"
            variant="primaryDark"
            disabled={!picked}
            onClick={() => {
              if (index < total - 1) {
                setPicked(null);
                setIndex((i) => i + 1);
              } else {
                setLocalDone(true);
              }
            }}
          >
            {index < total - 1 ? t('fans.nextQuestion') : t('fans.finishPreview')}
          </Button>
        ) : isAuthenticated ? (
          <Button className="w-full" variant="primaryDark" disabled={!picked || submit.isPending} onClick={() => submit.mutate()}>
            {index < total - 1 ? t('fans.submitAnswer') : t('fans.submitQuiz')}
          </Button>
        ) : (
          <Button className="w-full" variant="outline" onClick={() => nav(`/login?next=${encodeURIComponent(loginNext)}`)}>
            {t('common.login')}
          </Button>
        )}
      </div>
    </QuizShell>
  );
}

function QuizShell({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-bg px-[var(--gutter)] pb-4">
      <header className="flex min-h-14 items-center pt-[env(safe-area-inset-top)]">
        <button type="button" className="touch-target -ms-2 inline-flex items-center justify-center" aria-label={t('common.back')} onClick={onBack}>
          <IconBack />
        </button>
        <h1 className="flex-1 text-center text-lg font-bold">{t('fans.fanQuiz')}</h1>
        <span className="touch-target" />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
