import { expect, test } from '@playwright/test';
import { API, apiJson, apiLogin, browserLogin, createLiveMatch, registerUser } from './helpers';

test('two public viewers update when the scorer posts a ball', async ({ browser, request }) => {
  const health = await request.get(`${API}/api/v1/health`);
  test.skip(!health.ok(), 'API is not running');
  const token = await apiLogin(request);
  const live = await createLiveMatch(request, token, { prefix: `Viewers ${Date.now()}` });
  await apiJson(request, 'PATCH', `/api/v1/matches/${live.matchId}`, token, {
    publicLiveEnabled: true,
    visibility: 'UNLISTED',
  });
  const match = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}`, token);
  const slug = match.body.publicSlug as string | undefined;
  test.skip(!slug, 'match has no public slug');

  const viewerA = await browser.newContext();
  const viewerB = await browser.newContext();
  const pageA = await viewerA.newPage();
  const pageB = await viewerB.newPage();
  await pageA.goto(`/live/match/${slug}`);
  await pageB.goto(`/live/match/${slug}`);

  const innings = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}/live`, token);
  const inningsId = innings.body.innings?.id ?? innings.body.match?.innings?.[0]?.id;
  test.skip(!inningsId, 'no innings');
  await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, token, {
    idempotencyKey: `e2e-${Date.now()}`,
    strikerId: live.homePlayers[0]?.id,
    nonStrikerId: live.homePlayers[1]?.id,
    bowlerId: live.awayPlayers[0]?.id,
    batsmanRuns: 4,
  });

  await expect(pageA.getByText(/4|FOUR/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(pageB.getByText(/4|FOUR/i).first()).toBeVisible({ timeout: 15_000 });
  await viewerA.close();
  await viewerB.close();
});

test('PLAYER viewer receives live updates and cannot score or undo', async ({ browser, request }) => {
  const health = await request.get(`${API}/api/v1/health`);
  test.skip(!health.ok(), 'API is not running');
  const token = await apiLogin(request);
  const player = await registerUser(request, 'E2E Live Viewer');
  const live = await createLiveMatch(request, token, { prefix: `PlayerView ${Date.now()}` });
  await apiJson(request, 'PATCH', `/api/v1/matches/${live.matchId}`, token, {
    publicLiveEnabled: true,
    visibility: 'UNLISTED',
  });
  const match = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}`, token);
  const slug = match.body.publicSlug as string | undefined;
  test.skip(!slug, 'match has no public slug');

  const innings = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}/live`, token);
  const inningsId = innings.body.innings?.id ?? innings.body.match?.innings?.[0]?.id;
  test.skip(!inningsId, 'no innings');

  const blockedEvent = await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, player.token, {
    idempotencyKey: `player-block-${Date.now()}`,
    strikerId: live.homePlayers[0]?.id,
    nonStrikerId: live.homePlayers[1]?.id,
    bowlerId: live.awayPlayers[0]?.id,
    batsmanRuns: 4,
  });
  expect(blockedEvent.status).toBeGreaterThanOrEqual(400);
  const blockedUndo = await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/undo`, player.token);
  expect(blockedUndo.status).toBeGreaterThanOrEqual(400);
  const blockedEdit = await apiJson(request, 'PATCH', `/api/v1/matches/${live.matchId}`, player.token, {
    overs: 99,
  });
  expect(blockedEdit.status).toBeGreaterThanOrEqual(400);

  const playerCtx = await browser.newContext();
  const publicCtx = await browser.newContext();
  const playerPage = await playerCtx.newPage();
  const publicPage = await publicCtx.newPage();
  await browserLogin(playerPage, player.email, player.password);
  await playerPage.goto(`/live/match/${slug}`);
  await publicPage.goto(`/live/match/${slug}`);
  await expect(playerPage.getByRole('button', { name: /dot ball/i })).toHaveCount(0);
  await expect(playerPage.getByRole('button', { name: /undo/i })).toHaveCount(0);

  await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, token, {
    idempotencyKey: `e2e-player-view-${Date.now()}`,
    strikerId: live.homePlayers[0]?.id,
    nonStrikerId: live.homePlayers[1]?.id,
    bowlerId: live.awayPlayers[0]?.id,
    batsmanRuns: 6,
  });

  await expect(playerPage.getByText(/6|SIX/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(publicPage.getByText(/6|SIX/i).first()).toBeVisible({ timeout: 15_000 });
  await playerCtx.close();
  await publicCtx.close();
});
