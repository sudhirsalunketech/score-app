import { expect, test } from '@playwright/test';
import { apiJson, apiLogin, createLiveMatch } from './helpers';

test.describe('broadcast overlay', () => {
  test('public overlay is transparent, live, and does not replay FOUR after refresh', async ({ request, page }) => {
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `OV ${Date.now()}`, batters: 4 });
    await apiJson(request, 'PATCH', `/api/v1/matches/${live.matchId}`, token, {
      publicLiveEnabled: true,
      visibility: 'UNLISTED',
    });
    const match = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}`, token);
    const slug = match.body.publicSlug as string;
    expect(slug).toBeTruthy();

    await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, token, {
      strikerId: live.homePlayers[0].id,
      nonStrikerId: live.homePlayers[1].id,
      bowlerId: live.awayPlayers[0].id,
      batsmanRuns: 1,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `ov-1-${live.stamp}`,
    });

    await page.goto(`/live/match/${slug}/overlay?mode=standard`);
    await expect(page.locator('html')).toHaveClass(/cs-overlay/);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.locator('[data-overlay-mode="standard"]')).toBeVisible();
    await expect(page.getByText(live.home.name, { exact: false })).toBeVisible();
    await expect(page.getByText('1/0')).toBeVisible();

    await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, token, {
      strikerId: live.homePlayers[0].id,
      nonStrikerId: live.homePlayers[1].id,
      bowlerId: live.awayPlayers[0].id,
      batsmanRuns: 4,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `ov-4-${live.stamp}`,
    });
    await expect(page.getByText('FOUR', { exact: true })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('5/0')).toBeVisible();

    await page.reload();
    await expect(page.locator('[data-overlay-mode="standard"]')).toBeVisible();
    await expect(page.getByText('5/0')).toBeVisible();
    await expect(page.getByText('FOUR', { exact: true })).toHaveCount(0);
  });

  test('wicket burst and innings-break card appear on the overlay', async ({ request, page }) => {
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `OV2 ${Date.now()}`, batters: 4, overs: 1 });
    await apiJson(request, 'PATCH', `/api/v1/matches/${live.matchId}`, token, {
      publicLiveEnabled: true,
      visibility: 'UNLISTED',
    });
    const match = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}`, token);
    const slug = match.body.publicSlug as string;
    await page.goto(`/live/match/${slug}/overlay?mode=standard`);
    await expect(page.locator('[data-overlay-mode="standard"]')).toBeVisible();

    await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, token, {
      strikerId: live.homePlayers[0].id,
      nonStrikerId: live.homePlayers[1].id,
      bowlerId: live.awayPlayers[0].id,
      batsmanRuns: 0,
      extraType: 'NONE',
      isWicket: true,
      dismissalType: 'BOWLED',
      dismissedPlayerId: live.homePlayers[0].id,
      idempotencyKey: `ov-w-${live.stamp}`,
    });
    await expect(page.getByText('WICKET', { exact: true }).first()).toBeVisible({ timeout: 8_000 });

    for (let i = 0; i < 5; i++) {
      await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, token, {
        strikerId: live.homePlayers[1].id,
        nonStrikerId: live.homePlayers[2].id,
        bowlerId: live.awayPlayers[0].id,
        batsmanRuns: 0,
        extraType: 'NONE',
        isWicket: false,
        idempotencyKey: `ov-dot-${live.stamp}-${i}`,
      });
    }
    await expect(page.getByText(/innings break/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
