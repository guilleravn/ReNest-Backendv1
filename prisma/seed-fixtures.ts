// Fixed ids of the rows `prisma/seed.ts` creates, shared with the tests that check them.
// Kept apart from seed.ts because importing that script runs the seed.

// Samuel Rojas, the seeded seller whose listings the BO-40 fixtures and e2e tests use.
export const SEEDED_SELLER_ID = '018f6e5c-0000-7000-8000-000000000001';

// A second seller, used to prove listings are scoped by ownership.
export const OTHER_SELLER_ID = '018f6e5c-0000-7000-8000-000000000002';

export const SEED_LISTING_IDS = {
  active: '018f6e5c-0000-7000-8000-000000000101',
  pending: '018f6e5c-0000-7000-8000-000000000102',
  completed: '018f6e5c-0000-7000-8000-000000000103',
  otherSellerActive: '018f6e5c-0000-7000-8000-000000000104',
} as const;

// One pickup option per seeded listing (same order as SEED_LISTING_IDS).
export const SEED_PICKUP_OPTION_IDS = {
  active: '018f6e5c-0000-7000-8000-000000000201',
  pending: '018f6e5c-0000-7000-8000-000000000202',
  completed: '018f6e5c-0000-7000-8000-000000000203',
  otherSellerActive: '018f6e5c-0000-7000-8000-000000000204',
} as const;
