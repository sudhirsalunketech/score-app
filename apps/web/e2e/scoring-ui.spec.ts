import { expect, test, type Page } from '@playwright/test';
import { apiJson, apiLogin, clickScore, createLiveMatch, inningsEvents, openScoring } from './helpers';

async function pickBowlerIfNeeded(page: Page, bowlerName: string) {
  const dot = page.getByRole('button', { name: /dot ball/i });
  if (await dot.isEnabled().catch(() => false)) return;
  const choose = page.getByRole('button', { name: /choose new bowler|over complete/i });
  if (await choose.isVisible().catch(() => false)) await choose.click();
  else await page.getByRole('button', { name: /^bowler$/i }).click();
  await page.getByRole('button', { name: bowlerName }).first().click();
  await expect(dot).toBeEnabled();
}

test.describe('scoring UI', () => {
  test('30 legal dots end the innings and block a 31st ball', async ({ request, page }) => {
    test.setTimeout(120_000);
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `Thirty ${Date.now()}`, batters: 3, overs: 5, maxWickets: 7 });
    await openScoring(page, live.matchId);
    await expect(page.getByRole('button', { name: /dot ball/i })).toBeEnabled();
    for (let i = 0; i < 30; i++) {
      if (i > 0 && i % 6 === 0) {
        await pickBowlerIfNeeded(page, live.awayPlayers[(i / 6) % live.awayPlayers.length]!.name);
      }
      await page.getByRole('button', { name: /dot ball/i }).click();
      await page.waitForTimeout(520);
    }
    await expect(page.getByText(/5\.0\s*\/\s*5/)).toBeVisible();
    await expect(page.getByRole('button', { name: /start 2nd innings/i })).toBeVisible();
    await expect(page.getByText('This match is limited to 5 overs. No additional overs can be added.')).toBeVisible();
    expect(await inningsEvents(request, token, live.inningsId)).toHaveLength(30);
    const extra = await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, token, {
      strikerId: live.homePlayers[0].id,
      nonStrikerId: live.homePlayers[1].id,
      bowlerId: live.awayPlayers[0].id,
      batsmanRuns: 1,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `thirty-extra-${live.stamp}`,
    });
    expect(extra.status).toBe(409);
  });

  test('7 UI wickets end the innings and reject an 8th', async ({ request, page }) => {
    test.setTimeout(120_000);
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `Wickets ${Date.now()}`, batters: 8, overs: 5, maxWickets: 7 });
    await openScoring(page, live.matchId);
    for (let i = 0; i < 7; i++) {
      if (i > 0 && i % 6 === 0) {
        await pickBowlerIfNeeded(page, live.awayPlayers[1]!.name);
      }
      await page.getByRole('button', { name: /^out$|^wicket$/i }).click();
      await page.getByRole('button', { name: /^bowled$/i }).click();
      await page.waitForTimeout(550);
      if (i < 6) {
        const choose = page.getByRole('button', { name: /choose new batsman/i });
        if (await choose.isVisible().catch(() => false)) await choose.click();
        await page.getByRole('button', { name: live.homePlayers[i + 2]?.name ?? live.homePlayers[i + 1]!.name }).first().click();
        await page.waitForTimeout(300);
      }
    }
    await expect(page.getByText(/maximum number of wickets|start 2nd innings/i).first()).toBeVisible();
    const events = await inningsEvents(request, token, live.inningsId);
    expect(events.filter((e) => e.isWicket).length).toBe(7);
    const eighth = await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, token, {
      strikerId: live.homePlayers[7].id,
      nonStrikerId: live.homePlayers[1].id,
      bowlerId: live.awayPlayers[0].id,
      batsmanRuns: 0,
      extraType: 'NONE',
      isWicket: true,
      dismissalType: 'BOWLED',
      dismissedPlayerId: live.homePlayers[7].id,
      idempotencyKey: `eighth-${live.stamp}`,
    });
    expect(eighth.status).toBe(409);
    expect(JSON.stringify(eighth.raw)).toMatch(/maximum number of wickets|innings is already complete/);
  });

  test('rapid taps do not create one delivery per click', async ({ request, page }) => {
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `Rapid ${Date.now()}`, batters: 3 });
    await openScoring(page, live.matchId);
    const one = page.getByRole('button', { name: '1', exact: true });
    await Promise.all(Array.from({ length: 20 }, () => one.click({ force: true })));
    await page.waitForTimeout(1500);
    const events = await inningsEvents(request, token, live.inningsId);
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThan(20);
    const liveState = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}/live`, token);
    expect(liveState.body.snapshot.totalRuns).toBe(events.reduce((sum, ev) => sum + (ev.batsmanRuns ?? 0), 0));
  });

  test('keypad runs and extras update the live score', async ({ request, page }) => {
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `Keys ${Date.now()}`, batters: 3, overs: 5 });
    await openScoring(page, live.matchId);
    await clickScore(page, '1');
    await clickScore(page, '2');
    await clickScore(page, '4');
    await clickScore(page, '6');
    await clickScore(page, '5');
    await clickScore(page, '3');
    await page.getByRole('button', { name: /^wd$|^wide$/i }).click();
    await page.getByRole('button', { name: /^wd$/i }).click();
    await page.waitForTimeout(520);
    const events = await inningsEvents(request, token, live.inningsId);
    expect(events.length).toBeGreaterThanOrEqual(6);
    const snap = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}/live`, token);
    expect(snap.body.snapshot.totalRuns).toBeGreaterThanOrEqual(21);
    expect(snap.body.snapshot.extras).toBeGreaterThanOrEqual(1);
  });
});
