import { expect, test } from '@playwright/test';
import { apiJson, apiLogin, browserLogin, createLiveMatch } from './helpers';

const viewports = [
  { name: '320', width: 320, height: 640 },
  { name: '360', width: 360, height: 800 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '414', width: 414, height: 896 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '820', width: 820, height: 1180 },
  { name: '912', width: 912, height: 1368 },
  { name: '1024', width: 1024, height: 1366 },
  { name: '1280', width: 1280, height: 720 },
  { name: '1366', width: 1366, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1600', width: 1600, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
];

const criticalViewports = [
  { name: '320', width: 320, height: 640 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 720 },
  { name: '1920', width: 1920, height: 1080 },
];

test.describe('responsive overflow', () => {
  for (const vp of viewports) {
    test(`login and home do not overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const path of ['/login', '/', '/tournaments', '/players', '/search']) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} @ ${vp.name}`).toBeLessThanOrEqual(2);
      }
    });
  }
});

test.describe('critical page overflow', () => {
  test('score, centre, tournament, profile, club and following do not overflow', async ({ page, request }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const club = await apiJson(request, 'POST', '/api/v1/clubs', token, {
      name: `Resp Club ${stamp}`,
      city: 'Pune',
      establishedYear: 2026,
    });
    const tn = await apiJson(request, 'POST', '/api/v1/tournaments', token, {
      name: `Resp Cup ${stamp}`,
      visibility: 'PUBLIC',
      defaultOvers: 5,
      defaultMaxWickets: 7,
    });
    const live = await createLiveMatch(request, token, { prefix: `Resp ${stamp}`, batters: 3, tournamentId: tn.body.id });
    const playerId = live.homePlayers[0].id;
    await browserLogin(page);
    const paths = [
      `/matches/${live.matchId}/score`,
      `/matches/${live.matchId}/centre`,
      `/tournaments/${tn.body.id}`,
      `/tournaments/new`,
      `/players/${playerId}`,
      `/following`,
      `/clubs/${club.body.id}`,
      `/teams/${live.home.id}`,
      `/my-matches`,
      `/my-teams`,
      `/my-tournaments`,
      `/players/${playerId}`,
    ];
    for (const vp of criticalViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const path of paths) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} @ ${vp.name}`).toBeLessThanOrEqual(8);
      }
    }
  });
});
