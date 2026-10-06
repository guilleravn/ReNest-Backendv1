import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

const MIN_PORT = 1;
const MAX_PORT = 65535;
const DEFAULT_PORT = 3000;

export class EnvironmentVariables {
  @IsInt()
  @Min(MIN_PORT)
  @Max(MAX_PORT)
  PORT: number = DEFAULT_PORT;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;
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
