import { expect, test } from '@playwright/test';
import { API, apiJson, apiLogin, registerUser } from './helpers';

test.describe('remaining product gaps', () => {
  test('knockout generator creates SF and Final relationships', async ({ request }) => {
    const token = await apiLogin(request);
    const stamp = Date.now();
    const teams = [];
    for (const name of ['Alpha XI', 'Raghus', 'Gamma', 'Delta']) {
      const team = await apiJson(request, 'POST', '/api/v1/teams', token, { name: `${name} ${stamp}` });
      expect(team.status).toBeLessThan(300);
      teams.push(team.body.id);
    }
    const tn = await apiJson(request, 'POST', '/api/v1/tournaments', token, {
      name: `RPL ${stamp}`,
      stageType: 'KNOCKOUT',
      defaultOvers: 5,
      defaultMaxWickets: 7,
    });
    expect(tn.status).toBeLessThan(300);
    const generated = await apiJson(request, 'POST', `/api/v1/tournaments/${tn.body.id}/knockout/generate`, token, {
      teamIds: teams,
      pairing: 'SEEDED',
    });
    expect(generated.status).toBeLessThan(300);
    const rounds = generated.body.rounds as Array<{ round: string; matches: unknown[] }>;
    expect(rounds.some((r) => r.round === 'SEMI_FINAL' && r.matches.length === 2)).toBeTruthy();
    expect(rounds.some((r) => r.round === 'FINAL' && r.matches.length === 1)).toBeTruthy();
  });

  test('player lookup hides PII and forbids viewers', async ({ request }) => {
    const admin = await apiLogin(request);
    const viewer = await registerUser(request, 'Viewer Lookup');
    const found = await apiJson(request, 'POST', '/api/v1/players/lookup', admin, { query: 'admin@crickscore.dev' });
    expect(found.status).toBeLessThan(300);
    expect(JSON.stringify(found.body)).not.toMatch(/password|otp|refresh/i);
    const denied = await request.post(`${API}/api/v1/players/lookup`, {
      headers: { Authorization: `Bearer ${viewer.token}`, 'Content-Type': 'application/json' },
      data: { query: 'admin@crickscore.dev' },
    });
    expect(denied.status()).toBe(403);
    const missing = await apiJson(request, 'POST', '/api/v1/players/lookup', admin, { query: 'nobody-e2e@example.com' });
    expect(missing.status).toBeLessThan(300);
    expect(missing.body).toEqual([]);
  });

  test('scorecard PDF is a real PDF', async ({ request }) => {
    const token = await apiLogin(request);
    const matches = await apiJson(request, 'GET', '/api/v1/matches', token);
    const match = (matches.body as Array<{ id: string; status: string }>).find((m) => m.status === 'COMPLETED') ?? (matches.body as Array<{ id: string }>)[0];
    test.skip(!match, 'no match available');
    const res = await request.get(`${API}/api/v1/matches/${match!.id}/scorecard.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBeLessThan(400);
    expect(res.headers()['content-type']).toContain('pdf');
    const body = await res.body();
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('structure lock returns MATCH_STRUCTURE_LOCKED after LIVE', async ({ request }) => {
    const token = await apiLogin(request);
    const { createLiveMatch } = await import('./helpers');
    const live = await createLiveMatch(request, token, { prefix: `Lock ${Date.now()}` });
    const patch = await apiJson(request, 'PATCH', `/api/v1/matches/${live.matchId}`, token, { ballsPerOver: 5 });
    expect(patch.status).toBe(409);
    expect(patch.raw?.error?.code ?? patch.body?.code).toBe('MATCH_STRUCTURE_LOCKED');
  });
});
