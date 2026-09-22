import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
export const EMAIL = process.env.E2E_EMAIL ?? 'admin@crickscore.dev';
export const PASSWORD = process.env.E2E_PASSWORD ?? 'ChangeMe123!';

let cachedAdminToken: string | null = null;

export async function apiLogin(request: APIRequestContext) {
  if (cachedAdminToken) return cachedAdminToken;
  const res = await request.post(`${API}/api/v1/auth/login`, {
    data: { identifier: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const data = body.data ?? body;
  cachedAdminToken = data.accessToken as string;
  return cachedAdminToken;
}

export async function apiJson(request: APIRequestContext, method: string, path: string, token?: string, data?: unknown) {
  const res = await request.fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    data,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body.data ?? body, raw: body };
}

export async function browserLogin(page: Page, identifier = EMAIL, password = PASSWORD) {
  await page.goto('/login');
  await page.getByRole('button', { name: /use password instead/i }).click();
  await page.getByLabel(/^email$/i).fill(identifier);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function registerUser(request: APIRequestContext, name = 'E2E User') {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'ChangeMe123!';
  const res = await request.post(`${API}/api/v1/auth/register`, {
    data: { email, password, name },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  const data = body.data ?? body;
  return { email, password, token: data.accessToken as string, user: data.user as { id: string; email: string; name: string } };
}

export async function openMenu(page: Page) {
  const toggle = page.getByRole('button', { name: /open menu|close menu/i });
  if (await toggle.isVisible().catch(() => false)) {
    const label = await toggle.getAttribute('aria-label');
    if (label && /open menu/i.test(label)) await toggle.click();
  }
}

export async function createLiveMatch(
  request: APIRequestContext,
  token: string,
  opts?: { overs?: number; maxWickets?: number; batters?: number; prefix?: string; tournamentId?: string },
) {
  const stamp = Date.now();
  const prefix = opts?.prefix ?? `E2E ${stamp}`;
  const batters = opts?.batters ?? 8;
  const home = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `${prefix} Home` });
  const away = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `${prefix} Away` });
  const homePlayers: { id: string; name: string }[] = [];
  const awayPlayers: { id: string; name: string }[] = [];
  for (let i = 1; i <= batters; i++) {
    const hp = await apiJson(request, 'POST', '/api/v1/players', token, { name: `${prefix} H${i}`, teamId: home.body.id });
    const ap = await apiJson(request, 'POST', '/api/v1/players', token, { name: `${prefix} A${i}`, teamId: away.body.id });
    homePlayers.push({ id: hp.body.id, name: hp.body.name });
    awayPlayers.push({ id: ap.body.id, name: ap.body.name });
  }
  const match = await apiJson(request, 'POST', '/api/v1/matches', token, {
    homeTeamId: home.body.id,
    awayTeamId: away.body.id,
    tournamentId: opts?.tournamentId,
    overs: opts?.overs ?? 5,
    maxWickets: opts?.maxWickets ?? 7,
  });
  await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/toss`, token, {
    tossWinnerTeamId: home.body.id,
    tossDecision: 'BAT',
  });
  const started = await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/innings`, token, {
    battingTeamId: home.body.id,
    bowlingTeamId: away.body.id,
  });
  const inningsId = started.body.innings[0].id as string;
  return {
    stamp,
    prefix,
    matchId: match.body.id as string,
    inningsId,
    home: home.body as { id: string; name: string },
    away: away.body as { id: string; name: string },
    homePlayers,
    awayPlayers,
  };
}

export async function inningsEvents(request: APIRequestContext, token: string, inningsId: string) {
  const ev = await apiJson(request, 'GET', `/api/v1/innings/${inningsId}/events`, token);
  const rows = Array.isArray(ev.body) ? ev.body : ev.body.events ?? [];
  return rows as Array<{ id: string; sequence?: number; batsmanRuns?: number; isWicket?: boolean }>;
}

export async function openScoring(page: Page, matchId: string) {
  await browserLogin(page);
  await page.goto(`/matches/${matchId}/score`);
  const start = page.getByRole('button', { name: /start scoring/i });
  const keypad = page.getByRole('button', { name: /dot ball/i });
  await expect(start.or(keypad).first()).toBeVisible({ timeout: 20_000 });
  const keypadReady = await keypad.isEnabled().catch(() => false);
  if (!keypadReady && (await start.isVisible()) && (await start.isEnabled())) {
    await start.click();
  }
  await expect(keypad).toBeEnabled({ timeout: 20_000 });
}

export async function clickScore(page: Page, name: string | RegExp) {
  if (name === '5' || name === '7') {
    await page.getByRole('button', { name: /4\s*5\s*6\s*7/ }).click();
  }
  const btn = page.getByRole('button', { name, exact: typeof name === 'string' });
  await expect(btn).toBeEnabled();
  await btn.click();
  await page.waitForTimeout(520);
}
