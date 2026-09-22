import { Role } from '@prisma/client';
import { looksLikePhone, parseLoginIdentifier } from '../auth/identifier';

export function canSensitivePlayerLookup(role: Role | string) {
  return role === Role.SUPER_ADMIN || role === Role.ADMIN || role === Role.SCORER || role === Role.TEAM_MANAGER;
}

export function lookupKind(query: string): 'email' | 'phone' | 'code' | 'name' {
  const q = query.trim();
  if (q.includes('@')) return 'email';
  if (looksLikePhone(q) && q.replace(/\D/g, '').length >= 10) return 'phone';
  if (/^CS\d{6}$/i.test(q)) return 'code';
  return 'name';
}

export function parseSensitiveLookup(query: string) {
  const kind = lookupKind(query);
  if (kind !== 'email' && kind !== 'phone') return null;
  try {
    return parseLoginIdentifier(query);
  } catch {
    return null;
  }
}

/** Exact stored-phone variants only — never substring / endsWith. */
export function exactPhoneCandidates(national: string): string[] {
  const digits = national.replace(/\D/g, '');
  if (digits.length !== 10) return [];
  return [digits, `+91${digits}`, `91${digits}`];
}

export function toLookupPlayer(player: {
  id: string;
  name: string;
  photoUrl: string | null;
  profileCode: string;
  battingStyle: string | null;
  bowlingStyle: string | null;
}) {
  return {
    playerId: player.id,
    displayName: player.name,
    profilePhoto: player.photoUrl,
    profileCode: player.profileCode,
    battingStyle: player.battingStyle,
    bowlingStyle: player.bowlingStyle,
  };
}
