import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

import { EnvironmentVariables } from '../config/env.validation.js';
import { ServerBusyException } from './exceptions/server-busy.exception.js';
import { PasswordHasher } from './password-hasher.service.js';

// Real argon2, with `hash` wrapped in a spy so concurrency can be observed.
vi.mock('argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('argon2')>();
  return { ...actual, hash: vi.fn(actual.hash) };
});

const configWith = (maxConcurrency: number, maxQueue = 32) =>
  ({
    get: (key: string) =>
      key === 'ARGON2_MAX_QUEUE' ? maxQueue : maxConcurrency,
  }) as unknown as ConfigService<EnvironmentVariables, true>;

describe('PasswordHasher', () => {
  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('argon2')>('argon2');
    vi.mocked(argon2.hash).mockReset().mockImplementation(actual.hash);
  });

  describe('hash', () => {
    it('returns an argon2id hash that verify accepts for the same password only', async () => {
      const hasher = new PasswordHasher(configWith(4));

      const hash = await hasher.hash('correct-horse-battery');

      expect(hash).toMatch(/^\$argon2id\$/);
      await expect(hasher.verify(hash, 'correct-horse-battery')).resolves.toBe(
        true,
      );
      await expect(hasher.verify(hash, 'wrong-password')).resolves.toBe(false);
    });

    it('runs at most ARGON2_MAX_CONCURRENCY operations at once', async () => {
      let active = 0;
      let maxActive = 0;
      vi.mocked(argon2.hash).mockImplementation(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((done) => setImmediate(done));
        active -= 1;
        return '$argon2id$fake';
      });
      const hasher = new PasswordHasher(configWith(2));

      await Promise.all(
        Array.from({ length: 6 }, (_, i) => hasher.hash(`password-${i}`)),
      );

      expect(argon2.hash).toHaveBeenCalledTimes(6);
      expect(maxActive).toBe(2);
    });

    it('frees its slot when argon2 throws, so later calls still run', async () => {
      const error = new Error('argon2 failed');
      vi.mocked(argon2.hash).mockRejectedValueOnce(error);
      const hasher = new PasswordHasher(configWith(1));

      await expect(hasher.hash('password-1')).rejects.toBe(error);
      await expect(hasher.hash('password-2')).resolves.toMatch(/^\$argon2id\$/);
    });
  });

  describe('when the queue is full', () => {
    it('rejects with a 503 ServerBusyException without running argon2, then recovers', async () => {
      let release!: () => void;
      const gate = new Promise<void>((done) => {
        release = done;
      });
      vi.mocked(argon2.hash).mockImplementation(async () => {
        await gate;
        return '$argon2id$fake';
      });
      const hasher = new PasswordHasher(configWith(1, 1));

      const running = hasher.hash('password-1');
      const queued = hasher.hash('password-2');
      await new Promise<void>((done) => setImmediate(done));

      const rejected = hasher.verify('hash', 'password-3');
      await expect(rejected).rejects.toBeInstanceOf(ServerBusyException);
      await expect(rejected).rejects.toMatchObject({
        status: 503,
        message: 'Server is busy, try again shortly',
      });
      expect(argon2.hash).toHaveBeenCalledTimes(1);

      release();
      await expect(Promise.all([running, queued])).resolves.toEqual([
        '$argon2id$fake',
        '$argon2id$fake',
      ]);
      expect(argon2.hash).toHaveBeenCalledTimes(2);

      // Permits and queue slots were released: a new call runs normally.
      await expect(hasher.hash('password-4')).resolves.toBe('$argon2id$fake');
    });
  });

  describe('verify', () => {
    it('frees its slot when the hash is malformed, so later calls still run', async () => {
      const hasher = new PasswordHasher(configWith(1));

      await expect(hasher.verify('not-a-hash', 'x')).rejects.toThrow();
      const hash = await hasher.hash('correct-horse-battery');
      await expect(hasher.verify(hash, 'correct-horse-battery')).resolves.toBe(
        true,
      );
    });
  });
});
