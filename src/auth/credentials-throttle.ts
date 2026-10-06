import { ExecutionContext } from '@nestjs/common';

import { normalizeEmail } from '../users/user-normalizers.js';

export const CREDENTIALS_THROTTLE_LIMIT = 5;
export const CREDENTIALS_THROTTLE_TTL_MS = 60_000;

/**
 * Throttle key for login and sign-up: the normalized email in the body, or the client IP when
 * there is none. The browser never calls the API directly (every request comes from the Next.js
 * server's IP), so a per-IP limit here would lock every user out after a few attempts.
 * Guards run before the ValidationPipe, so the body is still raw and is normalized here.
 */
export function trackByEmailOrIp(
  req: { body?: unknown; ip?: unknown },
  _context: ExecutionContext,
): string {
  const body = req.body;
  const email = normalizeEmail(
    typeof body === 'object' && body !== null && 'email' in body
      ? body.email
      : undefined,
  );
  if (typeof email === 'string' && email !== '') {
    return `email:${email}`;
  }
  return `ip:${String(req.ip)}`;
}

/** `@Throttle(CREDENTIALS_THROTTLE)`: replaces the global per-IP default on that route. */
export const CREDENTIALS_THROTTLE = {
  default: {
    limit: CREDENTIALS_THROTTLE_LIMIT,
    ttl: CREDENTIALS_THROTTLE_TTL_MS,
    getTracker: trackByEmailOrIp,
  },
};
