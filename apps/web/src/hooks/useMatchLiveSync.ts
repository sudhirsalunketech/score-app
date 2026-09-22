import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from '@/lib/query-keys';
import { joinMatch } from '@/lib/socket';

export function liveRefetchMs(status?: string | null): number | false {
  if (status === 'LIVE' || status === 'INNINGS_BREAK') return 2500;
  return 12_000;
}

export function useMatchLiveSync(matchId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!matchId) return;
    return joinMatch(matchId, () => {
      void qc.invalidateQueries({ queryKey: keys.live(matchId) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(matchId) });
      void qc.invalidateQueries({ queryKey: ['innings'] });
    });
  }, [matchId, qc]);
}
