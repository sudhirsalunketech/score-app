import type { Envelope } from '@/types/api';

export const API_URL = (() => {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (!configured || configured === 'same-origin') {
    return import.meta.env.DEV ? 'http://localhost:4000' : '';
  }
  return configured.replace(/\/$/, '');
})();

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type TokenStore = {
  getAccess: () => string | null;
  getRefresh: () => string | null;
  setTokens: (access: string, refresh: string) => void;
  clear: () => void;
};

let tokens: TokenStore = {
  getAccess: () => localStorage.getItem('cs.access'),
  getRefresh: () => localStorage.getItem('cs.refresh'),
  setTokens: (access, refresh) => {
    localStorage.setItem('cs.access', access);
    localStorage.setItem('cs.refresh', refresh);
  },
  clear: () => {
    localStorage.removeItem('cs.access');
    localStorage.removeItem('cs.refresh');
  },
};

export function bindTokenStore(store: TokenStore) {
  tokens = store;
}

let refreshInFlight: Promise<boolean> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function decodeExpiryMs(accessToken: string): number | null {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Silently refreshes ~60s before the access token expires, so an active session never has to hit a reactive 401. */
export function scheduleTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  const access = tokens.getAccess();
  const expiryMs = access ? decodeExpiryMs(access) : null;
  if (!expiryMs) return;
  const delay = Math.max(expiryMs - Date.now() - 60_000, 5_000);
  refreshTimer = setTimeout(() => {
    void refreshAccess();
  }, delay);
}

// Two tabs can independently notice an expired/near-expiry access token and both race to rotate
// the same single-use refresh token; the loser gets a revoked-token error and would otherwise be
// logged out even though the session is still valid. navigator.locks serializes refresh attempts
// across tabs, and the pre/post snapshot lets a woken-up waiter reuse what another tab just fetched
// instead of retrying with the now-revoked token.
async function refreshAccess(): Promise<boolean> {
  const staleAccess = tokens.getAccess();

  const run = async (): Promise<boolean> => {
    const currentAccess = tokens.getAccess();
    if (currentAccess && currentAccess !== staleAccess) return true;

    const refreshToken = tokens.getRefresh();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = (await res.json()) as Envelope<{ accessToken: string; refreshToken: string }>;
      if (!res.ok || !json.success) {
        sessionStorage.setItem('cs.sessionExpired', '1');
        tokens.clear();
        scheduleTokenRefresh();
        return false;
      }
      tokens.setTokens(json.data.accessToken, json.data.refreshToken);
      scheduleTokenRefresh();
      return true;
    } catch {
      return false;
    }
  };

  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks?.request) {
    return locks.request('cs-auth-refresh', run);
  }
  if (!refreshInFlight) {
    refreshInFlight = run().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, headers = {} } = options;

  const send = async (): Promise<Response> => {
    const h: Record<string, string> = { ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const access = tokens.getAccess();
    if (auth && access) h.Authorization = `Bearer ${access}`;
    return fetch(`${API_URL}${path}`, {
      method,
      headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await send();
  if (res.status === 401 && auth) {
    const ok = await refreshAccess();
    if (ok) res = await send();
  }

  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError('Something went wrong', 'INTERNAL_ERROR', res.status);
  }

  if (!res.ok || !json.success) {
    const err = !json.success ? json.error : { code: 'INTERNAL_ERROR', message: 'Something went wrong' };
    throw new ApiError(err.message, err.code, res.status);
  }
  return json.data;
}

if (typeof window !== 'undefined') {
  scheduleTokenRefresh();
}
