import { api, scheduleTokenRefresh } from './api';
import type { AuthPayload, User } from '@/types/api';

const ACCESS = 'cs.access';
const REFRESH = 'cs.refresh';

export function getAccessToken() {
  return localStorage.getItem(ACCESS);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH);
}

export function persistTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS, access);
  localStorage.setItem(REFRESH, refresh);
  scheduleTokenRefresh();
}

export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  scheduleTokenRefresh();
}

export async function requestLoginOtp(identifier: string) {
  return api<{ sent: boolean; via?: string; devCode?: string }>('/api/v1/auth/otp/request', {
    method: 'POST',
    body: { identifier },
    auth: false,
  });
}

export async function verifyLoginOtp(identifier: string, code: string) {
  const data = await api<AuthPayload>('/api/v1/auth/otp/verify', {
    method: 'POST',
    body: { identifier, code },
    auth: false,
  });
  persistTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function login(identifier: string, password: string) {
  const data = await api<AuthPayload>('/api/v1/auth/login', {
    method: 'POST',
    body: { identifier, email: identifier, password },
    auth: false,
  });
  persistTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function loginWithGoogle(credential: string) {
  const data = await api<AuthPayload>('/api/v1/auth/google', {
    method: 'POST',
    body: { credential },
    auth: false,
  });
  persistTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function register(email: string, password: string, name: string, phone?: string) {
  const data = await api<AuthPayload>('/api/v1/auth/register', {
    method: 'POST',
    body: { email, password, name, phone: phone || undefined },
    auth: false,
  });
  persistTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await api('/api/v1/auth/logout', { method: 'POST', body: { refreshToken }, auth: false });
    }
  } finally {
    clearTokens();
  }
}

export async function fetchMe() {
  return api<User>('/api/v1/users/me');
}

export async function updateMe(body: { name?: string; locale?: string; phone?: string; avatarUrl?: string | null }) {
  return api<User>('/api/v1/users/me', { method: 'PATCH', body });
}

export async function forgotPassword(email: string) {
  return api<{ sent?: boolean; devResetUrl?: string }>('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: { email },
    auth: false,
  });
}

export async function resetPassword(token: string, password: string) {
  return api<{ reset?: boolean }>('/api/v1/auth/reset-password', {
    method: 'POST',
    body: { token, password },
    auth: false,
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return api<{ changed?: boolean }>('/api/v1/users/me/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export async function logoutAll() {
  return api<{ loggedOut?: boolean }>('/api/v1/users/me/logout-all', { method: 'POST' });
}

export type AuthSession = {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt?: string;
  device?: string;
  browser?: string;
  current: boolean;
};

export async function listSessions() {
  const refresh = getRefreshToken();
  return api<AuthSession[]>('/api/v1/users/me/sessions', {
    headers: refresh ? { 'x-refresh-token': refresh } : {},
  });
}

export async function revokeSession(sessionId: string) {
  return api<{ revoked?: boolean }>(`/api/v1/users/me/sessions/${sessionId}`, { method: 'DELETE' });
}
