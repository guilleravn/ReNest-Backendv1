import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from './pagination-query.dto.js';

// Same as the `listings.title` column length: a longer query can never match.
export const MAX_SEARCH_QUERY_LENGTH = 120;

export class ListFeedQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(MAX_SEARCH_QUERY_LENGTH)
  q?: string;
}
