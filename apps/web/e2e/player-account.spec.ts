import { expect, test, type Page } from '@playwright/test';
import { apiJson, apiLogin, browserLogin, createLiveMatch, openMenu, registerUser } from './helpers';

async function noPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return () => {
    const noisy = errors.filter(
      (text) =>
        !/favicon|Download the React DevTools|net::ERR_CONNECTION_REFUSED|ResizeObserver|fonts\.gstatic|Access-Control-Allow-Headers|net::ERR_FAILED/i.test(
          text,
        ),
    );
    expect(noisy, noisy.join('\n')).toEqual([]);
  };
}

async function gotoAuthed(page: Page, path: string, email: string, password: string) {
  await page.goto(path);
  if (/\/login/.test(page.url())) {
    await browserLogin(page, email, password);
    await page.goto(path);
  }
}

test.describe('PLAYER account', () => {
  test('PLAYER can read own profile and cannot score or manage', async ({ request, page }) => {
    const player = await registerUser(request, 'E2E Player');
    const me = await apiJson(request, 'GET', '/api/v1/users/me/player', player.token);
    expect(me.status).toBeLessThan(300);
    expect(me.body.profileCode).toBeTruthy();
    expect(me.body.email).toBeUndefined();
    expect(me.body.phone).toBeUndefined();
    expect(JSON.stringify(me.body)).not.toContain(player.email);

    expect((await apiJson(request, 'GET', '/api/v1/users/me/teams', player.token)).status).toBeLessThan(300);
    expect((await apiJson(request, 'GET', '/api/v1/users/me/played-matches', player.token)).status).toBeLessThan(300);
    expect((await apiJson(request, 'GET', '/api/v1/users/me/tournaments', player.token)).status).toBeLessThan(300);

    const createTeam = await apiJson(request, 'POST', '/api/v1/teams', player.token, { name: 'Hacked XI' });
    expect([401, 403]).toContain(createTeam.status);
    const createMatch = await apiJson(request, 'POST', '/api/v1/matches', player.token, {
      homeTeamId: 'nope',
      awayTeamId: 'nope2',
    });
    expect(createMatch.status).toBeGreaterThanOrEqual(400);

    await browserLogin(page, player.email, player.password);
    await page.goto('/');
    await expect(page.getByText('PLAYER', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /start match/i })).toHaveCount(0);
    await page.goto(`/players/${me.body.id}`);
    await expect(page.getByText(me.body.name).first()).toBeVisible();
  });

  test('PLAYER home through public profile and share, without scorer controls', async ({ request, page }) => {
    const player = await registerUser(request, 'E2E Flow Player');
    const me = await apiJson(request, 'GET', '/api/v1/users/me/player', player.token);
    expect(me.status).toBeLessThan(300);
    const done = await noPageErrors(page);
    await browserLogin(page, player.email, player.password);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByText('PLAYER', { exact: true }).first()).toBeVisible();
    if (me.body.profileCode) await expect(page.getByText(me.body.profileCode).first()).toBeVisible();

    await openMenu(page);
    const drawer = page.getByRole('dialog', { name: /main navigation/i });
    await expect(drawer.getByRole('link', { name: /^home$/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /my matches/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /live matches/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /my teams/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /my tournaments/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /^players$/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /^stats$/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /my clubs/i })).toBeVisible();
    await expect(drawer.locator('nav').getByRole('link', { name: /^profile$/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /^settings$/i })).toBeVisible();
    await expect(drawer.getByRole('button', { name: /^logout$/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /start match/i })).toHaveCount(0);
    await expect(drawer.getByRole('link', { name: /create tournament/i })).toHaveCount(0);
    await expect(drawer.getByRole('link', { name: /access management/i })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await gotoAuthed(page, '/my-matches', player.email, player.password);
    await expect(page.getByRole('heading', { name: /my matches/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /undo/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /dot ball/i })).toHaveCount(0);

    await page.goto('/live-matches');
    await expect(page.getByRole('button', { name: /undo/i })).toHaveCount(0);

    await gotoAuthed(page, '/my-teams', player.email, player.password);
    await expect(page.getByRole('heading', { name: /my teams/i })).toBeVisible();

    await gotoAuthed(page, '/my-tournaments', player.email, player.password);
    await expect(page.getByRole('heading', { name: /my tournaments/i })).toBeVisible();

    await page.goto(`/players/${me.body.id}`);
    await expect(page.getByText(me.body.name).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await page.getByRole('button', { name: /share/i }).click();
    await page.getByRole('tab', { name: /statistics/i }).click();
    await expect(page.getByRole('tab', { name: /insights/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /compare/i })).toBeVisible();

    await gotoAuthed(page, '/profile', player.email, player.password);
    await expect(page.getByRole('button', { name: /undo/i })).toHaveCount(0);
    done();
  });

  test('PLAYER attached to a live tournament match can open history, live score, stats and profile', async ({
    request,
    page,
  }) => {
    const admin = await apiLogin(request);
    const player = await registerUser(request, 'E2E Squad Player');
    const me = await apiJson(request, 'GET', '/api/v1/users/me/player', player.token);
    expect(me.status).toBeLessThan(300);

    const stamp = Date.now();
    const tn = await apiJson(request, 'POST', '/api/v1/tournaments', admin, {
      name: `Player Cup ${stamp}`,
      season: '2026-27',
      visibility: 'PUBLIC',
      defaultOvers: 5,
      defaultMaxWickets: 7,
    });
    expect(tn.status).toBeLessThan(300);
    const group = await apiJson(request, 'POST', `/api/v1/tournaments/${tn.body.id}/groups`, admin, { name: 'A' });
    const live = await createLiveMatch(request, admin, {
      prefix: `Squad ${stamp}`,
      tournamentId: tn.body.id,
      batters: 3,
    });
    const groupedHome = await apiJson(request, 'POST', `/api/v1/tournaments/${tn.body.id}/groups/${group.body.id}/teams`, admin, {
      teamId: live.home.id,
    });
    expect([200, 201, 409]).toContain(groupedHome.status);
    const groupedAway = await apiJson(request, 'POST', `/api/v1/tournaments/${tn.body.id}/groups/${group.body.id}/teams`, admin, {
      teamId: live.away.id,
    });
    expect([200, 201, 409]).toContain(groupedAway.status);
    const added = await apiJson(request, 'POST', `/api/v1/teams/${live.home.id}/players`, admin, { playerId: me.body.id });
    expect(added.status).toBeLessThan(300);
    await apiJson(request, 'PATCH', `/api/v1/matches/${live.matchId}`, admin, {
      publicLiveEnabled: true,
      visibility: 'PUBLIC',
    });
    const match = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}`, admin);
    const slug = match.body.publicSlug as string | undefined;

    const history = await apiJson(request, 'GET', '/api/v1/users/me/played-matches?status=live&limit=20', player.token);
    expect(history.status).toBeLessThan(300);
    expect((history.body.items ?? history.body).length ?? 1).toBeGreaterThan(0);
    const teams = await apiJson(request, 'GET', '/api/v1/users/me/teams', player.token);
    expect(JSON.stringify(teams.body)).toContain(live.home.id);
    const tournaments = await apiJson(request, 'GET', '/api/v1/users/me/tournaments', player.token);
    expect(JSON.stringify(tournaments.body)).toContain(tn.body.id);
    const teamMatches = await apiJson(request, 'GET', `/api/v1/teams/${live.home.id}/matches?limit=20`, player.token);
    expect(teamMatches.status).toBeLessThan(300);
    expect((teamMatches.body.items ?? []).some((row: { id: string }) => row.id === live.matchId)).toBe(true);

    const blocked = await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, player.token, {
      idempotencyKey: `player-flow-${stamp}`,
      strikerId: live.homePlayers[0]?.id,
      nonStrikerId: live.homePlayers[1]?.id,
      bowlerId: live.awayPlayers[0]?.id,
      batsmanRuns: 4,
    });
    expect(blocked.status).toBeGreaterThanOrEqual(400);

    const done = await noPageErrors(page);
    await browserLogin(page, player.email, player.password);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByText('PLAYER', { exact: true }).first()).toBeVisible();

    await page.goto('/my-matches?filter=live');
    await expect(page.getByRole('heading', { name: /my matches/i })).toBeVisible();
    await expect(page.locator('li').filter({ hasText: live.home.name })).toBeVisible();
    await page.locator('li').filter({ hasText: live.home.name }).getByRole('link').first().click();
    await expect(page.getByRole('button', { name: /dot ball/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /undo/i })).toHaveCount(0);

    if (slug) {
      await page.goto(`/live/match/${slug}`);
      await expect(page.getByText(live.home.name).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /dot ball/i })).toHaveCount(0);
    }

    await page.goto('/my-teams');
    await page.getByRole('link', { name: new RegExp(live.home.name, 'i') }).first().click();
    await expect(page.getByRole('tab', { name: /matches/i })).toBeVisible();
    await page.getByRole('tab', { name: /matches/i }).click();
    await page.getByRole('tab', { name: /tournaments/i }).click();

    await page.goto('/my-tournaments');
    await expect(page.getByText(tn.body.name).first()).toBeVisible();
    await page.getByRole('link', { name: new RegExp(tn.body.name, 'i') }).first().click();
    await expect(page.getByText(/my tournament performance|overview|points/i).first()).toBeVisible();

    await page.goto(`/tournaments/${tn.body.id}/players/${me.body.id}`);
    await expect(page.getByText(me.body.name).first()).toBeVisible();

    await page.goto(`/matches/${live.matchId}/player/${me.body.id}`);
    await expect(page.getByText(/player performance/i).first()).toBeVisible();

    await page.goto(`/players/${me.body.id}`);
    await expect(page.getByText(me.body.name).first()).toBeVisible();
    await page.getByRole('button', { name: /share/i }).click();
    done();
  });
});
