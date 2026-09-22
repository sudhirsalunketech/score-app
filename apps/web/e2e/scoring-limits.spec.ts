import { expect, test } from '@playwright/test';
import { apiJson, apiLogin, browserLogin } from './helpers';

test.describe('scoring limits', () => {
  test('5-over limit blocks the 31st legal ball from UI and API', async ({ request, page }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const club = await apiJson(request, 'POST', '/api/v1/clubs', token, {
      name: `E2E Club ${stamp}`,
      city: 'Pune',
      establishedYear: 2026,
    });
    const home = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `E2E Alpha ${stamp}`, clubId: club.body.id });
    const away = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `E2E Beta ${stamp}`, clubId: club.body.id });
    const players: string[] = [];
    for (const team of [home.body, away.body]) {
      for (let i = 1; i <= 8; i++) {
        const p = await apiJson(request, 'POST', '/api/v1/players', token, { name: `${team.name} P${i}`, teamId: team.id });
        players.push(p.body.id);
      }
    }
    const tn = await apiJson(request, 'POST', '/api/v1/tournaments', token, {
      name: `E2E Cup ${stamp}`,
      defaultOvers: 5,
      defaultMaxWickets: 7,
      visibility: 'PUBLIC',
    });
    const match = await apiJson(request, 'POST', '/api/v1/matches', token, {
      homeTeamId: home.body.id,
      awayTeamId: away.body.id,
      tournamentId: tn.body.id,
      format: 'T10',
      overs: 5,
      maxWickets: 7,
    });
    await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/toss`, token, {
      tossWinnerTeamId: home.body.id,
      tossDecision: 'BAT',
    });
    const started = await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/innings`, token, {
      battingTeamId: home.body.id,
      bowlingTeamId: away.body.id,
    });
    const inningsId = (started.body.innings ?? []).find((i: { inningsNumber: number }) => i.inningsNumber === 1)?.id
      ?? started.body.innings?.[0]?.id;
    expect(inningsId).toBeTruthy();
    const striker = players[0];
    const non = players[1];
    const bowler = players[8];
    for (let i = 0; i < 30; i++) {
      const ev = await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, token, {
        strikerId: striker,
        nonStrikerId: non,
        bowlerId: bowler,
        batsmanRuns: 0,
        extraRuns: 0,
        extraType: 'NONE',
        isWicket: false,
        idempotencyKey: `e2e-${stamp}-${i}`,
      });
      expect(ev.status, JSON.stringify(ev.raw)).toBeLessThan(300);
    }
    const blocked = await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, token, {
      strikerId: striker,
      nonStrikerId: non,
      bowlerId: bowler,
      batsmanRuns: 1,
      extraRuns: 0,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `e2e-${stamp}-over`,
    });
    expect(blocked.status).toBe(409);
    expect(JSON.stringify(blocked.raw)).toMatch(/limited to 5 overs|innings is already complete/);

    await browserLogin(page);
    await page.goto(`/matches/${match.body.id}/score`);
    await expect(page.getByText('This match is limited to 5 overs. No additional overs can be added.')).toBeVisible();
    await expect(page.getByRole('button', { name: /start 2nd innings/i })).toBeVisible();
  });

  test('7th wicket ends the innings and the 8th is rejected', async ({ request }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const home = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `E2E WHome ${stamp}` });
    const away = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `E2E WAway ${stamp}` });
    const batters: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const p = await apiJson(request, 'POST', '/api/v1/players', token, { name: `WH ${stamp} ${i}`, teamId: home.body.id });
      batters.push(p.body.id);
    }
    const bowler = (await apiJson(request, 'POST', '/api/v1/players', token, { name: `WB ${stamp}`, teamId: away.body.id })).body.id;
    const match = await apiJson(request, 'POST', '/api/v1/matches', token, {
      homeTeamId: home.body.id,
      awayTeamId: away.body.id,
      overs: 5,
      maxWickets: 7,
    });
    await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/toss`, token, {
      tossWinnerTeamId: home.body.id,
      tossDecision: 'BAT',
    });
    const started = await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/innings`, token, {
      battingTeamId: home.body.id,
      bowlingTeamId: away.body.id,
    });
    const inningsId = started.body.innings[0].id;
    for (let i = 0; i < 7; i++) {
      const ev = await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, token, {
        strikerId: batters[i],
        nonStrikerId: batters[i + 1] ?? batters[0],
        bowlerId: bowler,
        batsmanRuns: 0,
        extraType: 'NONE',
        isWicket: true,
        dismissalType: 'BOWLED',
        dismissedPlayerId: batters[i],
        idempotencyKey: `wkt-${stamp}-${i}`,
      });
      expect(ev.status, JSON.stringify(ev.raw)).toBeLessThan(300);
    }
    const eighth = await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, token, {
      strikerId: batters[7],
      nonStrikerId: batters[0],
      bowlerId: bowler,
      batsmanRuns: 0,
      extraType: 'NONE',
      isWicket: true,
      dismissalType: 'BOWLED',
      dismissedPlayerId: batters[7],
      idempotencyKey: `wkt-${stamp}-8`,
    });
    expect(eighth.status).toBe(409);
    expect(JSON.stringify(eighth.raw)).toMatch(/maximum number of wickets|innings is already complete/);
  });

  test('second innings, same-team rejection, chase completion, and keypad 5', async ({ request, page }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const home = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `E2E ChaseH ${stamp}` });
    const away = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `E2E ChaseA ${stamp}` });
    const homePlayers: string[] = [];
    const awayPlayers: string[] = [];
    for (let i = 1; i <= 3; i++) {
      homePlayers.push((await apiJson(request, 'POST', '/api/v1/players', token, { name: `CH ${stamp} ${i}`, teamId: home.body.id })).body.id);
      awayPlayers.push((await apiJson(request, 'POST', '/api/v1/players', token, { name: `CA ${stamp} ${i}`, teamId: away.body.id })).body.id);
    }
    const match = await apiJson(request, 'POST', '/api/v1/matches', token, {
      homeTeamId: home.body.id,
      awayTeamId: away.body.id,
      overs: 1,
      maxWickets: 7,
    });
    await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/toss`, token, {
      tossWinnerTeamId: home.body.id,
      tossDecision: 'BAT',
    });
    const started = await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/innings`, token, {
      battingTeamId: home.body.id,
      bowlingTeamId: away.body.id,
    });
    const firstId = started.body.innings[0].id;
    for (let i = 0; i < 6; i++) {
      const ev = await apiJson(request, 'POST', `/api/v1/innings/${firstId}/events`, token, {
        strikerId: homePlayers[0],
        nonStrikerId: homePlayers[1],
        bowlerId: awayPlayers[0],
        batsmanRuns: 0,
        extraType: 'NONE',
        isWicket: false,
        idempotencyKey: `chase-dot-${stamp}-${i}`,
      });
      expect(ev.status, JSON.stringify(ev.raw)).toBeLessThan(300);
    }
    const sameTeam = await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/innings`, token, {
      battingTeamId: home.body.id,
      bowlingTeamId: away.body.id,
    });
    expect(sameTeam.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(sameTeam.raw)).toMatch(/other team must bat/i);

    await browserLogin(page);
    await page.goto(`/matches/${match.body.id}/score`);
    await page.getByRole('button', { name: /start 2nd innings/i }).click();
    await expect(page.getByRole('button', { name: /start scoring/i })).toBeVisible();
    await expect(page.getByText(away.body.name, { exact: false }).first()).toBeVisible();

    const live = await apiJson(request, 'GET', `/api/v1/matches/${match.body.id}/live`, token);
    const second = (live.body.match?.innings ?? []).find((i: { inningsNumber: number }) => i.inningsNumber === 2);
    expect(second?.id).toBeTruthy();
    const chase = await apiJson(request, 'POST', `/api/v1/innings/${second.id}/events`, token, {
      strikerId: awayPlayers[0],
      nonStrikerId: awayPlayers[1],
      bowlerId: homePlayers[0],
      batsmanRuns: 1,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `chase-win-${stamp}`,
    });
    expect(chase.status, JSON.stringify(chase.raw)).toBeLessThan(300);
    const after = await apiJson(request, 'POST', `/api/v1/innings/${second.id}/events`, token, {
      strikerId: awayPlayers[0],
      nonStrikerId: awayPlayers[1],
      bowlerId: homePlayers[0],
      batsmanRuns: 1,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `chase-extra-${stamp}`,
    });
    expect(after.status).toBe(409);
    expect(JSON.stringify(after.raw)).toMatch(/match is already complete|target/i);
    await page.reload();
    await expect(page.getByText(/this match is already complete/i)).toBeVisible();
  });

  test('keypad 5 scores five runs from the browser', async ({ request, page }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const home = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `E2E KeyH ${stamp}` });
    const away = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `E2E KeyA ${stamp}` });
    for (let i = 1; i <= 3; i++) {
      await apiJson(request, 'POST', '/api/v1/players', token, { name: `KH ${stamp} ${i}`, teamId: home.body.id });
      await apiJson(request, 'POST', '/api/v1/players', token, { name: `KA ${stamp} ${i}`, teamId: away.body.id });
    }
    const match = await apiJson(request, 'POST', '/api/v1/matches', token, {
      homeTeamId: home.body.id,
      awayTeamId: away.body.id,
      overs: 5,
      maxWickets: 7,
    });
    await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/toss`, token, {
      tossWinnerTeamId: home.body.id,
      tossDecision: 'BAT',
    });
    await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/innings`, token, {
      battingTeamId: home.body.id,
      bowlingTeamId: away.body.id,
    });
    await browserLogin(page);
    await page.goto(`/matches/${match.body.id}/score`);
    await page.getByRole('button', { name: /start scoring/i }).click();
    await page.getByRole('button', { name: /4\s*5\s*6\s*7/ }).click();
    await page.getByRole('button', { name: '5', exact: true }).click();
    await expect(page.getByText('5-0')).toBeVisible({ timeout: 10_000 });
    const live = await apiJson(request, 'GET', `/api/v1/matches/${match.body.id}/live`, token);
    expect(live.body.snapshot?.totalRuns).toBe(5);
  });
});
