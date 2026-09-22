export type LoginIdentifier = { kind: 'email'; value: string } | { kind: 'phone'; value: string };

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (national.length !== 10) return null;
  return national;
}

export function parseLoginIdentifier(raw: string): LoginIdentifier {
  const value = raw.trim();
  if (!value) throw new Error('Enter your email or 10-digit mobile number.');
  if (value.includes('@')) {
    const email = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    return { kind: 'email', value: email };
  }
  const national = normalizePhone(value);
  if (!national) throw new Error('Enter a valid 10-digit mobile number.');
  return { kind: 'phone', value: national };
}

export function looksLikePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 0 && !raw.includes('@');
}

export function otpTokenHashInput(userId: string, code: string) {
  return `otp:${userId}:${code}`;
}
