import { expect, test } from '@playwright/test';
import { apiJson, apiLogin } from './helpers';

async function setupHattrickMatch(request: import('@playwright/test').APIRequestContext, token: string, stamp: number) {
  const home = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `E2E Htk Home ${stamp}` });
  const away = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `E2E Htk Away ${stamp}` });
  const batters: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const p = await apiJson(request, 'POST', '/api/v1/players', token, { name: `Htk Bat ${stamp} ${i}`, teamId: home.body.id });
    batters.push(p.body.id);
  }
  const bowlers: string[] = [];
  for (let i = 1; i <= 2; i++) {
    const p = await apiJson(request, 'POST', '/api/v1/players', token, { name: `Htk Bowl ${stamp} ${i}`, teamId: away.body.id });
    bowlers.push(p.body.id);
  }
  const tn = await apiJson(request, 'POST', '/api/v1/tournaments', token, { name: `E2E Htk Cup ${stamp}` });
  const version = await apiJson(request, 'POST', `/api/v1/tournaments/${tn.body.id}/rulesets`, token);
  await apiJson(request, 'PUT', `/api/v1/tournaments/${tn.body.id}/rulesets/${version.body.version}`, token, {
    rules: [
      {
        name: 'Hattrick Bonus',
        category: 'WICKET_RULE',
        scope: 'TOURNAMENT',
        condition: 'HATTRICK',
        conditionConfig: {},
        action: 'WICKET_BONUS',
        actionConfig: { runs: 5 },
        priority: 10,
        enabled: true,
        affects: { matchResult: true, tournamentPoints: true, nrr: false, playerStats: false, teamStats: false, displayOnly: false },
      },
    ],
  });
  await apiJson(request, 'POST', `/api/v1/tournaments/${tn.body.id}/rulesets/${version.body.version}/activate`, token, { enabled: true });

  const match = await apiJson(request, 'POST', '/api/v1/matches', token, {
    homeTeamId: home.body.id,
    awayTeamId: away.body.id,
    tournamentId: tn.body.id,
    format: 'T20',
    overs: 20,
    maxWickets: 10,
  });
  await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/toss`, token, { tossWinnerTeamId: home.body.id, tossDecision: 'BAT' });
  const started = await apiJson(request, 'POST', `/api/v1/matches/${match.body.id}/innings`, token, {
    battingTeamId: home.body.id,
    bowlingTeamId: away.body.id,
  });
  const inningsId = (started.body.innings ?? []).find((i: { inningsNumber: number }) => i.inningsNumber === 1)?.id
    ?? started.body.innings?.[0]?.id;
  return { matchId: match.body.id, inningsId, batters, bowlers };
}

async function events(request: import('@playwright/test').APIRequestContext, token: string, inningsId: string) {
  const res = await apiJson(request, 'GET', `/api/v1/innings/${inningsId}/events`, token);
  return res.body as Array<{ sequence: number; isWicket: boolean; totalRuns: number; commentary: string | null; isUndone: boolean }>;
}

test.describe('tournament hattrick rule', () => {
  test('same bowler taking 3 wickets in a row triggers the configured bonus as a real event', async ({ request }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const { inningsId, batters, bowlers } = await setupHattrickMatch(request, token, stamp);

    for (let i = 0; i < 3; i++) {
      const ev = await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, token, {
        strikerId: batters[i],
        nonStrikerId: batters[3],
        bowlerId: bowlers[0],
        batsmanRuns: 0,
        extraType: 'NONE',
        isWicket: true,
        dismissalType: 'BOWLED',
        dismissedPlayerId: batters[i],
        idempotencyKey: `e2e-htk-${stamp}-w${i}`,
      });
      expect(ev.status, JSON.stringify(ev.raw)).toBeLessThan(300);
    }

    const log = await events(request, token, inningsId);
    expect(log.filter((e) => e.isWicket)).toHaveLength(3);
    const bonus = log.find((e) => e.commentary?.includes('Hattrick Bonus'));
    expect(bonus, JSON.stringify(log)).toBeTruthy();
    expect(bonus!.totalRuns).toBe(5);
  });

  test('3 wickets by different bowlers does not trigger the hattrick bonus', async ({ request }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const { inningsId, batters, bowlers } = await setupHattrickMatch(request, token, stamp);

    const bowlerForBall = [bowlers[0], bowlers[1], bowlers[0]];
    for (let i = 0; i < 3; i++) {
      await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, token, {
        strikerId: batters[i],
        nonStrikerId: batters[3],
        bowlerId: bowlerForBall[i],
        batsmanRuns: 0,
        extraType: 'NONE',
        isWicket: true,
        dismissalType: 'BOWLED',
        dismissedPlayerId: batters[i],
        idempotencyKey: `e2e-htk-mix-${stamp}-w${i}`,
      });
    }

    const log = await events(request, token, inningsId);
    expect(log.filter((e) => e.isWicket)).toHaveLength(3);
    expect(log.find((e) => e.commentary?.includes('Hattrick Bonus'))).toBeUndefined();
  });

  test('undoing once after a hattrick removes the bonus AND the third wicket together; undoing again removes the second wicket', async ({ request }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const { matchId, inningsId, batters, bowlers } = await setupHattrickMatch(request, token, stamp);
    void matchId;

    for (let i = 0; i < 3; i++) {
      await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/events`, token, {
        strikerId: batters[i],
        nonStrikerId: batters[3],
        bowlerId: bowlers[0],
        batsmanRuns: 0,
        extraType: 'NONE',
        isWicket: true,
        dismissalType: 'BOWLED',
        dismissedPlayerId: batters[i],
        idempotencyKey: `e2e-htk-undo-${stamp}-w${i}`,
      });
    }

    const firstUndo = await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/undo`, token);
    expect(firstUndo.status).toBeLessThan(300);
    expect(firstUndo.body.snapshot.totalWickets).toBe(2);
    expect(firstUndo.body.snapshot.totalRuns).toBe(0);
    let log = await events(request, token, inningsId);
    expect(log.filter((e) => !e.isUndone)).toHaveLength(2);
    expect(log.filter((e) => !e.isUndone).every((e) => e.isWicket)).toBe(true);

    const secondUndo = await apiJson(request, 'POST', `/api/v1/innings/${inningsId}/undo`, token);
    expect(secondUndo.body.snapshot.totalWickets).toBe(1);
    log = await events(request, token, inningsId);
    expect(log.filter((e) => !e.isUndone)).toHaveLength(1);
  });
});
