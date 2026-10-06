import { Module, OnModuleInit, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_PIPE, HttpAdapterHost } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Express } from 'express';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { credentialsThrottlers } from './auth/credentials-throttle.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { EnvironmentVariables, validateEnv } from './config/env.validation.js';
import { parseTrustProxy } from './config/trust-proxy.js';
import { ListingsModule } from './listings/listings.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

export const DEFAULT_THROTTLER = 'default';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [
          // Every route, per client IP (THROTTLE_LIMIT / THROTTLE_TTL_MS): a coarse safety net.
          {
            name: DEFAULT_THROTTLER,
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
            ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
          },
          // Only routes marked @CredentialsThrottle() (login, sign-up); they stack on the default.
          ...credentialsThrottlers({
            ipLimit: config.get('CREDENTIALS_IP_LIMIT', { infer: true }),
            globalLimit: config.get('CREDENTIALS_GLOBAL_LIMIT', {
              infer: true,
            }),
          }),
        ],
      }),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ListingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Registered here instead of main.ts so e2e tests built from AppModule inherit it.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    // Global guards run in this order: the throttler counts every request (even unauthenticated
    // ones), then the JWT guard rejects anything not marked @Public() without a valid token.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /**
   * Sets Express' `trust proxy` from TRUST_PROXY so `req.ip` is the browser's IP forwarded by the
   * Next.js server in X-Forwarded-For (the throttlers key on it). Done here rather than in main.ts
   * so apps created from AppModule in e2e tests get it too.
   */
  onModuleInit(): void {
    const trustProxy = parseTrustProxy(
      this.config.get('TRUST_PROXY', { infer: true }),
    );
    this.httpAdapterHost.httpAdapter
      .getInstance<Express>()
      // Never null here: validated at startup (env.validation.ts).
      .set('trust proxy', trustProxy ?? false);
  }
}
