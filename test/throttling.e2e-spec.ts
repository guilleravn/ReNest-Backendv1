// Throttling guarantees that need a non-default configuration, so this spec boots its own app:
// - a low global `default` limit, to prove it still applies on the credential routes (the credential
//   throttlers are added on top, never replace it);
// - TRUST_PROXY set to an address supertest never connects from, to prove X-Forwarded-For from an
//   untrusted source is ignored (a client cannot pick its own IP to dodge the per-IP limits).
// Env vars are set before AppModule is imported: ConfigModule validates them at import time.
import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getStorageToken, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types.js';

const GLOBAL_LIMIT = 8;
// Supertest connects from loopback; only this unrelated address may forward a client IP.
const ONLY_TRUSTED_PROXY = '192.0.2.10';
const EMAIL_DOMAIN = 'throttling-e2e.renest.test';

describe('Throttling (e2e)', () => {
  let app: INestApplication<App>;
  const saved = {
    THROTTLE_LIMIT: process.env['THROTTLE_LIMIT'],
    TRUST_PROXY: process.env['TRUST_PROXY'],
  };

  const uniqueEmail = (): string => `user-${randomUUID()}@${EMAIL_DOMAIN}`;

  const login = (email: string, forwardedFor?: string) => {
    const req = request(app.getHttpServer()).post('/auth/login');
    if (forwardedFor) {
      void req.set('X-Forwarded-For', forwardedFor);
    }
    // Empty password: rejected by validation (400) after the throttlers counted the request.
    return req.send({ email, password: '' });
  };

  beforeAll(async () => {
    process.env['THROTTLE_LIMIT'] = String(GLOBAL_LIMIT);
    process.env['TRUST_PROXY'] = ONLY_TRUSTED_PROXY;
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    app.get<ThrottlerStorageService>(getStorageToken()).onApplicationShutdown();
  });

  afterAll(async () => {
    await app.close();
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  describe('global default throttler', () => {
    it('still applies on POST /auth/login on top of the credential limits', async () => {
      // Different emails, below the per-IP credential limit (20): only `default` can trip.
      for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
        await login(uniqueEmail()).expect(400);
      }

      await login(uniqueEmail()).expect(429);
    });

    it('applies on other routes with its own per-route budget', async () => {
      for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
        await request(app.getHttpServer()).get('/zones').expect(200);
      }

      await request(app.getHttpServer()).get('/zones').expect(429);
      await login(uniqueEmail()).expect(400);
    });
  });

  describe('X-Forwarded-For from an untrusted source', () => {
    it('is ignored, so rotating it does not escape the per IP + email limit', async () => {
      const email = uniqueEmail();
      for (let i = 0; i < 5; i += 1) {
        await login(email, `203.0.113.${i}`).expect(400);
      }

      await login(email, '203.0.113.99').expect(429);
    });
  });
});
