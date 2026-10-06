import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListingStatus, Prisma } from '../../generated/prisma/client.js';
import type { ListListingsResponseDto } from './dto/listing-response.dto.js';

const DEFAULT_LISTINGS_TAKE = 20;
const COVER_PHOTO_POSITION = 0;

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForSeller(
    sellerId: string,
    status?: ListingStatus,
  ): Promise<ListListingsResponseDto> {
    const where: Prisma.ListingWhereInput = {
      sellerId,
      ...(status ? { status } : {}),
    };

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        take: DEFAULT_LISTINGS_TAKE,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          priceCents: true,
          status: true,
          createdAt: true,
          photos: {
            where: { position: COVER_PHOTO_POSITION },
            select: { storageKey: true },
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
      meta: { total },
    };
  }
}
