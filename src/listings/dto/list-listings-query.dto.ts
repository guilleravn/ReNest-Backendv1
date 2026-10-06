import { IsEnum, IsOptional } from 'class-validator';
import { ListingStatus } from '../../../generated/prisma/enums.js';

export class ListListingsQueryDto {
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
