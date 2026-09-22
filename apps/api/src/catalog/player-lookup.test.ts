import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { canSensitivePlayerLookup, exactPhoneCandidates, lookupKind, parseSensitiveLookup, toLookupPlayer } from './player-lookup';

describe('player lookup security', () => {
  it('allows owners and managers but not viewers or players', () => {
    expect(canSensitivePlayerLookup(Role.ADMIN)).toBe(true);
    expect(canSensitivePlayerLookup(Role.TEAM_MANAGER)).toBe(true);
    expect(canSensitivePlayerLookup(Role.SCORER)).toBe(true);
    expect(canSensitivePlayerLookup(Role.VIEWER)).toBe(false);
    expect(canSensitivePlayerLookup(Role.PLAYER)).toBe(false);
  });

  it('classifies exact email and phone lookups', () => {
    expect(lookupKind('scorer@crickscore.dev')).toBe('email');
    expect(lookupKind('9876543210')).toBe('phone');
    expect(lookupKind('CS100001')).toBe('code');
    expect(lookupKind('Sudhir')).toBe('name');
    expect(parseSensitiveLookup('Admin@crickscore.dev')).toEqual({ kind: 'email', value: 'admin@crickscore.dev' });
    expect(parseSensitiveLookup('+91 98765 43210')).toEqual({ kind: 'phone', value: '9876543210' });
    expect(exactPhoneCandidates('9876543210')).toEqual(['9876543210', '+919876543210', '919876543210']);
    expect(exactPhoneCandidates('123')).toEqual([]);
  });

  it('never includes email, phone, or password in the DTO', () => {
    const dto = toLookupPlayer({
      id: 'p1',
      name: 'Sudhir',
      photoUrl: null,
      profileCode: 'CS100001',
      battingStyle: 'RIGHT',
      bowlingStyle: 'RIGHT_ARM_MEDIUM',
    });
    expect(dto).toEqual({
      playerId: 'p1',
      displayName: 'Sudhir',
      profilePhoto: null,
      profileCode: 'CS100001',
      battingStyle: 'RIGHT',
      bowlingStyle: 'RIGHT_ARM_MEDIUM',
    });
    expect(JSON.stringify(dto)).not.toMatch(/email|phone|password|otp|token/i);
  });
});
