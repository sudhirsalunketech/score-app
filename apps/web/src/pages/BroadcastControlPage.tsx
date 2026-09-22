import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { hasMatchPerm } from '@/lib/access';
import type { Match } from '@/types/api';
import { IconBack } from '@/components/ui/Icons';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { BroadcastControlPanel } from '@/components/live/BroadcastControlPanel';

export function BroadcastControlPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();

  const match = useQuery({
    queryKey: keys.match(id),
    queryFn: () => api<Match>(`/api/v1/matches/${id}`),
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api(`/api/v1/matches/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.match(id) });
      void qc.invalidateQueries({ queryKey: keys.live(id) });
    },
  });

  if (match.isLoading) return <Spinner />;
  if (match.isError || !match.data) return <ErrorRetry onRetry={() => void match.refetch()} />;

  const canShare = hasMatchPerm(match.data, 'MATCH_SHARE');

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 flex min-h-14 items-center bg-bg pt-[env(safe-area-inset-top)]">
        <button type="button" className="touch-target inline-flex items-center justify-center" aria-label={t('common.back')} onClick={() => nav(-1)}>
          <IconBack />
        </button>
        <h1 className="flex flex-1 items-center justify-center pr-12 text-lg font-bold">{t('overlay.broadcast')}</h1>
      </header>

      <div className="px-[var(--gutter)] pb-8">
        {canShare ? (
          <BroadcastControlPanel
            match={match.data}
            saving={save.isPending}
            onSave={async (patch) => {
              await save.mutateAsync(patch);
            }}
          />
        ) : (
          <p className="mt-6 text-sm text-text-secondary">{t('access.deniedBody')}</p>
        )}
      </div>
    </div>
  );
}
