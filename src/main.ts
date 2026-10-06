import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  // Shutdown hooks so PrismaService.onModuleDestroy closes the pool on SIGTERM (e.g. docker stop).
  app.enableShutdownHooks();

  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  await app.listen(configService.get('PORT', { infer: true }));
}
await bootstrap();
