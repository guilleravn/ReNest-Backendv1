import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
  ValidateBy,
} from 'class-validator';

import { parseTrustProxy } from './trust-proxy.js';

const MIN_PORT = 1;
const MAX_PORT = 65535;
const DEFAULT_PORT = 3000;
// HS256 signing key; rejects short, guessable secrets (generate one with `openssl rand -hex 32`).
const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_JWT_EXPIRES_IN = '7d';
// A number with an explicit unit (`7d`, `12h`, `30m`). The unit is required: jsonwebtoken reads a
// bare numeric string as milliseconds, so `604800` would silently mean ~10 minutes. Validated here
// because a bad value would otherwise only fail when the first token is signed.
const JWT_EXPIRES_IN_PATTERN = /^\d+(ms|s|m|h|d|w|y)$/;
const MIN_THROTTLE_VALUE = 1;
const DEFAULT_THROTTLE_TTL_MS = 60_000;
const DEFAULT_THROTTLE_LIMIT = 1000;
const DEFAULT_CREDENTIALS_IP_LIMIT = 20;
const DEFAULT_CREDENTIALS_GLOBAL_LIMIT = 100;
const DEFAULT_TRUST_PROXY = 'loopback';
const MIN_ARGON2_CONCURRENCY = 1;
const MAX_ARGON2_CONCURRENCY = 64;
const DEFAULT_ARGON2_CONCURRENCY = 4;

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

/** The placeholder shipped in `.env.example`: public, so it must never sign production tokens. */
export const ENV_EXAMPLE_JWT_SECRET =
  'local-dev-only-jwt-secret-change-me-0123456789';

export class EnvironmentVariables {
  @IsIn(NODE_ENVS)
  NODE_ENV: NodeEnv = 'development';

  @IsInt()
  @Min(MIN_PORT)
  @Max(MAX_PORT)
  PORT: number = DEFAULT_PORT;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @MinLength(MIN_JWT_SECRET_LENGTH)
  JWT_SECRET: string;

  @IsString()
  @Matches(JWT_EXPIRES_IN_PATTERN, {
    message:
      'JWT_EXPIRES_IN must be a duration with a unit, like 7d, 12h or 30m',
  })
  JWT_EXPIRES_IN: string = DEFAULT_JWT_EXPIRES_IN;

  // Global per-client-IP throttler window and limit for every route. A coarse safety net: the
  // meaningful limits are the credential throttlers on login/sign-up (auth/credentials-throttle.ts).
  @IsInt()
  @Min(MIN_THROTTLE_VALUE)
  THROTTLE_TTL_MS: number = DEFAULT_THROTTLE_TTL_MS;

  @IsInt()
  @Min(MIN_THROTTLE_VALUE)
  THROTTLE_LIMIT: number = DEFAULT_THROTTLE_LIMIT;

  // Login/sign-up limits per 60 s (auth/credentials-throttle.ts): per client IP, and across all
  // clients. Keep the defaults in production; only the local Docker stack raises them, because the
  // frontend's e2e suite sends every request from one client IP. (Per IP + email stays fixed at 5.)
  @IsInt()
  @Min(MIN_THROTTLE_VALUE)
  CREDENTIALS_IP_LIMIT: number = DEFAULT_CREDENTIALS_IP_LIMIT;

  @IsInt()
  @Min(MIN_THROTTLE_VALUE)
  CREDENTIALS_GLOBAL_LIMIT: number = DEFAULT_CREDENTIALS_GLOBAL_LIMIT;

  // Which proxies may set the client IP through X-Forwarded-For (Express `trust proxy`). Default:
  // only loopback, i.e. a Next.js server on the same host. See config/trust-proxy.ts.
  @ValidateBy({
    name: 'isTrustProxy',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && parseTrustProxy(value) !== null,
      defaultMessage: () =>
        'TRUST_PROXY must be a hop count or a comma-separated list of loopback/linklocal/uniquelocal, IPs or CIDRs (never "true")',
    },
  })
  TRUST_PROXY: string = DEFAULT_TRUST_PROXY;

  // Max argon2 hash/verify operations running at once; the rest wait in a queue. Each one uses
  // ~64 MiB and a CPU core, so this bounds what a burst of logins/sign-ups can consume.
  @IsInt()
  @Min(MIN_ARGON2_CONCURRENCY)
  @Max(MAX_ARGON2_CONCURRENCY)
  ARGON2_MAX_CONCURRENCY: number = DEFAULT_ARGON2_CONCURRENCY;
}

/**
 * Validates the environment at startup so a missing or malformed variable fails fast instead of
 * surfacing later as a runtime error. Used by `ConfigModule.forRoot({ validate })`.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment variables: ${details}`);
  }
  if (
    env.NODE_ENV === 'production' &&
    env.JWT_SECRET === ENV_EXAMPLE_JWT_SECRET
  ) {
    throw new Error(
      'Invalid environment variables: JWT_SECRET must not be the .env.example placeholder in production',
    );
  }

  return env;
}
