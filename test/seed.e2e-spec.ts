// Runs the real seed (`npm run db:seed`) against the local Postgres. The seed only upserts its own
// synthetic rows, so running it here leaves the dev database in the same state as `db:seed`.
import { execSync } from 'node:child_process';

import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';

import {
  OTHER_SELLER_ID,
  SEED_LISTING_IDS,
  SEEDED_SELLER_ID,
} from '../prisma/seed-fixtures.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { USER_ZONES, type UserZone } from '../src/users/user-zones.js';

const SEED_SLUGS = ['electronics', 'furniture', 'home'];
const SEED_EMAILS = [
  'camila@renest.test',
  'samuel@renest.test',
  'tomas@renest.test',
  'valentina@renest.test',
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

  it('gives every account a city from the zones list', async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: SEED_EMAILS } },
      select: { city: true },
    });

    expect(users).toHaveLength(SEED_EMAILS.length);
    for (const { city } of users) {
      expect(USER_ZONES).toContain(city as UserZone);
    }
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

  it('creates one listing per status for the current seller and one for the other seller, each with a cover photo and a pickup option', async () => {
    const listings = await prisma.listing.findMany({
      where: { id: { in: Object.values(SEED_LISTING_IDS) } },
      select: {
        id: true,
        sellerId: true,
        status: true,
        photos: { select: { position: true } },
        _count: { select: { pickupOptions: true } },
      },
      orderBy: { id: 'asc' },
    });

    const expected = (
      id: string,
      sellerId: string,
      status: 'ACTIVE' | 'PENDING' | 'COMPLETED',
    ) => ({
      id,
      sellerId,
      status,
      photos: [{ position: 0 }],
      _count: { pickupOptions: 1 },
    });
    expect(listings).toEqual([
      expected(SEED_LISTING_IDS.active, SEEDED_SELLER_ID, 'ACTIVE'),
      expected(SEED_LISTING_IDS.pending, SEEDED_SELLER_ID, 'PENDING'),
      expected(SEED_LISTING_IDS.completed, SEEDED_SELLER_ID, 'COMPLETED'),
      expected(SEED_LISTING_IDS.otherSellerActive, OTHER_SELLER_ID, 'ACTIVE'),
    ]);
  });
});
