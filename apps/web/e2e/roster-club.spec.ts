import { expect, test } from '@playwright/test';
import { apiJson, apiLogin, browserLogin, createLiveMatch, registerUser } from './helpers';

test.describe('roster and club', () => {
  test('removing a player keeps them on a completed scorecard', async ({ request, page }) => {
    const token = await apiLogin(request);
    const live = await createLiveMatch(request, token, { prefix: `Roster ${Date.now()}`, batters: 3, overs: 1 });
    for (let i = 0; i < 6; i++) {
      await apiJson(request, 'POST', `/api/v1/innings/${live.inningsId}/events`, token, {
        strikerId: live.homePlayers[0].id,
        nonStrikerId: live.homePlayers[1].id,
        bowlerId: live.awayPlayers[0].id,
        batsmanRuns: i === 0 ? 4 : 0,
        extraType: 'NONE',
        isWicket: false,
        idempotencyKey: `roster-ball-${live.stamp}-${i}`,
      });
    }
    const second = await apiJson(request, 'POST', `/api/v1/matches/${live.matchId}/innings`, token, {
      battingTeamId: live.away.id,
      bowlingTeamId: live.home.id,
    });
    const secondId = second.body.innings.find((i: { inningsNumber: number }) => i.inningsNumber === 2).id;
    await apiJson(request, 'POST', `/api/v1/innings/${secondId}/events`, token, {
      strikerId: live.awayPlayers[0].id,
      nonStrikerId: live.awayPlayers[1].id,
      bowlerId: live.homePlayers[0].id,
      batsmanRuns: 5,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `roster-chase-${live.stamp}`,
    });
    await page.addInitScript(() => {
      window.confirm = () => true;
    });
    await browserLogin(page);
    await page.goto(`/teams/${live.home.id}`);
    await expect(page.getByText(live.homePlayers[0].name)).toBeVisible();
    await page.locator('li', { hasText: live.homePlayers[0].name }).getByRole('button', { name: /remove/i }).click();
    await expect(page.locator('li', { hasText: live.homePlayers[0].name })).toHaveCount(0);
    const card = await apiJson(request, 'GET', `/api/v1/matches/${live.matchId}/scorecard`, token);
    expect(JSON.stringify(card.body)).toMatch(new RegExp(`${live.homePlayers[0].id}|${live.homePlayers[0].name}`));
    await page.goto(`/matches/${live.matchId}/centre`);
    await page.getByRole('tab', { name: /scorecard/i }).click();
    await expect(page.getByRole('tab', { name: /scorecard/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('club owner can edit and another user cannot', async ({ request, page }) => {
    const token = await apiLogin(request);
    const other = await registerUser(request, 'E2E Club Guest');
    const stamp = Date.now();
    const club = await apiJson(request, 'POST', '/api/v1/clubs', token, {
      name: `Club Test A ${stamp}`,
      city: 'Pune',
      establishedYear: 2026,
      description: 'E2E club',
    });
    const team = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `Club Team ${stamp}`, clubId: club.body.id });
    expect(team.status).toBeLessThan(300);
    await browserLogin(page);
    await page.goto(`/clubs/${club.body.id}`);
    await expect(page.getByRole('heading', { name: `Club Test A ${stamp}` }).first()).toBeVisible();
    await expect(page.getByText(`Club Team ${stamp}`)).toBeVisible();
    await page.getByRole('button', { name: /edit club/i }).click();
    await page.locator('form input').first().fill(`Club Test A Edited ${stamp}`);
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(`Club Test A Edited ${stamp}`).first()).toBeVisible();
    const denied = await apiJson(request, 'PATCH', `/api/v1/clubs/${club.body.id}`, other.token, { name: 'Hacked' });
    expect([403, 404]).toContain(denied.status);
  });
});
