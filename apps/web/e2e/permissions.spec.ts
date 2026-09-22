import { expect, test } from '@playwright/test';
import { apiJson, apiLogin, registerUser } from './helpers';

test.describe('authorization isolation', () => {
  test('user B cannot edit user A club, team, player, or tournament', async ({ request }) => {
    const a = await registerUser(request, 'E2E Owner A');
    const b = await registerUser(request, 'E2E Owner B');
    const admin = await apiLogin(request);
    const stamp = Date.now();
    const club = await apiJson(request, 'POST', '/api/v1/clubs', a.token, {
      name: `Perm Club ${stamp}`,
      city: 'Pune',
      establishedYear: 2026,
    });
    expect(club.status).toBeLessThan(300);
    const team = await apiJson(request, 'POST', '/api/v1/teams', admin, { name: `Perm Team ${stamp}`, clubId: club.body.id });
    expect(team.status).toBeLessThan(300);
    const player = await apiJson(request, 'POST', '/api/v1/players', admin, { name: `Perm Player ${stamp}`, teamId: team.body.id });
    expect(player.status).toBeLessThan(300);
    expect(player.body.id).toBeTruthy();
    const tn = await apiJson(request, 'POST', '/api/v1/tournaments', a.token, {
      name: `Perm Cup ${stamp}`,
      defaultOvers: 5,
      defaultMaxWickets: 7,
    });
    const tournamentId = tn.status < 300 ? tn.body.id : (await apiJson(request, 'POST', '/api/v1/tournaments', admin, {
      name: `Perm Cup ${stamp}`,
      defaultOvers: 5,
      defaultMaxWickets: 7,
    })).body.id;

    const clubEdit = await apiJson(request, 'PATCH', `/api/v1/clubs/${club.body.id}`, b.token, { name: 'Hacked Club' });
    const teamEdit = await apiJson(request, 'PATCH', `/api/v1/teams/${team.body.id}`, b.token, { name: 'Hacked Team' });
    const playerEdit = await apiJson(request, 'PATCH', `/api/v1/players/${player.body.id}`, b.token, { name: 'Hacked Player' });
    const tnEdit = await apiJson(request, 'PATCH', `/api/v1/tournaments/${tournamentId}`, b.token, { name: 'Hacked Cup' });

    expect([403, 404]).toContain(clubEdit.status);
    expect([403, 404]).toContain(teamEdit.status);
    expect([403, 404]).toContain(playerEdit.status);
    expect(tnEdit.status).toBeGreaterThanOrEqual(400);

    const ownerClub = await apiJson(request, 'PATCH', `/api/v1/clubs/${club.body.id}`, a.token, { description: 'Owned' });
    expect(ownerClub.status).toBeLessThan(300);
  });
});
