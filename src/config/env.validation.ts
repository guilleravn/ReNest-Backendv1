import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

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

export class EnvironmentVariables {
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

  // Global per-IP throttler window and limit. All traffic arrives from the Next.js server's IP, so
  // this is a coarse safety net for all users combined, not per-user protection.
  @IsInt()
  @Min(MIN_THROTTLE_VALUE)
  THROTTLE_TTL_MS: number = DEFAULT_THROTTLE_TTL_MS;

  @IsInt()
  @Min(MIN_THROTTLE_VALUE)
  THROTTLE_LIMIT: number = DEFAULT_THROTTLE_LIMIT;
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

  return env;
}
