// Runs the real seed (`npm run db:seed`) against the local Postgres. The seed only upserts its own
// synthetic rows, so running it here leaves the dev database in the same state as `db:seed`.
import { execSync } from 'node:child_process';

import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const SEED_SLUGS = ['electronics', 'furniture', 'home'];
const SEED_EMAILS = [
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

  it('creates exactly the three accounts once when run twice', async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: SEED_EMAILS } },
      select: { email: true, phoneE164: true, isVerified: true },
      orderBy: { email: 'asc' },
    });

    expect(users).toEqual([
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
});
