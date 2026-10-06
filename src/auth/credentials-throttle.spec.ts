import { ExecutionContext } from '@nestjs/common';

import {
  CREDENTIALS_THROTTLE,
  trackByEmailOrIp,
} from './credentials-throttle.js';

const context = {} as ExecutionContext;
const IP = '10.0.0.7';

describe('trackByEmailOrIp', () => {
  it('returns the normalized email when the body has one', () => {
    expect(
      trackByEmailOrIp(
        { body: { email: '  Camila@ReNest.TEST ' }, ip: IP },
        context,
      ),
    ).toBe('email:camila@renest.test');
  });

  it('returns the same key for case and whitespace variants of an email', () => {
    const keys = ['ana@x.test', 'ANA@X.TEST', ' ana@x.test\t'].map((email) =>
      trackByEmailOrIp({ body: { email }, ip: IP }, context),
    );

    expect(new Set(keys)).toEqual(new Set(['email:ana@x.test']));
  });

  it.each([
    ['there is no body', undefined],
    ['the body is null', null],
    ['the body is a string', 'email=a@b.test'],
    ['the body is an array', ['a@b.test']],
    ['the body has no email', { password: 'x' }],
    ['the email is empty after trimming', { email: '   ' }],
    ['the email is not a string', { email: 42 }],
    ['the email is an object', { email: { $ne: '' } }],
  ])('falls back to the client IP when %s', (_case, body) => {
    expect(trackByEmailOrIp({ body, ip: IP }, context)).toBe(`ip:${IP}`);
  });

  it('does not throw when the request has neither body nor IP', () => {
    expect(trackByEmailOrIp({}, context)).toBe('ip:undefined');
  });
});

describe('CREDENTIALS_THROTTLE', () => {
  it('allows 5 requests per 60 s on the default throttler, tracked by email or IP', () => {
    expect(CREDENTIALS_THROTTLE).toEqual({
      default: { limit: 5, ttl: 60_000, getTracker: trackByEmailOrIp },
    });
  });
});
