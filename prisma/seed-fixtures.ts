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

// ACTIVE listings for the public feed (B1, BO-5), owned by Valentina and Tomás: never by
// SEEDED_SELLER_ID, whose listings test/listings.e2e-spec.ts clears.
export const SEED_FEED_LISTING_IDS = {
  leatherArmchair: '018f6e5c-0000-7000-8000-000000000105',
  oakArmchair: '018f6e5c-0000-7000-8000-000000000106',
  deskLamp: '018f6e5c-0000-7000-8000-000000000107',
  floorLamp: '018f6e5c-0000-7000-8000-000000000108',
  bluetoothSpeaker: '018f6e5c-0000-7000-8000-000000000109',
  deskMonitor: '018f6e5c-0000-7000-8000-000000000110',
} as const;

// One pickup option per feed listing (same order as SEED_FEED_LISTING_IDS).
export const SEED_FEED_PICKUP_OPTION_IDS = {
  leatherArmchair: '018f6e5c-0000-7000-8000-000000000205',
  oakArmchair: '018f6e5c-0000-7000-8000-000000000206',
  deskLamp: '018f6e5c-0000-7000-8000-000000000207',
  floorLamp: '018f6e5c-0000-7000-8000-000000000208',
  bluetoothSpeaker: '018f6e5c-0000-7000-8000-000000000209',
  deskMonitor: '018f6e5c-0000-7000-8000-000000000210',
} as const;
