import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ListingStatus } from '../../generated/prisma/enums.js';
import type { ListFeedResponseDto } from './dto/feed-response.dto.js';
import type { ListListingsResponseDto } from './dto/listing-response.dto.js';

export interface FindAllForSellerParams {
  status?: ListingStatus;
  page: number;
  pageSize: number;
}

export interface FindFeedParams {
  q?: string;
  page: number;
  pageSize: number;
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
        skip: (page - 1) * pageSize,
        take: pageSize,
        // `id` breaks ties so pages never overlap or skip rows.
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          title: true,
          priceCents: true,
          publishedAt: true,
          category: { select: { slug: true, name: true } },
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
        category: { slug: listing.category.slug, name: listing.category.name },
        publishedAt: listing.publishedAt.toISOString(),
      })),
      meta: { page, pageSize, total },
    };
  }
}
