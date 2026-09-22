import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { FanZone } from '@/components/fans/FanZone';
import { Spinner, ErrorRetry } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

export function FanQuestionPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: keys.fanQuestion(id),
    queryFn: () => api<{ matchId?: string | null; tournamentId?: string | null; kind: string }>(`/api/v1/fan/questions/${id}`),
    enabled: Boolean(id),
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => void q.refetch()} />;
  return (
    <div className="mx-auto max-w-lg py-4">
      <Button variant="ghost" onClick={() => nav(-1)}>
        {t('common.back')}
      </Button>
      <FanZone
        matchId={q.data.matchId ?? undefined}
        tournamentId={q.data.tournamentId ?? undefined}
        initialTab={q.data.kind === 'QUIZ' ? 'quiz' : 'predict'}
        loginNext={`/fan/questions/${id}`}
      />
    </div>
  );
}
