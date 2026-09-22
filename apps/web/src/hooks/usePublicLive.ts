import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { LIVE_SOCKET_EVENTS } from '@/lib/live-events';
import type { PublicLiveScoreDto } from '@/types/api';

export type LiveConnection = 'connected' | 'reconnecting' | 'offline';

export function usePublicLive(slug: string) {
  const [data, setData] = useState<PublicLiveScoreDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<LiveConnection>('reconnecting');
  const [flash, setFlash] = useState<string | null>(null);
  const lastSeq = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  const apply = useCallback((dto: PublicLiveScoreDto) => {
    const seq = dto.lastBall?.sequence ?? null;
    if (seq != null && lastSeq.current != null && seq > lastSeq.current && dto.lastBall?.flash) {
      setFlash(dto.lastBall.flash);
      window.setTimeout(() => setFlash(null), 1400);
    }
    if (seq != null) lastSeq.current = Math.max(lastSeq.current ?? 0, seq);
    setData(dto);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    const dto = await api<PublicLiveScoreDto>(`/api/v1/public/matches/${slug}/live`, { auth: false });
    apply(dto);
  }, [apply, slug]);

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, [load]);

  useEffect(() => {
    const s = getSocket();
    const stopPoll = () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    const startPoll = () => {
      if (pollRef.current) return;
      pollRef.current = window.setInterval(() => {
        void load().catch(() => setConnection('offline'));
      }, 5000);
    };

    const onDto = (dto: PublicLiveScoreDto) => {
      if (dto.publicSlug && dto.publicSlug !== slug) return;
      apply(dto);
    };
    const onConnect = () => {
      setConnection('connected');
      stopPoll();
      s.emit(LIVE_SOCKET_EVENTS.joinPublic, slug);
      void load().catch(() => undefined);
    };
    const onDisconnect = () => {
      setConnection('reconnecting');
      startPoll();
    };
    const onError = () => {
      setConnection('offline');
      startPoll();
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onError);
    s.on(LIVE_SOCKET_EVENTS.scoreUpdated, onDto);
    s.on(LIVE_SOCKET_EVENTS.joinDenied, () => setError('This match is not public'));
    if (s.connected) onConnect();
    else s.connect();

    return () => {
      stopPoll();
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onError);
      s.off(LIVE_SOCKET_EVENTS.scoreUpdated, onDto);
    };
  }, [apply, load, slug]);

  return { data, error, connection, flash, reload: load };
}
