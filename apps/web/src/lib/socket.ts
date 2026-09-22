import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';
import { LIVE_SOCKET_EVENTS } from './live-events';

export type SocketConnection = 'connected' | 'reconnecting' | 'offline';

let socket: Socket | null = null;

function accessToken() {
  try {
    return localStorage.getItem('cs.access');
  } catch {
    return null;
  }
}

export function getSocket() {
  if (!socket) {
    socket = io(API_URL || window.location.origin, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      auth: { token: accessToken() },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
    socket.io.on('reconnect_attempt', () => {
      if (socket) socket.auth = { token: accessToken() };
    });
  }
  return socket;
}

export function useSocketConnection(): SocketConnection {
  const [state, setState] = useState<SocketConnection>(() => (getSocket().connected ? 'connected' : 'reconnecting'));
  useEffect(() => {
    const s = getSocket();
    const onConnect = () => setState('connected');
    const onDisconnect = () => setState('reconnecting');
    const onError = () => setState(s.connected ? 'connected' : 'offline');
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onError);
    if (s.connected) setState('connected');
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onError);
    };
  }, []);
  return state;
}

export function joinMatch(matchId: string, onUpdate: () => void) {
  const s = getSocket();
  const join = () => {
    if (matchId) s.emit(LIVE_SOCKET_EVENTS.joinMatch, matchId);
  };
  const handler = () => onUpdate();

  s.on('connect', join);
  s.on('score.updated', handler);
  s.on(LIVE_SOCKET_EVENTS.scoreUpdated, handler);
  s.on(LIVE_SOCKET_EVENTS.deliveryCreated, handler);
  s.on(LIVE_SOCKET_EVENTS.viewerCount, handler);
  if (s.connected) join();
  else s.connect();

  return () => {
    s.off('connect', join);
    s.off('score.updated', handler);
    s.off(LIVE_SOCKET_EVENTS.scoreUpdated, handler);
    s.off(LIVE_SOCKET_EVENTS.deliveryCreated, handler);
    s.off(LIVE_SOCKET_EVENTS.viewerCount, handler);
  };
}
