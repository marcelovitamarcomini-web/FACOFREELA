import type { MiddlewareHandler } from 'hono';

import { serverEnv } from './env.js';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  bucket: string;
  max: number;
  windowMs: number;
};

const rateLimitStore = new Map<string, RateLimitBucket>();

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function normalizeOrigin(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildRateLimitKey(bucket: string, suffix: string) {
  return `${bucket}:${suffix}`;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const candidate = forwardedFor.split(',')[0]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return 'unknown';
}

export function isAllowedOrigin(origin?: string | null): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return true;
  }

  return serverEnv.allowedOrigins.includes(normalizedOrigin);
}

export function applyApiSecurityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    const isMutation =
      c.req.method === 'POST' ||
      c.req.method === 'PUT' ||
      c.req.method === 'PATCH' ||
      c.req.method === 'DELETE';
    const origin = c.req.header('origin');

    if (isMutation && origin && !isAllowedOrigin(origin)) {
      return c.json({ message: 'Origem nao autorizada.' }, 403);
    }

    await next();

    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header('Cross-Origin-Resource-Policy', 'same-site');
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  };
}

export function createContentLengthGuard(maxBytes: number): MiddlewareHandler {
  return async (c, next) => {
    const contentLengthHeader = c.req.header('content-length');
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : Number.NaN;

    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return c.json({ message: 'Requisicao maior do que o permitido.' }, 413);
    }

    await next();
  };
}

export function consumeRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const existing = rateLimitStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const nextBucket = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    rateLimitStore.set(key, nextBucket);

    return {
      allowed: true,
      remaining: Math.max(0, options.max - nextBucket.count),
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);

  return {
    allowed: existing.count <= options.max,
    remaining: Math.max(0, options.max - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function enforceRateLimit(
  request: Request,
  options: RateLimitOptions,
  keySuffix?: string,
) {
  const suffix = keySuffix?.trim() || getClientIp(request);
  return consumeRateLimit(buildRateLimitKey(options.bucket, suffix), options);
}

export function createRateLimitMiddleware(
  options: RateLimitOptions & {
    message: string;
  },
): MiddlewareHandler {
  return async (c, next) => {
    const result = enforceRateLimit(c.req.raw, options);
    c.header('Retry-After', String(result.retryAfterSeconds));
    c.header('X-RateLimit-Limit', String(options.max));
    c.header('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      return c.json({ message: options.message }, 429);
    }

    await next();
  };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
