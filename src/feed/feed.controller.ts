import { Controller, Get, Query } from '@nestjs/common';
import type { ListListingsResponseDto } from '../listings/dto/listing-response.dto.js';
import { ListFeedQueryDto } from './dto/list-feed-query.dto.js';
import { FeedService } from './feed.service.js';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  findAll(@Query() query: ListFeedQueryDto): Promise<ListListingsResponseDto> {
    return this.feedService.findAll(query);
  }
}
