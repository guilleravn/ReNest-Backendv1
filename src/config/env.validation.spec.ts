import 'reflect-metadata';

import { EnvironmentVariables, validateEnv } from './env.validation.js';

const DATABASE_URL = 'postgresql://user:pass@localhost:5432/db?schema=public';

describe('validateEnv', () => {
  it('returns typed variables when the environment is valid', () => {
    const env = validateEnv({ PORT: '8080', DATABASE_URL });

    expect(env).toBeInstanceOf(EnvironmentVariables);
    expect(env).toEqual({ PORT: 8080, DATABASE_URL });
  });

  it('defaults PORT to 3000 when it is not set', () => {
    const env = validateEnv({ DATABASE_URL });

    expect(env.PORT).toBe(3000);
  });

  it('passes unrelated variables through without failing', () => {
    const env = validateEnv({ DATABASE_URL, UNRELATED: 'x' });

    expect(env).toEqual({ PORT: 3000, DATABASE_URL, UNRELATED: 'x' });
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validateEnv({ PORT: '3000' })).toThrow(
      /Invalid environment variables: .*DATABASE_URL/,
    );
  });

  it('throws when DATABASE_URL is empty', () => {
    expect(() => validateEnv({ DATABASE_URL: '' })).toThrow(
      /DATABASE_URL should not be empty/,
    );
  });

  it('throws when PORT is not a number', () => {
    expect(() => validateEnv({ PORT: 'abc', DATABASE_URL })).toThrow(
      /PORT must be an integer number/,
    );
  });

  it('throws when PORT is out of range', () => {
    expect(() => validateEnv({ PORT: '70000', DATABASE_URL })).toThrow(
      /PORT must not be greater than 65535/,
    );
    expect(() => validateEnv({ PORT: '0', DATABASE_URL })).toThrow(
      /PORT must not be less than 1/,
    );
  });

  it('throws when PORT is not an integer', () => {
    expect(() => validateEnv({ PORT: '3000.5', DATABASE_URL })).toThrow(
      /PORT must be an integer number/,
    );
  });
});
