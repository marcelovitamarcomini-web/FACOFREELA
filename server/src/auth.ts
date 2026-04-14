import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

import { serverEnv } from './env.js';

const PASSWORD_KEY_LENGTH = 64;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_SECRET =
  serverEnv.appSessionPepper ??
  serverEnv.appSecretsEncryptionKey ??
  serverEnv.supabaseServiceRoleKey ??
  serverEnv.supabasePublishableKey ??
  'facofreela-development-session-secret';
const SESSION_ENCRYPTION_KEY = createHash('sha256')
  .update(
    serverEnv.appSecretsEncryptionKey ??
      serverEnv.appSessionPepper ??
      serverEnv.supabaseServiceRoleKey ??
      serverEnv.supabasePublishableKey ??
      'facofreela-development-encryption-secret',
  )
  .digest();

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

export function hashSessionToken(token: string): string {
  return createHmac('sha256', SESSION_TOKEN_SECRET).update(token).digest('hex');
}

export function encryptSessionSecret(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', SESSION_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSessionSecret(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  if (!value.startsWith('enc:v1:')) {
    return value;
  }

  const [, , ivEncoded, authTagEncoded, payloadEncoded] = value.split(':');
  if (!ivEncoded || !authTagEncoded || !payloadEncoded) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      SESSION_ENCRYPTION_KEY,
      Buffer.from(ivEncoded, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64url'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadEncoded, 'base64url')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function createSessionExpiry(): string {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

export function isSessionExpired(expiresAt: string): boolean {
  const expiry = Date.parse(expiresAt);

  return !Number.isFinite(expiry) || expiry <= Date.now();
}
