import { ApiError, api } from './api';
import type { DeliveryPayload } from '@/types/api';

export type QueueStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export type QueuedDelivery = {
  id: string;
  inningsId: string;
  matchId: string;
  payload: DeliveryPayload;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
};

const KEY = 'cs.offline-queue';
const MAX_ATTEMPTS = 6;

export function isNonRetryableQueueError(err: unknown) {
  return (
    err instanceof ApiError &&
    (err.status === 409 ||
      err.code === 'INVALID_MATCH_STATE' ||
      err.code === 'INVALID_DELIVERY' ||
      err.code === 'INVALID_WICKET')
  );
}

type Listener = (items: QueuedDelivery[]) => void;
const listeners = new Set<Listener>();

function read(): QueuedDelivery[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedDelivery[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedDelivery[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((fn) => fn(items));
}

export function subscribeQueue(fn: Listener) {
  listeners.add(fn);
  fn(read());
  return () => {
    listeners.delete(fn);
  };
}

export function getQueue() {
  return read();
}

export function queueStatusSummary(items = read()): 'synced' | 'pending' | 'failed' {
  if (items.some((i) => i.status === 'failed')) return 'failed';
  if (items.some((i) => i.status === 'pending' || i.status === 'syncing')) return 'pending';
  return 'synced';
}

export function enqueueDelivery(inningsId: string, matchId: string, payload: Omit<DeliveryPayload, 'idempotencyKey'> & { idempotencyKey?: string }) {
  const id = payload.idempotencyKey ?? crypto.randomUUID();
  const item: QueuedDelivery = {
    id,
    inningsId,
    matchId,
    payload: { ...payload, idempotencyKey: id },
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  };
  write([...read().filter((q) => q.status !== 'synced'), item]);
  void flushQueue();
  return item;
}

async function sendOne(item: QueuedDelivery) {
  await api(`/api/v1/innings/${item.inningsId}/events`, {
    method: 'POST',
    body: item.payload,
  });
}

export async function flushQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const items = read();
  for (const item of items) {
    if (item.status === 'synced') continue;
    if (item.status === 'failed' && item.attempts >= MAX_ATTEMPTS) continue;
    const next = { ...item, status: 'syncing' as const };
    write(read().map((q) => (q.id === item.id ? next : q)));
    try {
      await sendOne(item);
      write(read().map((q) => (q.id === item.id ? { ...q, status: 'synced' } : q)));
    } catch (err) {
      const fatal = isNonRetryableQueueError(err);
      const attempts = fatal ? MAX_ATTEMPTS : item.attempts + 1;
      write(
        read().map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
                attempts,
                lastError: err instanceof Error ? err.message : 'Failed',
              }
            : q,
        ),
      );
    }
  }
  write(read().filter((q) => q.status !== 'synced' || Date.now() - q.createdAt < 15_000));
}

export function retryFailed() {
  write(read().map((q) => (q.status === 'failed' ? { ...q, status: 'pending', attempts: 0 } : q)));
  void flushQueue();
}

export function startOfflineQueue() {
  const onOnline = () => void flushQueue();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', () => listeners.forEach((fn) => fn(read())));
  void flushQueue();
  const timer = window.setInterval(() => void flushQueue(), 8_000);
  return () => {
    window.removeEventListener('online', onOnline);
    window.clearInterval(timer);
  };
}
