import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { Button } from '@/components/ui/Button';

type Target = 'PLAYER' | 'TEAM' | 'TOURNAMENT';

export function FollowButton({ targetType, targetId }: { targetType: Target; targetId: string }) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: keys.followStatus(targetType, targetId),
    queryFn: () => api<{ following: boolean }>(`/api/v1/follows/status?targetType=${targetType}&targetId=${targetId}`),
    enabled: isAuthenticated && Boolean(targetId),
  });
  const toggle = useMutation({
    mutationFn: async () => {
      if (status.data?.following) {
        return api(`/api/v1/follows?targetType=${targetType}&targetId=${targetId}`, { method: 'DELETE' });
      }
      return api('/api/v1/follows', { method: 'POST', body: { targetType, targetId } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.followStatus(targetType, targetId) });
      void qc.invalidateQueries({ queryKey: keys.following });
    },
  });
  if (!isAuthenticated) return null;
  return (
    <Button variant="outline" disabled={toggle.isPending || status.isLoading} onClick={() => toggle.mutate()}>
      {status.data?.following ? t('following.unfollow') : t('following.follow')}
    </Button>
  );
}
