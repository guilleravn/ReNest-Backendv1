export interface CategoryResponseDto {
  id: string;
  name: string;
  slug: string;
}

export interface ListCategoriesResponseDto {
  data: CategoryResponseDto[];
}
