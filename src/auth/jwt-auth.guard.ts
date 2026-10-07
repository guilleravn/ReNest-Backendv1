import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

import type { AuthenticatedRequest } from '../common/decorators/current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import type { AccessTokenPayload } from './auth.service.js';

const BEARER_PREFIX = 'Bearer ';

/**
 * Global guard (APP_GUARD): every route needs a valid access token unless marked `@Public()`.
 * It only proves who the caller is; whether the user still exists is checked where it matters
 * (e.g. `GET /auth/me`).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & Partial<AuthenticatedRequest>>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: Partial<AccessTokenPayload>;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      // Expired, malformed or badly signed: all mean "not authenticated".
      throw new UnauthorizedException();
    }
    // `sub` becomes the user id every service queries with (a uuid column): anything else would
    // reach Postgres as an invalid uuid and surface as a 500 instead of a 401.
    if (typeof payload.sub !== 'string' || !isUUID(payload.sub)) {
      throw new UnauthorizedException();
    }

    request.user = { id: payload.sub };
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token === '' ? null : token;
}
