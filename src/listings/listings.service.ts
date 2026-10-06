import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ListingStatus } from '../../generated/prisma/enums.js';
import type { ListListingsResponseDto } from './dto/listing-response.dto.js';

export interface FindAllForSellerParams {
  status?: ListingStatus;
  page: number;
  pageSize: number;
}

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForSeller(
    sellerId: string,
    { status, page, pageSize }: FindAllForSellerParams,
  ): Promise<ListListingsResponseDto> {
    const where: Prisma.ListingWhereInput = {
      sellerId,
      ...(status ? { status } : {}),
    };

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        // `id` breaks ties so pages never overlap or skip rows.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          title: true,
          priceCents: true,
          status: true,
          createdAt: true,
          // Cover = lowest position (0 by convention), even if positions have gaps.
          photos: {
            select: { storageKey: true },
            orderBy: { position: 'asc' },
            take: 1,
          },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      data: listings.map((listing) => ({
        id: listing.id,
        title: listing.title,
        priceCents: listing.priceCents,
        photoUrl: listing.photos[0]?.storageKey ?? null,
        status: listing.status,
        createdAt: listing.createdAt.toISOString(),
      })),
      meta: { page, pageSize, total },
    };
  }
}
