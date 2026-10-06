import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'unit-test-secret-at-least-32-characters-long';
const USER_ID = '0199b2a4-7c4e-7000-8000-000000000001';

interface FakeRequest {
  headers: { authorization?: string };
  user?: { id: string };
}

const handler = () => undefined;
class FakeController {}

function contextFor(request: FakeRequest): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => FakeController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let jwtService: JwtService;
  let reflector: Reflector;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = new JwtService({
      secret: SECRET,
      signOptions: { expiresIn: '7d' },
    });
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector, jwtService);
  });

  describe('canActivate', () => {
    it('allows a @Public() route without a token', async () => {
      const spy = vi
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(true);
      const request: FakeRequest = { headers: {} };

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(spy).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        handler,
        FakeController,
      ]);
      expect(request.user).toBeUndefined();
    });

    it('attaches only the user id from sub when the token is valid', async () => {
      const token = await jwtService.signAsync({ sub: USER_ID, extra: 'x' });
      const request: FakeRequest = {
        headers: { authorization: `Bearer ${token}` },
      };

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.user).toEqual({ id: USER_ID });
    });

    it.each([
      ['there is no Authorization header', undefined],
      ['the scheme is not Bearer', 'Basic abc'],
      ['the scheme is lowercase', 'bearer abc'],
      ['the token is empty', 'Bearer    '],
      ['the token is malformed', 'Bearer not-a-jwt'],
    ])('throws UnauthorizedException when %s', async (_case, authorization) => {
      const request: FakeRequest = { headers: { authorization } };

      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
        UnauthorizedException,
      );
      expect(request.user).toBeUndefined();
    });

    it('throws UnauthorizedException when the token is signed with another secret', async () => {
      const forged = await new JwtService({
        secret: 'another-secret-that-is-at-least-32-chars',
      }).signAsync({ sub: USER_ID });

      await expect(
        guard.canActivate(
          contextFor({ headers: { authorization: `Bearer ${forged}` } }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the token is expired', async () => {
      const expired = await jwtService.signAsync(
        { sub: USER_ID },
        { expiresIn: '-1s' },
      );

      await expect(
        guard.canActivate(
          contextFor({ headers: { authorization: `Bearer ${expired}` } }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the token is unsigned (alg none)', async () => {
      const valid = await jwtService.signAsync({ sub: USER_ID });
      const [, payload] = valid.split('.');
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' }),
      ).toString('base64url');

      await expect(
        guard.canActivate(
          contextFor({
            headers: { authorization: `Bearer ${header}.${payload}.` },
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it.each([
      ['has no sub', {}],
      ['has an empty sub', { sub: '' }],
      ['has a numeric sub', { sub: 42 }],
    ])(
      'throws UnauthorizedException when a validly signed token %s',
      async (_case, payload) => {
        const token = await jwtService.signAsync(payload);

        await expect(
          guard.canActivate(
            contextFor({ headers: { authorization: `Bearer ${token}` } }),
          ),
        ).rejects.toThrow(UnauthorizedException);
      },
    );
  });
});
