import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PASSWORD_KEY_LENGTH = 64;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

export function createPasswordHash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');

  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');

  if (!salt || !hash || hash.length % 2 !== 0) {
    return false;
  }

  try {
    const derivedHash = scryptSync(password, salt, hash.length / 2);

    return timingSafeEqual(Buffer.from(hash, 'hex'), derivedHash);
  } catch {
    return false;
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function createSessionExpiry(): string {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

export function isSessionExpired(expiresAt: string): boolean {
  const expiry = Date.parse(expiresAt);

  return !Number.isFinite(expiry) || expiry <= Date.now();
}
