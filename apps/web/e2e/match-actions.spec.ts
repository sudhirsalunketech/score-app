import { expect, test } from '@playwright/test';
import { apiJson, apiLogin, createLiveMatch, inningsEvents, openScoring, registerUser } from './helpers';

test.describe('match actions', () => {
  test('undo reverts only the last ball and keeps other dismissals', async ({ request, page }) => {
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `Undo ${Date.now()}`, batters: 4 });
    await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, token, {
      strikerId: live.homePlayers[0].id,
      nonStrikerId: live.homePlayers[1].id,
      bowlerId: live.awayPlayers[0].id,
      batsmanRuns: 0,
      extraType: 'NONE',
      isWicket: true,
      dismissalType: 'BOWLED',
      dismissedPlayerId: live.homePlayers[0].id,
      idempotencyKey: `undo-wkt-${live.stamp}`,
    });
    await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, token, {
      strikerId: live.homePlayers[2].id,
      nonStrikerId: live.homePlayers[1].id,
      bowlerId: live.awayPlayers[0].id,
      batsmanRuns: 4,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `undo-four-${live.stamp}`,
    });
    await openScoring(page, live.matchId);
    await expect(page.getByText('4-1')).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByText('0-1')).toBeVisible({ timeout: 10_000 });
    const after = await inningsEvents(request, token, live.inningsId);
    expect(after).toHaveLength(1);
    expect(after[0]?.isWicket).toBe(true);
    await page.reload();
    await expect(page.getByText('0-1')).toBeVisible();
    expect(await inningsEvents(request, token, live.inningsId)).toHaveLength(1);
  });

  test('cancel match confirms, locks scoring, and creates no extra ball', async ({ request, page }) => {
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `Cancel ${Date.now()}`, batters: 3 });
    await openScoring(page, live.matchId);
    await page.getByRole('button', { name: /match actions/i }).click();
    await page.getByRole('button', { name: /cancel match/i }).click();
    await expect(page.getByText('Cancel Match?')).toBeVisible();
    await expect(page.getByText(/stop the match from being scored/i)).toBeVisible();
    await page.getByRole('button', { name: /^confirm$/i }).click();
    await expect.poll(async () => (await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}`, token)).body.status).toBe('CANCELLED');
    await page.goto(`/matches/${live.matchId}/score`);
    const before = await inningsEvents(request, token, live.inningsId);
    await page.getByRole('button', { name: '1', exact: true }).click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(600);
    expect(await inningsEvents(request, token, live.inningsId)).toHaveLength(before.length);
  });

  test('abandon match confirms and locks scoring', async ({ request, page }) => {
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `Abandon ${Date.now()}`, batters: 3 });
    await openScoring(page, live.matchId);
    await page.getByRole('button', { name: /match actions/i }).click();
    await page.getByRole('button', { name: /abandon match/i }).click();
    await expect(page.getByText('Abandon Match?')).toBeVisible();
    await page.getByRole('button', { name: /^confirm$/i }).click();
    await expect.poll(async () => (await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}`, token)).body.status).toBe('ABANDONED');
    await page.goto(`/matches/${live.matchId}/centre`);
    await expect(page.getByText(/abandon/i).first()).toBeVisible();
    const blocked = await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, token, {
      strikerId: live.homePlayers[0].id,
      nonStrikerId: live.homePlayers[1].id,
      bowlerId: live.awayPlayers[0].id,
      batsmanRuns: 1,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `abandon-extra-${live.stamp}`,
    });
    expect(blocked.status).toBeGreaterThanOrEqual(400);
  });

  test('unauthorized user cannot cancel or abandon', async ({ request }) => {
    const token = await apiLogin(request);
    const other = await registerUser(request, 'E2E NoResult');
    const live = await createLiveMatch(request, token, { prefix: `PermStop ${Date.now()}`, batters: 3 });
    const cancel = await apiJson(request, 'POST', `/api/v1/matches/${live.matchId}/cancel`, other.token);
    const abandon = await apiJson(request, 'POST', `/api/v1/matches/${live.matchId}/abandon`, other.token);
    expect(cancel.status).toBeGreaterThanOrEqual(400);
    expect(abandon.status).toBeGreaterThanOrEqual(400);
    const owner = await apiJson(request, 'POST', `/api/v1/matches/${live.matchId}/cancel`, token);
    expect(owner.status).toBeLessThan(300);
  });
});
