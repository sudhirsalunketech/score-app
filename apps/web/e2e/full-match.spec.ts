import { expect, test } from '@playwright/test';
import { API, apiJson, apiLogin, browserLogin, createLiveMatch, registerUser } from './helpers';

async function ball(
  request: Parameters<typeof apiJson>[0],
  token: string,
  inningsId: string,
  key: string,
  body: Record<string, unknown>,
) {
  return apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, token, {
    extraType: 'NONE',
    isWicket: false,
    idempotencyKey: key,
    ...body,
  });
}

test.describe('full product journeys', () => {
  test('register, login, logout, login again', async ({ request, page }) => {
    const user = await registerUser(request, 'E2E Auth Loop');
    await browserLogin(page, user.email, user.password);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Log out all devices', exact: true }).click();
    await page.locator('button.bg-danger').filter({ hasText: /log out all devices/i }).click();
    await page.waitForFunction(() => !localStorage.getItem('cs.access'), null, { timeout: 15_000 });
    await page.goto('/following');
    await expect(page).toHaveURL(/\/login/);
    await browserLogin(page, user.email, user.password);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('5-over match scores 0-6, extra, wicket, undo, second innings, result, public viewers', async ({
    request,
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `Full ${Date.now()}`, overs: 5, maxWickets: 7, batters: 4 });
    await apiJson(request, 'PATCH', `/api/v1/matches/${live.matchId}`, token, {
      publicLiveEnabled: true,
      visibility: 'UNLISTED',
    });
    const striker = live.homePlayers[0]!.id;
    const non = live.homePlayers[1]!.id;
    const bowler = live.awayPlayers[0]!.id;
    const personnel = { strikerId: striker, nonStrikerId: non, bowlerId: bowler };
    for (const runs of [0, 1, 2, 3, 4, 6]) {
      const ev = await ball(request, token, live.inningsId, `full-${live.stamp}-r${runs}`, { ...personnel, batsmanRuns: runs });
      expect(ev.status, JSON.stringify(ev.raw)).toBeLessThan(300);
    }
    const extra = await ball(request, token, live.inningsId, `full-${live.stamp}-wd`, {
      ...personnel,
      batsmanRuns: 0,
      extraType: 'WIDE',
      extraRuns: 1,
    });
    expect(extra.status, JSON.stringify(extra.raw)).toBeLessThan(300);
    const wicket = await ball(request, token, live.inningsId, `full-${live.stamp}-w`, {
      ...personnel,
      batsmanRuns: 0,
      isWicket: true,
      dismissalType: 'BOWLED',
      dismissedPlayerId: striker,
    });
    expect(wicket.status, JSON.stringify(wicket.raw)).toBeLessThan(300);
    const beforeUndo = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}/live`, token);
    const undo = await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/undo`, token);
    expect(undo.status, JSON.stringify(undo.raw)).toBeLessThan(300);
    const afterUndo = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}/live`, token);
    const runsAfter = afterUndo.body.snapshot?.totalRuns ?? afterUndo.body.innings?.snapshot?.totalRuns;
    expect(runsAfter).toBe(17);
    const wicketsBefore = beforeUndo.body.snapshot?.totalWickets ?? beforeUndo.body.innings?.snapshot?.totalWickets ?? 0;
    expect(wicketsBefore).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < 24; i++) {
      const ev = await ball(request, token, live.inningsId, `full-${live.stamp}-fill-${i}`, {
        strikerId: live.homePlayers[1]!.id,
        nonStrikerId: live.homePlayers[2]!.id,
        bowlerId: live.awayPlayers[Math.floor(i / 6) % live.awayPlayers.length]!.id,
        batsmanRuns: 0,
      });
      expect(ev.status, JSON.stringify(ev.raw)).toBeLessThan(300);
    }

    const second = await apiJson(request, 'POST', `/api/v1/matches/${live.matchId}/innings`, token, {
      battingTeamId: live.away.id,
      bowlingTeamId: live.home.id,
    });
    expect(second.status, JSON.stringify(second.raw)).toBeLessThan(300);
    const secondId = (second.body.innings as Array<{ id: string; inningsNumber: number }>).find((i) => i.inningsNumber === 2)?.id
      ?? second.body.innings?.[1]?.id;
    expect(secondId).toBeTruthy();
    const target = second.body.innings?.find?.((i: { inningsNumber: number; targetRuns?: number }) => i.inningsNumber === 2)
      ?.targetRuns;
    const live2 = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}/live`, token);
    const targetLive = live2.body.innings?.targetRuns ?? live2.body.target ?? target;
    expect(Number(targetLive)).toBeGreaterThan(0);

    const chase = await ball(request, token, secondId, `full-${live.stamp}-chase`, {
      strikerId: live.awayPlayers[0]!.id,
      nonStrikerId: live.awayPlayers[1]!.id,
      bowlerId: live.homePlayers[0]!.id,
      batsmanRuns: 6,
    });
    expect(chase.status, JSON.stringify(chase.raw)).toBeLessThan(300);

    const completed = await apiJson(request, 'POST', `/api/v1/matches/${live.matchId}/complete`, token, {});
    expect(completed.status, JSON.stringify(completed.raw)).toBeLessThan(300);
    const result = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}/result`, token);
    expect(result.status).toBeLessThan(300);
    expect(result.body.resultType ?? result.body.status ?? completed.body.resultType).toBeTruthy();

    const pdf = await request.get(`${API}/api/v1/matches/${live.matchId}/scorecard.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(pdf.status()).toBeLessThan(400);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

    const match = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}`, token);
    const slug = match.body.publicSlug as string;
    const viewerA = await browser.newContext();
    const viewerB = await browser.newContext();
    const pageA = await viewerA.newPage();
    const pageB = await viewerB.newPage();
    await pageA.goto(`/live/match/${slug}`);
    await pageB.goto(`/live/match/${slug}`);
    await expect(pageA.getByText(live.home.name, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByText(live.away.name, { exact: false }).first()).toBeVisible();
    await viewerA.close();
    await viewerB.close();

    await browserLogin(page);
    await page.goto(`/matches/${live.matchId}/centre`);
    await expect(page.getByText(live.home.name, { exact: false }).first()).toBeVisible();
  });

  test('knockout champion is stored after the final', async ({ request }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const home = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `Champ H ${stamp}` });
    const away = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `Champ A ${stamp}` });
    const homePlayers = [];
    const awayPlayers = [];
    for (let i = 1; i <= 3; i++) {
      homePlayers.push((await apiJson(request, 'POST', '/api/v1/players', token, { name: `CH ${stamp} ${i}`, teamId: home.body.id })).body);
      awayPlayers.push((await apiJson(request, 'POST', '/api/v1/players', token, { name: `CA ${stamp} ${i}`, teamId: away.body.id })).body);
    }
    const tn = await apiJson(request, 'POST', '/api/v1/tournaments', token, {
      name: `Champ Cup ${stamp}`,
      stageType: 'KNOCKOUT',
      defaultOvers: 1,
      defaultMaxWickets: 7,
    });
    const generated = await apiJson(request, 'POST', `/api/v1/tournaments/${tn.body.id}/knockout/generate`, token, {
      teamIds: [home.body.id, away.body.id],
      pairing: 'SEEDED',
      overs: 1,
    });
    expect(generated.status, JSON.stringify(generated.raw)).toBeLessThan(300);
    const finalRound = (generated.body.rounds as Array<{ round: string; matches: Array<{ id: string }> }>).find(
      (r) => r.round === 'FINAL',
    );
    expect(finalRound?.matches.length).toBe(1);
    const matchId = finalRound!.matches[0]!.id;
    await apiJson(request, 'POST', `/api/v1/matches/${matchId}/toss`, token, {
      tossWinnerTeamId: home.body.id,
      tossDecision: 'BAT',
    });
    const started = await apiJson(request, 'POST', `/api/v1/matches/${matchId}/innings`, token, {
      battingTeamId: home.body.id,
      bowlingTeamId: away.body.id,
    });
    const firstId = started.body.innings[0].id as string;
    for (let i = 0; i < 6; i++) {
      const ev = await ball(request, token, firstId, `champ-dot-${stamp}-${i}`, {
        strikerId: homePlayers[0].id,
        nonStrikerId: homePlayers[1].id,
        bowlerId: awayPlayers[0].id,
        batsmanRuns: 0,
      });
      expect(ev.status, JSON.stringify(ev.raw)).toBeLessThan(300);
    }
    const second = await apiJson(request, 'POST', `/api/v1/matches/${matchId}/innings`, token, {
      battingTeamId: away.body.id,
      bowlingTeamId: home.body.id,
    });
    const secondId = (second.body.innings as Array<{ id: string; inningsNumber: number }>).find((i) => i.inningsNumber === 2)?.id;
    const win = await ball(request, token, secondId!, `champ-win-${stamp}`, {
      strikerId: awayPlayers[0].id,
      nonStrikerId: awayPlayers[1].id,
      bowlerId: homePlayers[0].id,
      batsmanRuns: 1,
    });
    expect(win.status, JSON.stringify(win.raw)).toBeLessThan(300);
    await apiJson(request, 'POST', `/api/v1/matches/${matchId}/complete`, token, {});
    const bracket = await apiJson(request, 'GET', `/api/v1/tournaments/${tn.body.id}/knockout`, token);
    expect(bracket.body.lifecycle).toBe('COMPLETED');
    expect(bracket.body.champion?.id ?? bracket.body.championTeamId).toBe(away.body.id);
    expect(bracket.body.runnerUp?.id ?? bracket.body.runnerUpTeamId).toBe(home.body.id);
  });
});
