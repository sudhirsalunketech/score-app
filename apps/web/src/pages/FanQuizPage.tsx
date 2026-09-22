import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { FanQuizPlay } from '@/components/fans/FanQuizPlay';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import type { FanQuizPlay as FanQuizPlayData } from '@/lib/fan-quiz';

export function FanQuizPage({ scope }: { scope: 'match' | 'tournament' }) {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';
  const path = preview
    ? `/api/v1/${scope === 'match' ? 'matches' : 'tournaments'}/${id}/fan/quiz/preview`
    : `/api/v1/${scope === 'match' ? 'matches' : 'tournaments'}/${id}/fan/quiz`;
  const q = useQuery({
    queryKey: keys.fanQuiz(preview ? `${scope}-preview` : scope, id),
    queryFn: () => api<FanQuizPlayData>(path),
    enabled: Boolean(id),
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => void q.refetch()} />;
  return (
    <FanQuizPlay
      data={q.data}
      matchId={scope === 'match' ? id : undefined}
      tournamentId={scope === 'tournament' ? id : undefined}
      preview={preview}
      loginNext={scope === 'match' ? `/matches/${id}/quiz` : `/tournaments/${id}/quiz`}
    />
  );
}
