// Seed scoped to BO-40 (GET /listings?status=): just enough data to exercise
// the "My Listings per tab" query and prove ownership scoping. Not a general
// fixture set — extend it in the slice that needs more (buyers, reservations,
// pickup options, etc.).
//
// Run with `npm run prisma:migrate` (applies the migration) then
// `npx prisma db seed` (wired via `migrations.seed` in prisma.config.ts).

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { SEEDED_SELLER_ID } from '../src/auth/current-seller.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Fixed ids so the seed is deterministic and idempotent (safe to re-run).
const OTHER_SELLER_ID = '018f6e5c-0000-7000-8000-000000000002';
const CATEGORY_ID = '018f6e5c-0000-7000-8000-000000000010';

const ACTIVE_LISTING_ID = '018f6e5c-0000-7000-8000-000000000101';
const PENDING_LISTING_ID = '018f6e5c-0000-7000-8000-000000000102';
const COMPLETED_LISTING_ID = '018f6e5c-0000-7000-8000-000000000103';
const OTHER_SELLER_LISTING_ID = '018f6e5c-0000-7000-8000-000000000104';

// Real S3/R2 upload is a separate, later story (see known-deviations.md):
// this is a placeholder-looking key, not an actual uploaded object.
function placeholderStorageKey(listingId: string): string {
  return `listings/${listingId}/photo-0.jpg`;
}

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { id: SEEDED_SELLER_ID },
    update: {},
    create: {
      id: SEEDED_SELLER_ID,
      email: 'seller@renest.seed',
      passwordHash: 'seed-only-not-a-real-hash',
      fullName: 'Seeded Seller',
      city: 'Bogota',
      isVerified: true,
      verifiedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { id: OTHER_SELLER_ID },
    update: {},
    create: {
      id: OTHER_SELLER_ID,
      email: 'other-seller@renest.seed',
      passwordHash: 'seed-only-not-a-real-hash',
      fullName: 'Other Seeded Seller',
      city: 'Medellin',
      isVerified: false,
    },
  });

  await prisma.category.upsert({
    where: { id: CATEGORY_ID },
    update: {},
    create: {
      id: CATEGORY_ID,
      name: 'Furniture',
      slug: 'furniture',
    },
  });

  const listingsToSeed = [
    {
      id: ACTIVE_LISTING_ID,
      sellerId: SEEDED_SELLER_ID,
      title: 'Wooden dining table',
      status: 'ACTIVE' as const,
      priceCents: 25000_00,
    },
    {
      id: PENDING_LISTING_ID,
      sellerId: SEEDED_SELLER_ID,
      title: 'Reserved office chair',
      status: 'PENDING' as const,
      priceCents: 8000_00,
    },
    {
      id: COMPLETED_LISTING_ID,
      sellerId: SEEDED_SELLER_ID,
      title: 'Sold bookshelf',
      status: 'COMPLETED' as const,
      priceCents: 12000_00,
    },
    {
      id: OTHER_SELLER_LISTING_ID,
      sellerId: OTHER_SELLER_ID,
      title: "Another seller's lamp",
      status: 'ACTIVE' as const,
      priceCents: 5000_00,
    },
  ];

  for (const listing of listingsToSeed) {
    await prisma.listing.upsert({
      where: { id: listing.id },
      update: {},
      create: {
        id: listing.id,
        sellerId: listing.sellerId,
        categoryId: CATEGORY_ID,
        title: listing.title,
        description: `${listing.title} — seeded for BO-40, in good condition.`,
        condition: 'GENTLY_USED',
        priceCents: listing.priceCents,
        currency: 'COP',
        status: listing.status,
      },
    });

    await prisma.listingPhoto.upsert({
      where: { listingId_position: { listingId: listing.id, position: 0 } },
      update: {},
      create: {
        listingId: listing.id,
        storageKey: placeholderStorageKey(listing.id),
        position: 0,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
