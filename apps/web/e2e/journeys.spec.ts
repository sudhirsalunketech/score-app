import { expect, test } from '@playwright/test';
import { EMAIL, apiJson, apiLogin, browserLogin, openMenu, registerUser } from './helpers';

test.describe('public journeys', () => {
  test('guest sidebar shows public pages only', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await openMenu(page);
    const drawer = page.getByRole('dialog', { name: /main navigation/i });
    await expect(drawer.getByRole('link', { name: /^home$/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /live matches/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /^players$/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /^search$/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /login/i }).first()).toBeVisible();
    await drawer.getByRole('link', { name: /create account/i }).scrollIntoViewIfNeeded();
    await expect(drawer.getByRole('link', { name: /create account/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /start match/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /following/i })).toHaveCount(0);
    await expect(drawer.getByRole('link', { name: /my matches/i })).toHaveCount(0);
    await expect(drawer.getByRole('link', { name: /my teams/i })).toHaveCount(0);
    await expect(drawer.getByRole('link', { name: /my clubs/i })).toHaveCount(0);
    await expect(drawer.getByRole('link', { name: /create tournament/i })).toHaveCount(0);
  });

  test('OTP login and logout protect following', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.getByText(/dev code:/i)).toBeVisible();
    const hint = await page.getByText(/dev code:/i).innerText();
    const code = hint.replace(/\D/g, '').slice(-6);
    await page.getByLabel(/code|otp/i).fill(code);
    await page.getByRole('button', { name: /verify/i }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Log out all devices', exact: true }).click();
    await page.locator('button.bg-danger').filter({ hasText: /log out all devices/i }).click();
    await page.waitForFunction(() => !localStorage.getItem('cs.access'), null, { timeout: 15_000 });
    await page.goto('/following');
    await expect(page).toHaveURL(/\/login/);
  });

  test('forgot password email flow resets and logs in', async ({ request, page }) => {
    const user = await registerUser(request, 'E2E Reset');
    await page.goto('/forgot');
    await page.getByLabel(/^email$/i).fill(user.email);
    await page.getByRole('button', { name: /send|reset|submit/i }).click();
    await page.getByRole('link', { name: /open reset link/i }).click();
    await page.getByLabel(/new password/i).fill('NewPass123!');
    await page.getByLabel(/confirm password/i).fill('NewPass123!');
    await page.getByRole('button', { name: /set new password/i }).click();
    await expect(page.getByText(/password updated/i)).toBeVisible();
    await browserLogin(page, user.email, 'NewPass123!');
    const reused = await apiJson(request, 'POST', '/api/v1/auth/reset-password', undefined, {
      token: 'not-a-real-token-value',
      password: 'Another123!',
    });
    expect(reused.status).toBeGreaterThanOrEqual(400);
  });
});

