import type { Paginated } from '../../common/pagination/pagination.js';

export interface FeedListingResponseDto {
  id: string;
  title: string;
  priceCents: number;
  // Raw storage key of the cover photo until real storage lands (see known-deviations.md).
  photoUrl: string | null;
  category: {
    slug: string;
    name: string;
  };
  publishedAt: string;
}

export type ListFeedResponseDto = Paginated<FeedListingResponseDto>;
