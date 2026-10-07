import type { ListingStatus } from '../../../generated/prisma/enums.js';
import type { Paginated } from '../../common/pagination/pagination.js';

export interface ListingResponseDto {
  id: string;
  title: string;
  priceCents: number;
  // Raw storage key of the cover photo until real storage lands (see known-deviations.md).
  photoUrl: string | null;
  status: ListingStatus;
  createdAt: string;
}

export type ListListingsResponseDto = Paginated<ListingResponseDto>;
