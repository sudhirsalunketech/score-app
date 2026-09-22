import { expect, test } from '@playwright/test';
import { apiLogin, createLiveMatch, clickScore, openScoring } from './helpers';

test.describe('undo across an over boundary', () => {
  test('undoing the 6th ball of an over restores the previous bowler instead of asking to choose a new one', async ({ request, page }) => {
    test.setTimeout(60_000);
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `UndoOver ${Date.now()}`, batters: 3, overs: 5, maxWickets: 7 });
    await openScoring(page, live.matchId);

    const bowlerName = live.awayPlayers[0]!.name;
    const dot = page.getByRole('button', { name: /dot ball/i });

    // Balls 1-5 of over 0 — plain dot balls, same bowler throughout.
    for (let i = 0; i < 5; i++) {
      await clickScore(page, /dot ball/i);
    }
    await expect(page.getByText(/0\.5\s*\/\s*5/)).toBeVisible();

    // Ball 6 — a six, completing the over.
    await clickScore(page, '6');
    await expect(page.getByText(/1\.0\s*\/\s*5/)).toBeVisible();
    await expect(page.getByRole('button', { name: /choose new bowler|over complete/i }).first()).toBeVisible();

    // The over completing auto-opens the "choose new bowler" sheet; close it first, same as a
    // scorer who wants to undo instead of picking a new bowler.
    const closeSheet = page.getByRole('button', { name: /^close$/i });
    if (await closeSheet.isVisible().catch(() => false)) await closeSheet.click();

    // Undo the 6 that completed the over.
    await page.getByRole('button', { name: /^undo$/i }).click();
    await page.waitForTimeout(600);

    // Expect: back to 0.5, no "choose new bowler" prompt, previous bowler's figures restored,
    // and the keypad usable again without forcing a bowler re-selection.
    await expect(page.getByText(/0\.5\s*\/\s*5/)).toBeVisible();
    await expect(page.getByRole('button', { name: /choose new bowler|over complete/i })).toHaveCount(0);
    await expect(dot).toBeEnabled();
    await expect(page.getByText(bowlerName).first()).toBeVisible();
  });
});
