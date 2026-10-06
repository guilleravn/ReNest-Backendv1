// Seeds the reference data and the pre-created demo accounts of the MVP (others sign up).
// Idempotent: every row is upserted by a natural key, so it can run after each migration.
// All people below are synthetic (reserved `.test` domain, placeholder phone numbers).
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

import { PrismaClient } from '../generated/prisma/client.js';
import { type UserZone } from '../src/users/user-zones.js';

const MIN_SEED_PASSWORD_LENGTH = 8;

const CATEGORIES = [
  { slug: 'furniture', name: 'Muebles' },
  { slug: 'electronics', name: 'Electrónica' },
  { slug: 'home', name: 'Hogar' },
] as const;

interface SeedUser {
  email: string;
  fullName: string;
  phoneE164: string | null;
  city: UserZone;
  verifiedAt: Date | null;
}

// `city` must be one of USER_ZONES, like any account created through sign-up. `termsAcceptedAt`
// stays NULL: these accounts predate the terms checkbox.
const USERS = [
  {
    email: 'samuel@renest.test',
    fullName: 'Samuel Rojas',
    phoneE164: '+525500000001',
    city: 'Roma Norte, CDMX',
    verifiedAt: new Date('2026-10-01T00:00:00.000Z'),
  },
  {
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

  await prisma.$transaction([
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

  console.log(
    `Seeded ${CATEGORIES.length} categories and ${USERS.length} users`,
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
