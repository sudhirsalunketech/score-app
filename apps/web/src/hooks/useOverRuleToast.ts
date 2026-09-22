import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { LIVE_SOCKET_EVENTS } from '@/lib/live-events';

export type OverRuleToastPayload = {
  inningsId: string;
  overNumber: number;
  ruleName: string;
  message: string;
  bonusRuns: number;
  penaltyRuns: number;
};

/** Surfaces the live "Over N — Target Achieved +2 Bonus" toast fired once per newly-completed
 * over with a configured rule (see LIVE_SOCKET.overRuleApplied, emitted from ScoringService). */
export function useOverRuleToast() {
  const [toast, setToast] = useState<OverRuleToastPayload | null>(null);
  useEffect(() => {
    const s = getSocket();
    const handler = (payload: OverRuleToastPayload) => {
      setToast(payload);
      window.setTimeout(() => setToast(null), 3500);
    };
    s.on(LIVE_SOCKET_EVENTS.overRuleApplied, handler);
    return () => {
      s.off(LIVE_SOCKET_EVENTS.overRuleApplied, handler);
    };
  }, []);
  return toast;
}
