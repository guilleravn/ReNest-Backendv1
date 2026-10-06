import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersService } from './users.service.js';
import { ZonesController } from './zones.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [ZonesController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
