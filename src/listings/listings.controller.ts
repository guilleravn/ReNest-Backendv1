import { Controller, Get, Query } from '@nestjs/common';
import { CurrentSellerProvider } from '../auth/current-seller.js';
import { ListListingsQueryDto } from './dto/list-listings-query.dto.js';
import type { ListListingsResponseDto } from './dto/listing-response.dto.js';
import { ListingsService } from './listings.service.js';

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly currentSellerProvider: CurrentSellerProvider,
  ) {}

  @Get()
  findAll(
    @Query() query: ListListingsQueryDto,
  ): Promise<ListListingsResponseDto> {
    const currentSeller = this.currentSellerProvider.getCurrentSeller();
    return this.listingsService.findAllForSeller(
      currentSeller.id,
      query.status,
    );
  }
}
