import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ListListingsResponseDto } from '../listings/dto/listing-response.dto.js';

export interface FindFeedParams {
  category?: string;
  search?: string;
  page: number;
  pageSize: number;
}

// Postgres's default LIKE/ILIKE escape character is `\`. Prisma's `contains` compiles to
// ILIKE, so a raw search value containing `%` or `_` would be interpreted as a wildcard
// pattern instead of matched literally. Escape `\`, `%` and `_` with a backslash (one pass,
// so an escaped backslash is never re-escaped) before the value reaches `contains`.
function escapeLikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  // The buyer feed only ever shows ACTIVE listings (see
  // docs/rules/business-invariants.md: "The buyer feed only shows ACTIVE listings").
  async findAll({
    category,
    search,
    page,
    pageSize,
  }: FindFeedParams): Promise<ListListingsResponseDto> {
    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      ...(category ? { category: { slug: category } } : {}),
      ...(search
        ? {
            title: {
              contains: escapeLikeWildcards(search),
              mode: 'insensitive' as const,
            },
          }
        : {}),
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
