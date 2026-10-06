import 'reflect-metadata';

import { readFileSync } from 'node:fs';

import {
  ENV_EXAMPLE_JWT_SECRET,
  EnvironmentVariables,
  validateEnv,
} from './env.validation.js';

const DATABASE_URL = 'postgresql://user:pass@localhost:5432/db?schema=public';
const JWT_SECRET = 'unit-test-secret-at-least-32-characters-long';
const REQUIRED = { DATABASE_URL, JWT_SECRET };

describe('validateEnv', () => {
  it('returns typed variables when the environment is valid', () => {
    const env = validateEnv({ ...REQUIRED, PORT: '8080' });

    expect(env).toBeInstanceOf(EnvironmentVariables);
    expect(env).toEqual({
      PORT: 8080,
      DATABASE_URL,
      JWT_SECRET,
      JWT_EXPIRES_IN: '7d',
      THROTTLE_TTL_MS: 60000,
      THROTTLE_LIMIT: 1000,
      NODE_ENV: 'development',
      TRUST_PROXY: 'loopback',
      ARGON2_MAX_CONCURRENCY: 4,
      CREDENTIALS_IP_LIMIT: 20,
      CREDENTIALS_GLOBAL_LIMIT: 100,
    });
  });

  it('defaults PORT to 3000 when it is not set', () => {
    const env = validateEnv(REQUIRED);

    expect(env.PORT).toBe(3000);
  });

  it('passes unrelated variables through without failing', () => {
    const env = validateEnv({ ...REQUIRED, UNRELATED: 'x' });

    expect(env).toEqual({
      PORT: 3000,
      DATABASE_URL,
      JWT_SECRET,
      JWT_EXPIRES_IN: '7d',
      THROTTLE_TTL_MS: 60000,
      THROTTLE_LIMIT: 1000,
      NODE_ENV: 'development',
      TRUST_PROXY: 'loopback',
      ARGON2_MAX_CONCURRENCY: 4,
      CREDENTIALS_IP_LIMIT: 20,
      CREDENTIALS_GLOBAL_LIMIT: 100,
      UNRELATED: 'x',
    });
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validateEnv({ PORT: '3000', JWT_SECRET })).toThrow(
      /Invalid environment variables: .*DATABASE_URL/,
    );
  });

  it('throws when DATABASE_URL is empty', () => {
    expect(() => validateEnv({ DATABASE_URL: '', JWT_SECRET })).toThrow(
      /DATABASE_URL should not be empty/,
    );
  });

  it('throws when PORT is not a number', () => {
    expect(() => validateEnv({ ...REQUIRED, PORT: 'abc' })).toThrow(
      /PORT must be an integer number/,
    );
  });

  it('throws when PORT is out of range', () => {
    expect(() => validateEnv({ ...REQUIRED, PORT: '70000' })).toThrow(
      /PORT must not be greater than 65535/,
    );
    expect(() => validateEnv({ ...REQUIRED, PORT: '0' })).toThrow(
      /PORT must not be less than 1/,
    );
  });

  it('throws when PORT is not an integer', () => {
    expect(() => validateEnv({ ...REQUIRED, PORT: '3000.5' })).toThrow(
      /PORT must be an integer number/,
    );
  });

  it('throws when JWT_SECRET is missing', () => {
    expect(() => validateEnv({ DATABASE_URL })).toThrow(
      /Invalid environment variables: .*JWT_SECRET/,
    );
  });

  it('throws when JWT_SECRET is shorter than 32 characters', () => {
    expect(() =>
      validateEnv({ DATABASE_URL, JWT_SECRET: 'too-short-secret' }),
    ).toThrow(/JWT_SECRET must be longer than or equal to 32 characters/);
  });

  it('defaults JWT_EXPIRES_IN to 7d when it is not set', () => {
    expect(validateEnv(REQUIRED).JWT_EXPIRES_IN).toBe('7d');
  });

  it('accepts JWT_EXPIRES_IN as a number with a unit', () => {
    expect(
      validateEnv({ ...REQUIRED, JWT_EXPIRES_IN: '12h' }).JWT_EXPIRES_IN,
    ).toBe('12h');
  });

  it.each(['604800', '7 days', '7D', ''])(
    'throws when JWT_EXPIRES_IN is %j',
    (JWT_EXPIRES_IN) => {
      expect(() => validateEnv({ ...REQUIRED, JWT_EXPIRES_IN })).toThrow(
        /JWT_EXPIRES_IN must be a duration with a unit/,
      );
    },
  );

  it('defaults the credential limits to 20 per IP and 100 globally', () => {
    expect(validateEnv(REQUIRED)).toMatchObject({
      CREDENTIALS_IP_LIMIT: 20,
      CREDENTIALS_GLOBAL_LIMIT: 100,
    });
  });

  it('reads CREDENTIALS_IP_LIMIT and CREDENTIALS_GLOBAL_LIMIT as integers', () => {
    expect(
      validateEnv({
        ...REQUIRED,
        CREDENTIALS_IP_LIMIT: '1000',
        CREDENTIALS_GLOBAL_LIMIT: '1000',
      }),
    ).toMatchObject({
      CREDENTIALS_IP_LIMIT: 1000,
      CREDENTIALS_GLOBAL_LIMIT: 1000,
    });
  });

  it.each(['CREDENTIALS_IP_LIMIT', 'CREDENTIALS_GLOBAL_LIMIT'])(
    'throws when %s is below 1 or not an integer',
    (name) => {
      expect(() => validateEnv({ ...REQUIRED, [name]: '0' })).toThrow(
        new RegExp(`${name} must not be less than 1`),
      );
      expect(() => validateEnv({ ...REQUIRED, [name]: '2.5' })).toThrow(
        new RegExp(`${name} must be an integer number`),
      );
    },
  );

  it('defaults the global throttler to 1000 requests per 60000 ms', () => {
    expect(validateEnv(REQUIRED)).toMatchObject({
      THROTTLE_TTL_MS: 60000,
      THROTTLE_LIMIT: 1000,
    });
  });

  it('reads THROTTLE_TTL_MS and THROTTLE_LIMIT as integers', () => {
    expect(
      validateEnv({
        ...REQUIRED,
        THROTTLE_TTL_MS: '30000',
        THROTTLE_LIMIT: '50',
      }),
    ).toMatchObject({ THROTTLE_TTL_MS: 30000, THROTTLE_LIMIT: 50 });
  });

  it.each(['THROTTLE_TTL_MS', 'THROTTLE_LIMIT'])(
    'throws when %s is below 1 or not an integer',
    (name) => {
      expect(() => validateEnv({ ...REQUIRED, [name]: '0' })).toThrow(
        new RegExp(`${name} must not be less than 1`),
      );
      expect(() => validateEnv({ ...REQUIRED, [name]: 'abc' })).toThrow(
        new RegExp(`${name} must be an integer number`),
      );
    },
  );

  it('defaults NODE_ENV to development, TRUST_PROXY to loopback and ARGON2_MAX_CONCURRENCY to 4', () => {
    expect(validateEnv(REQUIRED)).toMatchObject({
      NODE_ENV: 'development',
      TRUST_PROXY: 'loopback',
      ARGON2_MAX_CONCURRENCY: 4,
      CREDENTIALS_IP_LIMIT: 20,
      CREDENTIALS_GLOBAL_LIMIT: 100,
    });
  });

  it('throws when NODE_ENV is not development, test or production', () => {
    expect(() => validateEnv({ ...REQUIRED, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV must be one of the following values/,
    );
  });

  it.each([
    '1',
    'loopback',
    'loopback, 10.0.0.0/8',
    '192.168.1.20',
    '::1',
    'fd00::/8',
  ])('accepts TRUST_PROXY %j', (TRUST_PROXY) => {
    expect(validateEnv({ ...REQUIRED, TRUST_PROXY }).TRUST_PROXY).toBe(
      TRUST_PROXY,
    );
  });

  it.each([
    'true',
    '*',
    'false',
    '',
    'anywhere',
    '10.0.0.0/33',
    '10.0.0.1/8/1',
    'loopback,',
  ])('throws when TRUST_PROXY is %j', (TRUST_PROXY) => {
    expect(() => validateEnv({ ...REQUIRED, TRUST_PROXY })).toThrow(
      /TRUST_PROXY must be a hop count or a comma-separated list/,
    );
  });

  it.each(['0', '65', '2.5', 'abc'])(
    'throws when ARGON2_MAX_CONCURRENCY is %j',
    (ARGON2_MAX_CONCURRENCY) => {
      expect(() =>
        validateEnv({ ...REQUIRED, ARGON2_MAX_CONCURRENCY }),
      ).toThrow(/ARGON2_MAX_CONCURRENCY/);
    },
  );

  it('throws when JWT_SECRET is the .env.example placeholder in production', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL,
        JWT_SECRET: ENV_EXAMPLE_JWT_SECRET,
        NODE_ENV: 'production',
      }),
    ).toThrow(
      /JWT_SECRET must not be the .env.example placeholder in production/,
    );
  });

  it.each(['development', 'test'])(
    'accepts the .env.example JWT_SECRET placeholder when NODE_ENV is %s',
    (NODE_ENV) => {
      expect(
        validateEnv({
          DATABASE_URL,
          JWT_SECRET: ENV_EXAMPLE_JWT_SECRET,
          NODE_ENV,
        }).JWT_SECRET,
      ).toBe(ENV_EXAMPLE_JWT_SECRET);
    },
  );

  it('keeps ENV_EXAMPLE_JWT_SECRET in sync with .env.example', () => {
    const envExample = readFileSync('.env.example', 'utf8');

    expect(envExample).toContain(`JWT_SECRET=${ENV_EXAMPLE_JWT_SECRET}
`);
  });
});
