import type { ListingStatus } from '../../../generated/prisma/enums.js';

export interface ListingResponseDto {
  id: string;
  title: string;
  priceCents: number;
  photoUrl: string | null;
  status: ListingStatus;
  createdAt: string;
}

export interface ListListingsResponseDto {
  data: ListingResponseDto[];
  meta: {
    total: number;
  };
}
