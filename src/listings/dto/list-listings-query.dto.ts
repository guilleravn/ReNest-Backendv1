import { IsEnum, IsOptional } from 'class-validator';

import { ListingStatus } from '../../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

export class ListListingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
