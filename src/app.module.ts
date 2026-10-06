import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { EnvironmentVariables, validateEnv } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Global default per client IP (THROTTLE_LIMIT / THROTTLE_TTL_MS): a coarse safety net, since
    // every request comes from the Next.js server's IP. Login and sign-up replace it with a
    // per-email limit (see auth/credentials-throttle.ts).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [
          {
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
            ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
          },
        ],
      }),
    }),
    PrismaModule,
    AuthModule,
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
export class AppModule {}
