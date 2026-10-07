// Offset pagination shared by every paginated endpoint (see docs/conventions/api-design.md).

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageParams & { total: number };
}

// Converts a 1-based page into Prisma's `skip`/`take`.
export function toSkipTake({ page, pageSize }: PageParams): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
