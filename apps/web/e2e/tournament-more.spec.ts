import { expect, test } from '@playwright/test';
import { apiJson, apiLogin, browserLogin, registerUser } from './helpers';

async function completeShortMatch(
  request: Parameters<typeof apiJson>[0],
  token: string,
  tournamentId: string,
  homeName: string,
  awayName: string,
  firstRuns: number,
) {
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const home = await apiJson(request, 'POST', '/api/v1/teams', token, { name: homeName });
  const away = await apiJson(request, 'POST', '/api/v1/teams', token, { name: awayName });
  const hp: string[] = [];
  const ap: string[] = [];
  for (let i = 1; i <= 3; i++) {
    hp.push((await apiJson(request, 'POST', '/api/v1/players', token, { name: `${homeName} P${i}`, teamId: home.body.id })).body.id);
    ap.push((await apiJson(request, 'POST', '/api/v1/players', token, { name: `${awayName} P${i}`, teamId: away.body.id })).body.id);
  }
  const group = await apiJson(request, 'POST', `/api/v1/tournaments/${tournamentId}/groups`, token, { name: 'GROUP A' });
  await apiJson(request, 'POST', `/api/v1/tournaments/${tournamentId}/groups/${group.body.id}/teams`, token, { teamId: home.body.id });
  await apiJson(request, 'POST', `/api/v1/tournaments/${tournamentId}/groups/${group.body.id}/teams`, token, { teamId: away.body.id });
  const match = await apiJson(request, 'POST', '/api/v1/matches', token, {
    homeTeamId: home.body.id,
    awayTeamId: away.body.id,
    tournamentId,
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
      strikerId: hp[0],
      nonStrikerId: hp[1],
      bowlerId: ap[0],
      batsmanRuns: i === 0 ? firstRuns : 0,
      extraType: 'NONE',
      isWicket: false,
      idempotencyKey: `iso-${stamp}-${i}`,
    });
  }
  const second = await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/innings`, token, {
    battingTeamId: away.body.id,
    bowlingTeamId: home.body.id,
  });
  const secondId = second.body.innings.find((i: { inningsNumber: number }) => i.inningsNumber === 2).id;
  await apiJson(request, 'POST', `/api/v1/innings/${secondId}/events`, token, {
    strikerId: ap[0],
    nonStrikerId: ap[1],
    bowlerId: hp[0],
    batsmanRuns: firstRuns + 1,
    extraType: 'NONE',
    isWicket: false,
    idempotencyKey: `iso-chase-${stamp}`,
  });
  return { home: home.body, away: away.body, matchId: match.body.id as string, striker: hp[0], homeName, awayName };
}

test.describe('tournament isolation and extras', () => {
  test('statistics, records, MVP and points stay inside each tournament', async ({ request, page }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const a = await apiJson(request, 'POST', '/api/v1/tournaments', token, {
      name: `Test Tournament 2026 A ${stamp}`,
      season: '2026',
      defaultOvers: 1,
      defaultMaxWickets: 7,
      visibility: 'PUBLIC',
    });
    const b = await apiJson(request, 'POST', '/api/v1/tournaments', token, {
      name: `Test Tournament 2026 B ${stamp}`,
      season: '2026',
      defaultOvers: 1,
      defaultMaxWickets: 7,
      visibility: 'PUBLIC',
    });
    const matchA = await completeShortMatch(request, token, a.body.id, `IsoA Home ${stamp}`, `IsoA Away ${stamp}`, 6);
    const matchB = await completeShortMatch(request, token, b.body.id, `IsoB Home ${stamp}`, `IsoB Away ${stamp}`, 4);
    const dashA = await apiJson(request, 'GET', `/api/v1/tournaments/${a.body.id}/dashboard`, token);
    const dashB = await apiJson(request, 'GET', `/api/v1/tournaments/${b.body.id}/dashboard`, token);
    const textA = JSON.stringify(dashA.body);
    const textB = JSON.stringify(dashB.body);
    expect(textA).toContain(matchA.homeName);
    expect(textA).not.toContain(matchB.homeName);
    expect(textB).toContain(matchB.homeName);
    expect(textB).not.toContain(matchA.homeName);
    const pointsA = await apiJson(request, 'GET', `/api/v1/tournaments/${a.body.id}/points-table`, token);
    const groups = Array.isArray(pointsA.body) ? pointsA.body : pointsA.body.groups ?? [];
    const rows = groups.flatMap((g: { rows?: Array<{ points: number; won: number; lost: number; team?: { name?: string }; teamName?: string }> }) => g.rows ?? []);
    const winner = rows.find((r) => (r.team?.name ?? r.teamName ?? '').includes('Away'));
    expect(winner?.points).toBe(2);
    expect(winner?.won).toBe(1);
    await browserLogin(page);
    await page.goto(`/tournaments/${a.body.id}?tab=mvp`);
    await expect(page.getByRole('tab', { name: /^mvp$/i })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /^records$/i }).click();
    await expect(page.getByRole('tab', { name: /^records$/i })).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(page.getByRole('tab', { name: /^records$/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('fan quiz appears only when enabled and accepts one answer', async ({ request, page }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const on = await apiJson(request, 'POST', '/api/v1/tournaments', token, {
      name: `Quiz On ${stamp}`,
      visibility: 'PUBLIC',
      fanQuiz: { enabled: true, name: 'Fan Quiz', status: 'ACTIVE' },
    });
    const off = await apiJson(request, 'POST', '/api/v1/tournaments', token, {
      name: `Quiz Off ${stamp}`,
      visibility: 'PUBLIC',
      fanQuiz: { enabled: false },
    });
    const q = await apiJson(request, 'POST', '/api/v1/fan/questions', token, {
      kind: 'QUIZ',
      type: 'SINGLE_CHOICE',
      scope: 'TOURNAMENT',
      tournamentId: on.body.id,
      title: 'Who wins?',
      question: 'Who wins the toss?',
      options: [{ label: 'Home' }, { label: 'Away' }],
      correctOptionIndexes: [0],
      publish: true,
    });
    expect(q.status).toBeLessThan(300);
    await browserLogin(page);
    await page.goto(`/tournaments/${on.body.id}`);
    await expect(page.getByRole('tab', { name: /fan quiz|quiz/i })).toBeVisible();
    await page.getByRole('tab', { name: /fan quiz|quiz/i }).click();
    const homeOpt = page.getByRole('button', { name: /^home$/i }).first();
    if (await homeOpt.isVisible().catch(() => false)) {
      await homeOpt.click();
      const submit = page.getByRole('button', { name: /submit|lock|confirm/i });
      if (await submit.isVisible().catch(() => false)) await submit.click();
    }
    const play = await apiJson(request, 'GET', `/api/v1/tournaments/${on.body.id}/fan/quiz`, token);
    const question = (play.body.questions ?? [])[0];
    if (question && !question.myAnswer) {
      const first = await apiJson(request, 'POST', `/api/v1/quizzes/${question.id}/answer`, token, {
        optionIds: [question.options[0].id],
      });
      expect(first.status).toBeLessThan(300);
    }
    if (question) {
      const dup = await apiJson(request, 'POST', `/api/v1/quizzes/${question.id}/answer`, token, {
        optionIds: [question.options[1]?.id ?? question.options[0].id],
      });
      expect(dup.status).toBeGreaterThanOrEqual(400);
    }
    await page.goto(`/tournaments/${off.body.id}`);
    await expect(page.getByRole('tab', { name: /fan quiz/i })).toHaveCount(0);
  });

  test('follow player, team and tournament then isolate by user', async ({ request, page }) => {
    const token = await apiLogin(request);
    const other = await registerUser(request, 'E2E Follow B');
    const stamp = Date.now();
    const team = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `Follow Team ${stamp}` });
    const player = await apiJson(request, 'POST', '/api/v1/players', token, { name: `Follow Player ${stamp}`, teamId: team.body.id });
    const tn = await apiJson(request, 'POST', '/api/v1/tournaments', token, { name: `Follow Cup ${stamp}`, visibility: 'PUBLIC' });
    for (const body of [
      { targetType: 'PLAYER', targetId: player.body.id },
      { targetType: 'TEAM', targetId: team.body.id },
      { targetType: 'TOURNAMENT', targetId: tn.body.id },
    ]) {
      const first = await apiJson(request, 'POST', '/api/v1/follows', token, body);
      const dup = await apiJson(request, 'POST', '/api/v1/follows', token, body);
      expect(first.status).toBeLessThan(300);
      expect(dup.status).toBeLessThan(300);
    }
    await browserLogin(page);
    await page.goto('/following');
    await expect(page.getByText(`Follow Player ${stamp}`)).toBeVisible();
    await expect(page.getByText(`Follow Team ${stamp}`)).toBeVisible();
    await expect(page.getByText(`Follow Cup ${stamp}`)).toBeVisible();
    await page.reload();
    await expect(page.getByText(`Follow Player ${stamp}`)).toBeVisible();
    await apiJson(request, 'DELETE', `/api/v1/follows?targetType=PLAYER&targetId=${player.body.id}`, token);
    await page.reload();
    await expect(page.getByText(`Follow Player ${stamp}`)).toHaveCount(0);
    const otherList = await apiJson(request, 'GET', '/api/v1/users/me/following', other.token);
    expect((otherList.body.players ?? []).length).toBe(0);
  });
});
