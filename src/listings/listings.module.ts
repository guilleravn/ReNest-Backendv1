import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FeedController } from './feed.controller.js';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ListingsController, FeedController],
  providers: [ListingsService],
})
export class ListingsModule {}
