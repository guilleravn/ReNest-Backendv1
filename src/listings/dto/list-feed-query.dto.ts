import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

// Same as the `listings.title` column length: a longer query can never match.
export const MAX_SEARCH_QUERY_LENGTH = 120;

// Postgres rejects NUL in text parameters (a raw 500), and no title contains a control character.
// oxlint-disable-next-line no-control-regex -- matching control characters is the point
const NO_CONTROL_CHARACTERS = /^[^\u0000-\u001F\u007F]*$/;

export class ListFeedQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(MAX_SEARCH_QUERY_LENGTH)
  @Matches(NO_CONTROL_CHARACTERS, {
    message: 'q must not contain control characters',
  })
  q?: string;
}