test.describe('entity journeys', () => {
  test('profile tabs hide sibling panels and survive refresh', async ({ request, page }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const player = await apiJson(request, 'POST', '/api/v1/players', token, { name: `E2E Profile ${stamp}` });
    await browserLogin(page);
    await page.goto(`/players/${player.body.id}`);
    await expect(page.getByRole('heading', { name: `E2E Profile ${stamp}` })).toBeVisible();
    await expect(page.getByRole('tab', { name: /player overview/i })).toBeVisible();
    await expect(page.getByText('Batting', { exact: true })).toBeVisible();
    await expect(page.getByText('Bowling', { exact: true })).toBeVisible();
    await expect(page.getByText('Fielding', { exact: true })).toBeVisible();
    await expect(page.getByText(/profile id/i)).toBeVisible();
    await page.getByRole('tab', { name: /^statistics$/i }).click();
    await expect(page.getByText(/profile id/i)).toHaveCount(0);
    await expect(page).toHaveURL(/tab=statistics/);
    await page.getByRole('tab', { name: /^matches$/i }).click();
    await expect(page).toHaveURL(/tab=matches/);
    await expect(page.getByText(/profile id/i)).toHaveCount(0);
    await page.getByRole('tab', { name: /player overview/i }).click();
    await expect(page.getByText('Batting')).toBeVisible();
    await page.getByRole('tab', { name: /^statistics$/i }).click();
    await page.reload();
    await expect(page).toHaveURL(/tab=statistics/);
    await expect(page.getByText(/profile id/i)).toHaveCount(0);
  });

  test('search navigates to club, team, tournament, and player', async ({ request, page }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const club = await apiJson(request, 'POST', '/api/v1/clubs', token, {
      name: `Search Club ${stamp}`,
      city: 'Pune',
      establishedYear: 2026,
    });
    const team = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `Search Team ${stamp}`, clubId: club.body.id });
    const player = await apiJson(request, 'POST', '/api/v1/players', token, { name: `Search Player ${stamp}`, teamId: team.body.id });
    const tn = await apiJson(request, 'POST', '/api/v1/tournaments', token, {
      name: `Search Cup ${stamp}`,
      defaultOvers: 5,
      defaultMaxWickets: 7,
      visibility: 'PUBLIC',
    });
    await browserLogin(page);
    const go = async (q: string, href: RegExp) => {
      await page.goto(`/search?q=${encodeURIComponent(q)}`);
      await page.getByRole('link', { name: new RegExp(q, 'i') }).first().click();
      await expect(page).toHaveURL(href);
    };
    await go(`Search Club ${stamp}`, new RegExp(`/clubs/${club.body.id}`));
    await go(`Search Team ${stamp}`, new RegExp(`/teams/${team.body.id}`));
    await go(`Search Cup ${stamp}`, new RegExp(`/tournaments/${tn.body.id}`));
    await go(`Search Player ${stamp}`, new RegExp(`/players/${player.body.id}`));
  });

  test('tournament and match centre tabs render after a completed match', async ({ request, page }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const club = await apiJson(request, 'POST', '/api/v1/clubs', token, {
      name: `Centre Club ${stamp}`,
      city: 'Pune',
      establishedYear: 2026,
    });
    const home = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `Centre Alpha ${stamp}`, clubId: club.body.id });
    const away = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `Centre Beta ${stamp}`, clubId: club.body.id });
    const homeP: string[] = [];
    const awayP: string[] = [];
    for (let i = 1; i <= 3; i++) {
      homeP.push((await apiJson(request, 'POST', '/api/v1/players', token, { name: `CAP ${stamp} ${i}`, teamId: home.body.id })).body.id);
      awayP.push((await apiJson(request, 'POST', '/api/v1/players', token, { name: `CBP ${stamp} ${i}`, teamId: away.body.id })).body.id);
    }
    const tn = await apiJson(request, 'POST', '/api/v1/tournaments', token, {
      name: `Centre Cup ${stamp}`,
      season: '2026',
      defaultOvers: 1,
      defaultMaxWickets: 7,
      visibility: 'PUBLIC',
    });
    const group = await apiJson(request, 'POST', `/api/v1/tournaments/${tn.body.id}/groups`, token, { name: 'GROUP A' });
    await apiJson(request, 'POST', `/api/v1/tournaments/${tn.body.id}/groups/${group.body.id}/teams`, token, { teamId: home.body.id });
    await apiJson(request, 'POST', `/api/v1/tournaments/${tn.body.id}/groups/${group.body.id}/teams`, token, { teamId: away.body.id });
    const match = await apiJson(request, 'POST', '/api/v1/matches', token, {
      homeTeamId: home.body.id,
      awayTeamId: away.body.id,
      tournamentId: tn.body.id,
      overs: 1,
      maxWickets: 7,
    });
    await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/toss`, token, {
      tossWinnerTeamId: home.body.id,
      tossDecision: 'BAT',
    });
    const first = await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/innings`, token, {
      battingTeamId: home.body.id,
      bowlingTeamId: away.body.id,
    });
    for (let i = 0; i < 6; i++) {
      await apiJson(request, 'POST', `/api/v1/innings/${first.body.innings[0].id}/events`, token, {
        strikerId: homeP[0],
        nonStrikerId: homeP[1],
        bowlerId: awayP[0],
        batsmanRuns: 0,
        extraType: 'NONE',
        isWicket: false,
        idempotencyKey: `centre-1-${stamp}-${i}`,
      });
    }
    const secondStart = await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/innings`, token, {
      battingTeamId: away.body.id,
      bowlingTeamId: home.body.id,
    });
    const second = secondStart.body.innings.find((i: { inningsNumber: number }) => i.inningsNumber === 2);
    await apiJson(request, 'POST', `/api/v1/innings/${second.id}/events`, token, {
      strikerId: awayP[0],
      nonStrikerId: awayP[1],
      bowlerId: homeP[0],
      batsmanRuns: 1,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `centre-2-${stamp}`,
    });

    await browserLogin(page);
    await page.goto(`/matches/${match.body.id}/centre`);
    await expect(page.getByRole('tab', { name: /summary/i })).toBeVisible();
    for (const tab of ['Scorecard', 'Stats', 'Super Stars', 'Balls']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') }).click();
      await expect(page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') })).toHaveAttribute('aria-selected', 'true');
    }
    await page.getByRole('button', { name: /share/i }).first().click();
    await expect(page.getByText(/share|copy|whatsapp|link/i).first()).toBeVisible();

    await page.goto(`/tournaments/${tn.body.id}`);
    await expect(page.getByRole('heading', { name: `Centre Cup ${stamp}` }).first()).toBeVisible();
    await expect(page.getByText(`Centre Alpha ${stamp}`).first()).toBeVisible();
    for (const tab of ['Fixtures', 'Points', 'Scorecards', 'Statistics', 'Records', 'Players', 'Teams', 'MVP']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') }).click();
      await expect(page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') })).toHaveAttribute('aria-selected', 'true');
    }
    await page.getByRole('tab', { name: /^points$/i }).click();
    await expect(page.getByText(/2|pts|points/i).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(`Centre Alpha ${stamp}`).or(page.getByText(`Centre Beta ${stamp}`)).first()).toBeVisible();
  });
});
