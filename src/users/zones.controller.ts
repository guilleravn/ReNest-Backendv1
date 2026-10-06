import { Controller, Get } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator.js';
import { USER_ZONES } from './user-zones.js';

/**
 * The zones list is the backend's single source of truth: the sign-up form reads it from here
 * instead of keeping its own copy. No service: it is a constant, not data.
 */
@Controller('zones')
export class ZonesController {
  @Public()
  @Get()
  findAll(): string[] {
    return [...USER_ZONES];
  }
}
