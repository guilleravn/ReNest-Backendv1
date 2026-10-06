// Runs the real seed (`npm run db:seed`) against the local Postgres. The seed only upserts its own
// synthetic rows, so running it here leaves the dev database in the same state as `db:seed`.
import { execSync } from 'node:child_process';

import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { AppModule } from '../src/app.module.js';
import { SEEDED_SELLER_ID } from '../src/auth/current-user.decorator.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const SEED_SLUGS = ['electronics', 'furniture', 'home'];
const SEED_EMAILS = [
  'camila@renest.test',
  'samuel@renest.test',
  'tomas@renest.test',
  'valentina@renest.test',
];
const OTHER_SELLER_ID = '018f6e5c-0000-7000-8000-000000000002';
const SEED_LISTING_IDS = [
  '018f6e5c-0000-7000-8000-000000000101',
  '018f6e5c-0000-7000-8000-000000000102',
  '018f6e5c-0000-7000-8000-000000000103',
  '018f6e5c-0000-7000-8000-000000000104',
];
const SEED_TIMEOUT_MS = 60_000;

const runSeed = (): void => {
  execSync('npm run --silent db:seed', { stdio: 'pipe' });
};

describe('Seed (e2e)', () => {
  let prisma: PrismaService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();
    prisma = app.get(PrismaService);

    // Twice in a row: the second run must neither fail nor duplicate rows.
    runSeed();
    runSeed();
  }, 2 * SEED_TIMEOUT_MS);

  afterAll(async () => {
    await close();
  });

  it('creates exactly the three categories once when run twice', async () => {
    const categories = await prisma.category.findMany({
      where: { slug: { in: SEED_SLUGS } },
      select: { slug: true, name: true },
      orderBy: { slug: 'asc' },
    });

    expect(categories).toEqual([
      { slug: 'electronics', name: 'Electrónica' },
      { slug: 'furniture', name: 'Muebles' },
      { slug: 'home', name: 'Hogar' },
    ]);
  });

  it('creates exactly the four accounts once when run twice', async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: SEED_EMAILS } },
      select: { email: true, phoneE164: true, isVerified: true },
      orderBy: { email: 'asc' },
    });

    expect(users).toEqual([
      {
        email: 'camila@renest.test',
        phoneE164: '+525500000003',
        isVerified: false,
      },
      {
        email: 'samuel@renest.test',
        phoneE164: '+525500000001',
        isVerified: true,
      },
      { email: 'tomas@renest.test', phoneE164: null, isVerified: false },
      {
        email: 'valentina@renest.test',
        phoneE164: '+525500000002',
        isVerified: false,
      },
    ]);
  });

  it('sets verifiedAt only on the verified account', async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: SEED_EMAILS } },
      select: { email: true, verifiedAt: true },
      orderBy: { email: 'asc' },
    });

    expect(users).toEqual([
      { email: 'camila@renest.test', verifiedAt: null },
      {
        email: 'samuel@renest.test',
        verifiedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
      { email: 'tomas@renest.test', verifiedAt: null },
      { email: 'valentina@renest.test', verifiedAt: null },
    ]);
  });

  it('stores an argon2id hash of SEED_USER_PASSWORD, never the plain password', async () => {
    const password = process.env['SEED_USER_PASSWORD'] ?? '';
    const users = await prisma.user.findMany({
      where: { email: { in: SEED_EMAILS } },
      select: { passwordHash: true },
    });

    expect(users).toHaveLength(SEED_EMAILS.length);
    for (const { passwordHash } of users) {
      expect(passwordHash).not.toBe(password);
      expect(passwordHash).toMatch(/^\$argon2id\$/);
      await expect(argon2.verify(passwordHash, password)).resolves.toBe(true);
    }
  });

  it('gives Samuel the current-seller id and Valentina the other-seller id', async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: ['samuel@renest.test', 'valentina@renest.test'] } },
      select: { email: true, id: true },
      orderBy: { email: 'asc' },
    });

    expect(users).toEqual([
      { email: 'samuel@renest.test', id: SEEDED_SELLER_ID },
      { email: 'valentina@renest.test', id: OTHER_SELLER_ID },
    ]);
  });

  it('creates one listing per status for the current seller and one for the other seller, each with a cover photo', async () => {
    const listings = await prisma.listing.findMany({
      where: { id: { in: SEED_LISTING_IDS } },
      select: {
        id: true,
        sellerId: true,
        status: true,
        photos: { select: { position: true } },
      },
      orderBy: { id: 'asc' },
    });

    expect(listings).toEqual([
      {
        id: SEED_LISTING_IDS[0],
        sellerId: SEEDED_SELLER_ID,
        status: 'ACTIVE',
        photos: [{ position: 0 }],
      },
      {
        id: SEED_LISTING_IDS[1],
        sellerId: SEEDED_SELLER_ID,
        status: 'PENDING',
        photos: [{ position: 0 }],
      },
      {
        id: SEED_LISTING_IDS[2],
        sellerId: SEEDED_SELLER_ID,
        status: 'COMPLETED',
        photos: [{ position: 0 }],
      },
      {
        id: SEED_LISTING_IDS[3],
        sellerId: OTHER_SELLER_ID,
        status: 'ACTIVE',
        photos: [{ position: 0 }],
      },
    ]);
  });
});
