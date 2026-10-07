import { ExecutionContext } from '@nestjs/common';

import {
  CREDENTIALS_IP_EMAIL_LIMIT,
  CREDENTIALS_THROTTLE_TTL_MS,
  credentialsThrottlers,
  CredentialsThrottle,
  trackByIp,
  trackByIpAndEmail,
} from './credentials-throttle.js';

const IP = '10.0.0.7';

const contextFor = (handler: () => void): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => class {},
  }) as unknown as ExecutionContext;

describe('trackByIp', () => {
  it('returns the client IP', () => {
    expect(trackByIp({ ip: IP })).toBe(IP);
  });

  it('groups IPv6 clients by /64', () => {
    expect(trackByIp({ ip: '2001:db8:1:2:aaaa::1' })).toBe(
      trackByIp({ ip: '2001:db8:1:2:bbbb::2' }),
    );
  });

  it('returns "unknown" when the request has no IP', () => {
    expect(trackByIp({})).toBe('unknown');
  });
});

describe('trackByIpAndEmail', () => {
  it('combines the client IP with the normalized email', () => {
    expect(
      trackByIpAndEmail({ body: { email: '  Camila@ReNest.TEST ' }, ip: IP }),
    ).toBe(`${IP}|camila@renest.test`);
  });

  it('returns the same key for case and whitespace variants of an email', () => {
    const keys = ['ana@x.test', 'ANA@X.TEST', ' ana@x.test\t'].map((email) =>
      trackByIpAndEmail({ body: { email }, ip: IP }),
    );

    expect(new Set(keys)).toEqual(new Set([`${IP}|ana@x.test`]));
  });

  it('returns different keys for the same email from different IPs', () => {
    const body = { email: 'ana@x.test' };

    expect(trackByIpAndEmail({ body, ip: '10.0.0.1' })).not.toBe(
      trackByIpAndEmail({ body, ip: '10.0.0.2' }),
    );
  });

  it.each([
    ['there is no body', undefined],
    ['the body is null', null],
    ['the body is a string', 'email=a@b.test'],
    ['the body is an array', ['a@b.test']],
    ['the body has no email', { password: 'x' }],
    ['the email is not a string', { email: 42 }],
    ['the email is an object', { email: { $ne: '' } }],
  ])('keys by the client IP alone when %s', (_case, body) => {
    expect(trackByIpAndEmail({ body, ip: IP })).toBe(`${IP}|`);
  });

  it('keeps requests without an email from different IPs apart', () => {
    expect(trackByIpAndEmail({ ip: '10.0.0.1' })).not.toBe(
      trackByIpAndEmail({ ip: '10.0.0.2' }),
    );
  });
});

const CREDENTIALS_THROTTLERS = credentialsThrottlers({
  ipLimit: 20,
});

describe('credentialsThrottlers', () => {
  it('defines the two layered limits over the same window', () => {
    expect(
      CREDENTIALS_THROTTLERS.map(({ name, limit, ttl }) => ({
        name,
        limit,
        ttl,
      })),
    ).toEqual([
      {
        name: 'credentials-ip-email',
        limit: CREDENTIALS_IP_EMAIL_LIMIT,
        ttl: CREDENTIALS_THROTTLE_TTL_MS,
      },
      {
        name: 'credentials-ip',
        limit: 20,
        ttl: CREDENTIALS_THROTTLE_TTL_MS,
      },
    ]);
    expect(CREDENTIALS_IP_EMAIL_LIMIT).toBe(5);
  });

  it('uses the configured per-IP limit and keeps per IP + email at 5', () => {
    expect(
      credentialsThrottlers({ ipLimit: 1000 }).map(({ limit }) => limit),
    ).toEqual([5, 1000]);
  });

  it('shares keys between login and sign-up (the key ignores the route)', () => {
    const [ipEmail] = CREDENTIALS_THROTTLERS;
    const login = contextFor(function login() {});
    const register = contextFor(function register() {});

    expect(
      ipEmail.generateKey?.(login, 'tracker', 'credentials-ip-email'),
    ).toBe(ipEmail.generateKey?.(register, 'tracker', 'credentials-ip-email'));
  });

  it('applies only to routes marked with @CredentialsThrottle()', () => {
    class Controller {
      @CredentialsThrottle()
      login(): void {}

      list(): void {}
    }
    // Handlers as plain values (what Nest passes to the reflector), not method references.
    const handlers = Controller.prototype as unknown as Record<
      'login' | 'list',
      () => void
    >;
    const marked = {
      getHandler: () => handlers.login,
      getClass: () => Controller,
    } as unknown as ExecutionContext;
    const unmarked = {
      getHandler: () => handlers.list,
      getClass: () => Controller,
    } as unknown as ExecutionContext;

    for (const throttler of CREDENTIALS_THROTTLERS) {
      expect(throttler.skipIf?.(marked)).toBe(false);
      expect(throttler.skipIf?.(unmarked)).toBe(true);
    }
  });
});
