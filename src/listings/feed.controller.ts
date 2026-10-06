import { Controller, Get, Query } from '@nestjs/common';

import type { ListFeedResponseDto } from './dto/feed-response.dto.js';
import { ListFeedQueryDto } from './dto/list-feed-query.dto.js';
import { ListingsService } from './listings.service.js';

// Not @Public(): the global guard covers it once login (BO-39) lands. No @CurrentUser(): the
// feed shows every ACTIVE listing, the current user's included (team decision).
@Controller('feed')
export class FeedController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  findAll(@Query() query: ListFeedQueryDto): Promise<ListFeedResponseDto> {
    return this.listingsService.findFeed(query);
  }
}
