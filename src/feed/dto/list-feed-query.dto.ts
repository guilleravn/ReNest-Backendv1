import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE = 1_000_000;

// Format only: an unknown slug is expected to yield an empty result set through the
// Listing -> Category join, not a 400 (see docs/rules/business-invariants.md).
const CATEGORY_SLUG_PATTERN = /^[a-z0-9-]+$/;

export class ListFeedQueryDto {
  @IsOptional()
  @IsString()
  @Matches(CATEGORY_SLUG_PATTERN)
  category?: string;

  // Rejects whitespace-only values (e.g. a single space), which would otherwise pass
  // @MinLength(1) and match every title containing a space.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}
