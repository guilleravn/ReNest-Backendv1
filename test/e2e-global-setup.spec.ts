import { readE2eDatabaseUrl } from './e2e-global-setup.js';

const DEV_URL =
  'postgresql://renest:renest@localhost:5432/renest?schema=public';
const E2E_URL =
  'postgresql://renest:renest@localhost:5432/renest_e2e?schema=public';

describe('readE2eDatabaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns E2E_DATABASE_URL when it differs from DATABASE_URL', () => {
    vi.stubEnv('DATABASE_URL', DEV_URL);
    vi.stubEnv('E2E_DATABASE_URL', E2E_URL);

    expect(readE2eDatabaseUrl()).toBe(E2E_URL);
  });

  it('throws when E2E_DATABASE_URL is not set', () => {
    vi.stubEnv('DATABASE_URL', DEV_URL);
    vi.stubEnv('E2E_DATABASE_URL', '');

    expect(() => readE2eDatabaseUrl()).toThrow(
      'E2E_DATABASE_URL must be set (see .env.example)',
    );
  });

  it('throws when E2E_DATABASE_URL points to the dev database', () => {
    vi.stubEnv('DATABASE_URL', DEV_URL);
    vi.stubEnv('E2E_DATABASE_URL', DEV_URL);

    expect(() => readE2eDatabaseUrl()).toThrow(
      'E2E_DATABASE_URL must not point to the dev database',
    );
  });
});
