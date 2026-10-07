import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

import { Semaphore } from '../common/concurrency/semaphore.js';
import { EnvironmentVariables } from '../config/env.validation.js';
import { ServerBusyException } from './exceptions/server-busy.exception.js';

/**
 * argon2id hashing behind a concurrency cap (`ARGON2_MAX_CONCURRENCY`). Each operation takes
 * ~64 MiB and a CPU core for tens of milliseconds, so without the cap a burst of logins or
 * sign-ups (even ones that fail) could exhaust the API's memory and CPU. Excess calls queue, up to
 * `ARGON2_MAX_QUEUE` waiting; beyond that they fail fast with `ServerBusyException` (503).
 */
@Injectable()
export class PasswordHasher {
  private readonly semaphore: Semaphore;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.semaphore = new Semaphore(
      config.get('ARGON2_MAX_CONCURRENCY', { infer: true }),
      config.get('ARGON2_MAX_QUEUE', { infer: true }),
      () => new ServerBusyException(),
    );
  }

  hash(password: string): Promise<string> {
    return this.semaphore.run(() =>
      argon2.hash(password, { type: argon2.argon2id }),
    );
  }

  verify(hash: string, password: string): Promise<boolean> {
    return this.semaphore.run(() => argon2.verify(hash, password));
  }
}
