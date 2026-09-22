import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  enqueueDelivery,
  getQueue,
  queueStatusSummary,
  retryFailed,
  startOfflineQueue,
  subscribeQueue,
  type QueuedDelivery,
  type QueueStatus,
} from '@/lib/offline-queue';
import type { DeliveryPayload } from '@/types/api';

type QueueContextValue = {
  items: QueuedDelivery[];
  summary: QueueStatus | 'synced';
  online: boolean;
  enqueue: (inningsId: string, matchId: string, payload: Omit<DeliveryPayload, 'idempotencyKey'> & { idempotencyKey?: string }) => QueuedDelivery;
  retry: () => void;
};

const QueueContext = createContext<QueueContextValue | null>(null);

export function QueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QueuedDelivery[]>(() => getQueue());
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const stop = startOfflineQueue();
    const unsub = subscribeQueue(setItems);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      stop();
      unsub();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const value = useMemo(
    () => ({
      items,
      summary: queueStatusSummary(items),
      online,
      enqueue: enqueueDelivery,
      retry: retryFailed,
    }),
    [items, online],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useOfflineQueue() {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useOfflineQueue must be used within QueueProvider');
  return ctx;
}
