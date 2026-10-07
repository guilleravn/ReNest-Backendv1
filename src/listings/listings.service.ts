import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { ListingStatus } from '../../generated/prisma/enums.js';
import {
  type PageParams,
  toSkipTake,
} from '../common/pagination/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListFeedResponseDto } from './dto/feed-response.dto.js';
import type { ListListingsResponseDto } from './dto/listing-response.dto.js';

export interface FindAllForSellerParams extends PageParams {
  status?: ListingStatus;
}

export interface FindFeedParams extends PageParams {
  q?: string;
}

// Cover = lowest position (0 by convention), even if positions have gaps.
export const COVER_PHOTO_SELECT = {
  photos: {
    select: { storageKey: true },
    orderBy: { position: 'asc' },
    take: 1,
  },
} satisfies Prisma.ListingSelect;

// The cover photo's storage key, or null when the listing has no photo (see COVER_PHOTO_SELECT).
export function coverPhotoUrl(
  photos: ReadonlyArray<{ storageKey: string }>,
): string | null {
  return photos[0]?.storageKey ?? null;
}

// Prisma passes `contains` to ILIKE without escaping, so `%` and `_` would act as wildcards.
// Backslash is Postgres' default LIKE escape character, so a literal one is escaped too.
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
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
        ...toSkipTake({ page, pageSize }),
        // `id` breaks ties so pages never overlap or skip rows.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          title: true,
          priceCents: true,
          status: true,
          createdAt: true,
          ...COVER_PHOTO_SELECT,
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      data: listings.map(({ photos, createdAt, ...listing }) => ({
        ...listing,
        photoUrl: coverPhotoUrl(photos),
        createdAt: createdAt.toISOString(),
      })),
      meta: { page, pageSize, total },
    };
  }

  // Public feed: every ACTIVE listing (the current user's included), optionally filtered by a
  // case-insensitive substring of the title.
  async findFeed({
    q,
    page,
    pageSize,
  }: FindFeedParams): Promise<ListFeedResponseDto> {
    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      ...(q
        ? { title: { contains: escapeLikePattern(q), mode: 'insensitive' } }
        : {}),
    };

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        ...toSkipTake({ page, pageSize }),
        // `id` breaks ties so pages never overlap or skip rows.
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          title: true,
          priceCents: true,
          publishedAt: true,
          category: { select: { slug: true, name: true } },
          ...COVER_PHOTO_SELECT,
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      data: listings.map(({ photos, publishedAt, ...listing }) => ({
        ...listing,
        photoUrl: coverPhotoUrl(photos),
        publishedAt: publishedAt.toISOString(),
      })),
      meta: { page, pageSize, total },
    };
  }
}
