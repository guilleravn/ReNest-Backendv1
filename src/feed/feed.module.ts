import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FeedController } from './feed.controller.js';
import { FeedService } from './feed.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
