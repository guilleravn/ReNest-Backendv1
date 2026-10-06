import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CurrentSellerProvider } from '../auth/current-seller.js';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ListingsController],
  providers: [ListingsService, CurrentSellerProvider],
})
export class ListingsModule {}
