// Seeds the reference data and the pre-created demo accounts of the MVP (others sign up),
// plus the BO-40 listings fixtures ("My Listings per tab" + ownership scoping) and the ACTIVE
// listings of the public feed (B1, BO-5).
// Idempotent: every row is upserted by a natural key, so it can run after each migration.
// All people below are synthetic (reserved `.test` domain, placeholder phone numbers).
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

import { PrismaClient } from '../generated/prisma/client.js';
import type {
  ListingCondition,
  ListingStatus,
} from '../generated/prisma/enums.js';
import { type UserZone } from '../src/users/user-zones.js';
import {
  OTHER_SELLER_ID,
  SEED_FEED_LISTING_IDS,
  SEED_FEED_PICKUP_OPTION_IDS,
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

interface SeedUser {
  id?: string;
  email: string;
  fullName: string;
  phoneE164: string | null;
  city: UserZone;
  verifiedAt: Date | null;
}

// `city` must be one of USER_ZONES, like any account created through sign-up.
const USERS = [
  // The seller whose listings the BO-40 fixtures and e2e tests use (fixed id, see seed-fixtures.ts).
  {
    id: SEEDED_SELLER_ID,
    email: 'samuel@renest.test',
    fullName: 'Samuel Rojas',
    phoneE164: '+525500000001',
    city: 'Roma Norte, CDMX',
    verifiedAt: new Date('2026-10-01T00:00:00.000Z'),
  },
  // A second seller, used to prove listings are scoped by ownership.
  {
    id: OTHER_SELLER_ID,
    email: 'valentina@renest.test',
    fullName: 'Valentina Cruz',
    phoneE164: '+525500000002',
    city: 'Condesa, CDMX',
    verifiedAt: null,
  },
  // The buyer persona used by the Gherkin scenarios, the login story and the e2e tests.
  {
    email: 'camila@renest.test',
    fullName: 'Camila Torres',
    phoneE164: '+525500000003',
    city: 'Roma Norte, CDMX',
    verifiedAt: null,
  },
  // No phone on purpose: exercises the WhatsApp "can't be reached" fallback.
  {
    email: 'tomas@renest.test',
    fullName: 'Tomás Herrera',
    phoneE164: null,
    city: 'Palermo, Buenos Aires',
    verifiedAt: null,
  },
] as const satisfies readonly SeedUser[];

// Users whose id is fixed because code or tests point at it.
const FIXED_USER_IDS: ReadonlyMap<string, string> = new Map(
  USERS.flatMap((user) => ('id' in user ? [[user.email, user.id]] : [])),
);

interface ListingSeed {
  id: string;
  pickupOptionId: string;
  sellerId: string;
  categoryId: string;
  title: string;
  description: string;
  condition: ListingCondition;
  status: ListingStatus;
  priceCents: number;
  // Omitted = the column default (now()).
  publishedAt?: Date;
  pickup: { locationLabel: string; address: string };
}

function requireSeeded(
  idByKey: ReadonlyMap<string, string>,
  key: string,
): string {
  const id = idByKey.get(key);
  if (!id) {
    throw new Error(`Seed row ${key} was not created`);
  }
  return id;
}

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
// e2e fixtures) would point at a user that does not exist. Fail with the fix instead.
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

  const seededRows = await prisma.$transaction([
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
  // Tomás has no fixed id (nothing pointed at him before the feed), so read it back from the upsert.
  const categoryIdBySlug = new Map(
    seededRows.flatMap((row) =>
      'slug' in row ? [[row.slug, row.id] as const] : [],
    ),
  );
  const userIdByEmail = new Map(
    seededRows.flatMap((row) =>
      'email' in row ? [[row.email, row.id] as const] : [],
    ),
  );
  const categoryId = (slug: (typeof CATEGORIES)[number]['slug']): string =>
    requireSeeded(categoryIdBySlug, slug);
  const tomasId = requireSeeded(userIdByEmail, 'tomas@renest.test');
  const furnitureCategoryId = categoryId('furniture');

  const cdmxPickup = {
    locationLabel: 'Parque México, Condesa',
    address: 'Av. México s/n, Hipódromo, Cuauhtémoc, CDMX',
  };
  const guadalajaraPickup = {
    locationLabel: 'Plaza de la Liberación, Centro',
    address: 'Av. Hidalgo s/n, Centro, Guadalajara, Jal.',
  };

  const bo40Listing = (
    listing: Pick<
      ListingSeed,
      'id' | 'pickupOptionId' | 'sellerId' | 'title' | 'status' | 'priceCents'
    >,
  ): ListingSeed => ({
    ...listing,
    categoryId: furnitureCategoryId,
    description: `${listing.title} — seeded for BO-40, in good condition.`,
    condition: 'GENTLY_USED',
    pickup: cdmxPickup,
  });

  // PENDING and COMPLETED have no reservation yet: the reservations table comes with its own
  // slice, which must seed one for each (see docs/known-deviations.md).
  const listingsToSeed: ListingSeed[] = [
    bo40Listing({
      id: SEED_LISTING_IDS.active,
      pickupOptionId: SEED_PICKUP_OPTION_IDS.active,
      sellerId: SEEDED_SELLER_ID,
      title: 'Wooden dining table',
      status: 'ACTIVE',
      priceCents: 250_00,
    }),
    bo40Listing({
      id: SEED_LISTING_IDS.pending,
      pickupOptionId: SEED_PICKUP_OPTION_IDS.pending,
      sellerId: SEEDED_SELLER_ID,
      title: 'Reserved office chair',
      status: 'PENDING',
      priceCents: 80_00,
    }),
    bo40Listing({
      id: SEED_LISTING_IDS.completed,
      pickupOptionId: SEED_PICKUP_OPTION_IDS.completed,
      sellerId: SEEDED_SELLER_ID,
      title: 'Sold bookshelf',
      status: 'COMPLETED',
      priceCents: 120_00,
    }),
    bo40Listing({
      id: SEED_LISTING_IDS.otherSellerActive,
      pickupOptionId: SEED_PICKUP_OPTION_IDS.otherSellerActive,
      sellerId: OTHER_SELLER_ID,
      title: "Another seller's lamp",
      status: 'ACTIVE',
      priceCents: 50_00,
    }),
    // Feed (B1): titles share words ("armchair", "lamp", "desk") so search can be exercised.
    {
      id: SEED_FEED_LISTING_IDS.leatherArmchair,
      pickupOptionId: SEED_FEED_PICKUP_OPTION_IDS.leatherArmchair,
      sellerId: OTHER_SELLER_ID,
      categoryId: furnitureCategoryId,
      title: 'Leather armchair',
      description: 'Brown leather armchair, small scratch on the left arm.',
      condition: 'GENTLY_USED',
      status: 'ACTIVE',
      priceCents: 180_00,
      publishedAt: new Date('2026-10-01T15:00:00.000Z'),
      pickup: cdmxPickup,
    },
    {
      id: SEED_FEED_LISTING_IDS.oakArmchair,
      pickupOptionId: SEED_FEED_PICKUP_OPTION_IDS.oakArmchair,
      sellerId: tomasId,
      categoryId: furnitureCategoryId,
      title: 'Oak armchair',
      description: 'Solid oak frame with a linen cushion.',
      condition: 'LIKE_NEW',
      status: 'ACTIVE',
      priceCents: 140_00,
      publishedAt: new Date('2026-10-02T15:00:00.000Z'),
      pickup: guadalajaraPickup,
    },
    {
      id: SEED_FEED_LISTING_IDS.deskLamp,
      pickupOptionId: SEED_FEED_PICKUP_OPTION_IDS.deskLamp,
      sellerId: OTHER_SELLER_ID,
      categoryId: categoryId('home'),
      title: 'Desk lamp',
      description: 'Adjustable arm, warm LED bulb included.',
      condition: 'LIKE_NEW',
      status: 'ACTIVE',
      priceCents: 25_00,
      publishedAt: new Date('2026-10-03T15:00:00.000Z'),
      pickup: cdmxPickup,
    },
    {
      id: SEED_FEED_LISTING_IDS.floorLamp,
      pickupOptionId: SEED_FEED_PICKUP_OPTION_IDS.floorLamp,
      sellerId: tomasId,
      categoryId: categoryId('home'),
      title: 'Floor lamp',
      description: 'Tall reading light, the shade has a small dent.',
      condition: 'HEAVILY_USED',
      status: 'ACTIVE',
      priceCents: 30_00,
      publishedAt: new Date('2026-10-04T15:00:00.000Z'),
      pickup: guadalajaraPickup,
    },
    {
      id: SEED_FEED_LISTING_IDS.bluetoothSpeaker,
      pickupOptionId: SEED_FEED_PICKUP_OPTION_IDS.bluetoothSpeaker,
      sellerId: OTHER_SELLER_ID,
      categoryId: categoryId('electronics'),
      title: 'Bluetooth speaker',
      description: 'Portable, about 8 hours of battery. Charger included.',
      condition: 'GENTLY_USED',
      status: 'ACTIVE',
      priceCents: 45_00,
      publishedAt: new Date('2026-10-05T15:00:00.000Z'),
      pickup: cdmxPickup,
    },
    {
      id: SEED_FEED_LISTING_IDS.deskMonitor,
      pickupOptionId: SEED_FEED_PICKUP_OPTION_IDS.deskMonitor,
      sellerId: tomasId,
      categoryId: categoryId('electronics'),
      title: 'Desk monitor 24 inch',
      description: 'Full HD, HDMI cable included.',
      condition: 'GENTLY_USED',
      status: 'ACTIVE',
      priceCents: 90_00,
      publishedAt: new Date('2026-10-06T15:00:00.000Z'),
      pickup: guadalajaraPickup,
    },
  ];

  for (const listing of listingsToSeed) {
    await prisma.listing.upsert({
      where: { id: listing.id },
      update: {},
      create: {
        id: listing.id,
        sellerId: listing.sellerId,
        categoryId: listing.categoryId,
        title: listing.title,
        description: listing.description,
        condition: listing.condition,
        priceCents: listing.priceCents,
        status: listing.status,
        publishedAt: listing.publishedAt,
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
        ...listing.pickup,
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
