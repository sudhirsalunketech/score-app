import { describe, expect, it } from 'vitest';
import { toPublicPlayer } from './public-player';

describe('toPublicPlayer', () => {
  it('omits user linkage and keeps public identity fields', () => {
    const raw = {
      id: 'p1',
      name: 'Ravi',
      photoUrl: null,
      role: 'BATTER',
      profileCode: 'CS100001',
      battingStyle: 'RHB',
      bowlingStyle: null,
      userId: 'secret-user',
      profile: { jerseyNo: 7 },
      teams: [{ jerseyNo: 7, team: { id: 't1', name: 'Alpha XI', shortName: 'ALP', logoUrl: null, createdById: 'owner' } }],
    };
    const dto = toPublicPlayer(raw);
    expect(dto).toEqual({
      id: 'p1',
      name: 'Ravi',
      photoUrl: null,
      role: 'BATTER',
      profileCode: 'CS100001',
      battingStyle: 'RHB',
      bowlingStyle: null,
      city: null,
      profile: { jerseyNo: 7 },
      teams: [{ jerseyNo: 7, current: true, team: { id: 't1', name: 'Alpha XI', shortName: 'ALP', logoUrl: null } }],
      formerTeams: [],
      careerStats: null,
    });
    expect(JSON.stringify(dto)).not.toContain('secret-user');
    expect(JSON.stringify(dto)).not.toContain('createdById');
  });

  it('omits departed team memberships from the public roster', () => {
    const dto = toPublicPlayer({
      id: 'p1',
      name: 'Ravi',
      photoUrl: null,
      role: 'BATTER',
      profileCode: 'CS100001',
      battingStyle: null,
      bowlingStyle: null,
      teams: [
        { jerseyNo: 7, leftAt: null, team: { id: 't1', name: 'Alpha XI', shortName: 'ALP', logoUrl: null } },
        { jerseyNo: 8, leftAt: new Date().toISOString(), team: { id: 't2', name: 'Old XI', shortName: 'OLD', logoUrl: null } },
      ],
    });
    expect(dto.teams.map((row) => row.team.id)).toEqual(['t1']);
    expect(dto.formerTeams.map((row) => row.team.id)).toEqual(['t2']);
  });
});
