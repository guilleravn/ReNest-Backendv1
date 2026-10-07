import { Controller, Get, Query } from '@nestjs/common';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator.js';
import { ListListingsQueryDto } from './dto/list-listings-query.dto.js';
import type { ListListingsResponseDto } from './dto/listing-response.dto.js';
import { ListingsService } from './listings.service.js';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  findAll(
    @Query() query: ListListingsQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ListListingsResponseDto> {
    return this.listingsService.findAllForSeller(user.id, query);
  }
}
