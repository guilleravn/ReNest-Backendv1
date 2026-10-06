// Seeds the reference data and the pre-created accounts of the MVP (there is no sign-up),
// plus the BO-40 listings fixtures ("My Listings per tab" + ownership scoping).
// Idempotent: every row is upserted by a natural key, so it can run after each migration.
// All people below are synthetic (reserved `.test` domain, placeholder phone numbers).
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

import { PrismaClient } from '../generated/prisma/client.js';
import {
  OTHER_SELLER_ID,
  SEED_LISTING_IDS,
  SEED_PICKUP_OPTION_IDS,
  SEEDED_SELLER_ID,
} from './seed-fixtures.js';

const MIN_SEED_PASSWORD_LENGTH = 8;

const CATEGORIES = [
  { slug: 'furniture', name: 'Muebles' },
  { slug: 'electronics', name: 'Electrónica' },
  { slug: 'home', name: 'Hogar' },
] as const;

const USERS = [
  // The seller the `@CurrentUser()` stub acts as until BO-39 (see src/auth/current-user.decorator.ts).
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

// Users whose id is fixed because code or tests point at it.
const FIXED_USER_IDS: ReadonlyMap<string, string> = new Map(
  USERS.flatMap((user) => ('id' in user ? [[user.email, user.id]] : [])),
);

// Prisma returns `time` columns as a Date on 1970-01-01 UTC.
const time = (hhmm: string): Date => new Date(`1970-01-01T${hhmm}:00.000Z`);

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

// An account created by an older seed keeps its random id, so the listings below (and the
// `@CurrentUser()` stub) would point at a user that does not exist. Fail with the fix instead.
async function assertFixedUserIds(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.user.findMany({
    where: { email: { in: [...FIXED_USER_IDS.keys()] } },
    select: { id: true, email: true },
  });
  for (const { id, email } of existing) {
    const expectedId = FIXED_USER_IDS.get(email);
    if (id !== expectedId) {
      throw new Error(
        `${email} exists with id ${id}, expected ${expectedId}. This database was seeded ` +
          'before the fixed ids: reset it with `npx prisma migrate reset`.',
      );
    }
  }
}

async function seed(prisma: PrismaClient): Promise<void> {
  const passwordHash = await argon2.hash(readSeedPassword());
  await assertFixedUserIds(prisma);

  const [furnitureCategory] = await prisma.$transaction([
    ...CATEGORIES.map((category) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        create: category,
        update: { name: category.name },
      }),
    ),
    ...USERS.map(({ verifiedAt, ...user }) => {
      // Everything but the primary key: an existing row's id is never rewritten (it may be referenced).
      const { email, fullName, phoneE164, city } = user;
      const profile = {
        email,
        fullName,
        phoneE164,
        city,
        isVerified: verifiedAt !== null,
        verifiedAt,
      };
      return prisma.user.upsert({
        where: { email },
        create: { ...user, ...profile, passwordHash },
        update: { ...profile, passwordHash },
      });
    }),
  ]);

  // PENDING and COMPLETED have no reservation yet: the reservations table comes with its own
  // slice, which must seed one for each (see docs/known-deviations.md).
  const listingsToSeed = [
    {
      id: SEED_LISTING_IDS.active,
      pickupOptionId: SEED_PICKUP_OPTION_IDS.active,
      sellerId: SEEDED_SELLER_ID,
      title: 'Wooden dining table',
      status: 'ACTIVE' as const,
      priceCents: 250_00,
    },
    {
      id: SEED_LISTING_IDS.pending,
      pickupOptionId: SEED_PICKUP_OPTION_IDS.pending,
      sellerId: SEEDED_SELLER_ID,
      title: 'Reserved office chair',
      status: 'PENDING' as const,
      priceCents: 80_00,
    },
    {
      id: SEED_LISTING_IDS.completed,
      pickupOptionId: SEED_PICKUP_OPTION_IDS.completed,
      sellerId: SEEDED_SELLER_ID,
      title: 'Sold bookshelf',
      status: 'COMPLETED' as const,
      priceCents: 120_00,
    },
    {
      id: SEED_LISTING_IDS.otherSellerActive,
      pickupOptionId: SEED_PICKUP_OPTION_IDS.otherSellerActive,
      sellerId: OTHER_SELLER_ID,
      title: "Another seller's lamp",
      status: 'ACTIVE' as const,
      priceCents: 50_00,
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

    // Every published listing has at least one pickup option (business-invariants.md).
    await prisma.pickupOption.upsert({
      where: { id: listing.pickupOptionId },
      update: {},
      create: {
        id: listing.pickupOptionId,
        listingId: listing.id,
        locationLabel: 'Parque México, Condesa',
        address: 'Av. México s/n, Hipódromo, Cuauhtémoc, CDMX',
        weekdays: ['SATURDAY', 'SUNDAY'],
        startTime: time('10:00'),
        endTime: time('13:00'),
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
