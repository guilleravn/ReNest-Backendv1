import { Injectable } from '@nestjs/common';

/**
 * Temporary auth stand-in until BO-39 (real email+password login, JWT
 * sessions) lands. There is no multi-user session yet, and security.md
 * forbids a fake/switchable "current user": every request acts as this one
 * seeded seller, matched by `prisma/seed.ts`.
 *
 * This file is the single swappable boundary: BO-39 replaces
 * `CurrentSellerProvider.getCurrentSeller()` (e.g. to read the id from a
 * verified JWT via `@CurrentUser()`) without any consumer (e.g.
 * `src/listings/**`) changing.
 */
export const SEEDED_SELLER_ID = '018f6e5c-0000-7000-8000-000000000001';

export interface CurrentSeller {
  id: string;
}

@Injectable()
export class CurrentSellerProvider {
  getCurrentSeller(): CurrentSeller {
    return { id: SEEDED_SELLER_ID };
  }
}
