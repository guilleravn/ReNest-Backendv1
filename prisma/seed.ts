// Seeds the reference data and the pre-created accounts of the MVP (there is no sign-up),
// plus the BO-40 listings fixtures ("My Listings per tab" + ownership scoping).
// Idempotent: every row is upserted by a natural key, so it can run after each migration.
// All people below are synthetic (reserved `.test` domain, placeholder phone numbers).
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

import { PrismaClient } from '../generated/prisma/client.js';
import { SEEDED_SELLER_ID } from '../src/auth/current-user.decorator.js';

const MIN_SEED_PASSWORD_LENGTH = 8;

// Matches the seller the `CurrentSellerProvider` stub acts as until BO-39 lands.
const OTHER_SELLER_ID = '018f6e5c-0000-7000-8000-000000000002';

const CATEGORIES = [
  { slug: 'furniture', name: 'Muebles' },
  { slug: 'electronics', name: 'Electrónica' },
  { slug: 'home', name: 'Hogar' },
] as const;

const USERS = [
  // The seller the `@CurrentUser()` stub acts as (see src/auth/current-user.decorator.ts).
  {
    id: SEEDED_SELLER_ID,
    email: 'samuel@renest.test',
    fullName: 'Samuel Rojas',
    phoneE164: '+525500000001',
    city: 'Ciudad de México',
    verifiedAt: new Date('2026-10-01T00:00:00.000Z'),
  },
  // A second seller, used to prove listings are scoped by ownership.
  {
    id: OTHER_SELLER_ID,
    email: 'valentina@renest.test',
    fullName: 'Valentina Cruz',
    phoneE164: '+525500000002',
    city: 'Ciudad de México',
    verifiedAt: null,
  },
  // The buyer persona used by the Gherkin scenarios, the login story and the e2e tests.
  {
    email: 'camila@renest.test',
    fullName: 'Camila Torres',
    phoneE164: '+525500000003',
    city: 'Ciudad de México',
    verifiedAt: null,
  },
  // No phone on purpose: exercises the WhatsApp "can't be reached" fallback.
  {
    email: 'tomas@renest.test',
    fullName: 'Tomás Herrera',
    phoneE164: null,
    city: 'Guadalajara',
    verifiedAt: null,
  },
] as const;

const ACTIVE_LISTING_ID = '018f6e5c-0000-7000-8000-000000000101';
const PENDING_LISTING_ID = '018f6e5c-0000-7000-8000-000000000102';
const COMPLETED_LISTING_ID = '018f6e5c-0000-7000-8000-000000000103';
const OTHER_SELLER_LISTING_ID = '018f6e5c-0000-7000-8000-000000000104';

// Real S3/R2 upload is a separate, later story (see known-deviations.md):
// this is a placeholder-looking key, not an actual uploaded object.
function placeholderStorageKey(listingId: string): string {
  return `listings/${listingId}/photo-0.jpg`;
}

function readSeedPassword(): string {
  const password = process.env['SEED_USER_PASSWORD'];
  if (!password || password.length < MIN_SEED_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_USER_PASSWORD must be set (at least ${MIN_SEED_PASSWORD_LENGTH} characters)`,
    );
  }
  return password;
}

async function seed(prisma: PrismaClient): Promise<void> {
  const passwordHash = await argon2.hash(readSeedPassword());

  const [furnitureCategory] = await prisma.$transaction([
    ...CATEGORIES.map((category) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        create: category,
        update: { name: category.name },
      }),
    ),
    ...USERS.map(({ verifiedAt, ...user }) => {
      const profile = { ...user, isVerified: verifiedAt !== null, verifiedAt };
      return prisma.user.upsert({
        where: { email: user.email },
        create: { ...profile, passwordHash },
        update: { ...profile, passwordHash },
      });
    }),
  ]);

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
        categoryId: furnitureCategory.id,
        title: listing.title,
        description: `${listing.title} — seeded for BO-40, in good condition.`,
        condition: 'GENTLY_USED',
        priceCents: listing.priceCents,
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

  console.log(
    `Seeded ${CATEGORIES.length} categories, ${USERS.length} users and ${listingsToSeed.length} listings`,
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

try {
  await seed(prisma);
} finally {
  await prisma.$disconnect();
}
