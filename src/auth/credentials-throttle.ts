import { ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { normalizeIp, type ThrottlerOptions } from '@nestjs/throttler';

import { normalizeEmail } from '../users/user-normalizers.js';

// Layered limits for the routes that run argon2 on request data (login, sign-up). All of them apply
// to every such request, on top of the global per-IP default; none replaces another.
export const CREDENTIALS_THROTTLE_TTL_MS = 60_000;
/** Per client IP + email: slows guessing one account's password. Fixed on purpose. */
export const CREDENTIALS_IP_EMAIL_LIMIT = 5;

// There is deliberately no limit shared by all clients: one counter would let a few IPs lock every
// user out. Argon2 resource exhaustion is bounded in `PasswordHasher` (concurrency + queue) instead.

/**
 * The configurable limit (env `CREDENTIALS_IP_LIMIT`, default 20): per client IP, stops one client
 * from rotating emails.
 */
export interface CredentialsThrottleLimits {
  ipLimit: number;
}

export const CREDENTIALS_IP_EMAIL_THROTTLER = 'credentials-ip-email';
export const CREDENTIALS_IP_THROTTLER = 'credentials-ip';

export const IS_CREDENTIALS_ROUTE_KEY = 'isCredentialsRoute';
const UNKNOWN_IP = 'unknown';

/** Marks a route as a credentials route, so the credential throttlers apply to it. */
export const CredentialsThrottle = () =>
  SetMetadata(IS_CREDENTIALS_ROUTE_KEY, true);

interface ThrottledRequest {
  body?: unknown;
  ip?: unknown;
}

// Reflector only reads decorator metadata; it holds no state, so a module-level one is fine here
// (throttler options are plain config, outside DI).
const reflector = new Reflector();

function isNotCredentialsRoute(context: ExecutionContext): boolean {
  return !reflector.getAllAndOverride<boolean | undefined>(
    IS_CREDENTIALS_ROUTE_KEY,
    [context.getHandler(), context.getClass()],
  );
}

/** The client IP (real one when `TRUST_PROXY` matches the Next.js server); IPv6 per /64. */
export function trackByIp(req: ThrottledRequest): string {
  return typeof req.ip === 'string' && req.ip !== ''
    ? normalizeIp(req.ip)
    : UNKNOWN_IP;
}

/**
 * Client IP + the normalized email in the body (empty when there is none, so requests without an
 * email are still split per client). Guards run before the ValidationPipe, so the body is raw.
 */
export function trackByIpAndEmail(req: ThrottledRequest): string {
  const body = req.body;
  const email = normalizeEmail(
    typeof body === 'object' && body !== null && 'email' in body
      ? body.email
      : undefined,
  );
  return `${trackByIp(req)}|${typeof email === 'string' ? email : ''}`;
}

// The default key includes the route, which would give login and sign-up separate budgets; the
// credential limits are shared by both routes.
function credentialsKey(
  _context: ExecutionContext,
  tracker: string,
  throttlerName: string,
): string {
  return `${throttlerName}:${tracker}`;
}

const credentialsThrottler = (
  name: string,
  limit: number,
  getTracker: (req: ThrottledRequest) => string,
): ThrottlerOptions => ({
  name,
  limit,
  ttl: CREDENTIALS_THROTTLE_TTL_MS,
  getTracker,
  generateKey: credentialsKey,
  // Named throttlers apply to every route unless skipped: these only apply where marked.
  skipIf: isNotCredentialsRoute,
});

export function credentialsThrottlers({
  ipLimit,
}: CredentialsThrottleLimits): ThrottlerOptions[] {
  return [
    credentialsThrottler(
      CREDENTIALS_IP_EMAIL_THROTTLER,
      CREDENTIALS_IP_EMAIL_LIMIT,
      trackByIpAndEmail,
    ),
    credentialsThrottler(CREDENTIALS_IP_THROTTLER, ipLimit, trackByIp),
  ];
}
