import type { ListingStatus } from '../../../generated/prisma/enums.js';

export interface ListingResponseDto {
  id: string;
  title: string;
  priceCents: number;
  // Raw storage key of the cover photo until real storage lands (see known-deviations.md).
  photoUrl: string | null;
  status: ListingStatus;
  createdAt: string;
}

export interface ListListingsResponseDto {
  data: ListingResponseDto[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}
