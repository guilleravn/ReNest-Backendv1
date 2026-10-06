import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SEEDED_SELLER_ID } from '../src/auth/current-seller.js';

// Requires a real Postgres (`npm run db:up`) with the BO-40 migration
// applied. Not run by this agent: it needs a live database. GET /listings
// always scopes to SEEDED_SELLER_ID (no login yet, see src/auth/current-seller.ts),
// so this suite seeds its own, deterministic fixtures for that exact seller
// instead of relying on `prisma/seed.ts` having run.

describe('GET /listings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const categoryId = randomUUID();
  const otherSellerId = randomUUID();
  const activeListingId = randomUUID();
  const pendingListingId = randomUUID();
  const otherSellerListingId = randomUUID();
  const otherSellerListingTitle = 'Another seller listing (e2e fixture)';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    // The current seller is fixed (no login yet): make sure the row it
    // points at exists, without assuming prisma/seed.ts already ran.
    await prisma.user.upsert({
      where: { id: SEEDED_SELLER_ID },
      update: {},
      create: {
        id: SEEDED_SELLER_ID,
        email: 'seller-e2e@renest.seed',
        passwordHash: 'seed-only-not-a-real-hash',
        fullName: 'E2E Seeded Seller',
        city: 'Bogota',
      },
    });

    // `prisma/seed.ts` (run for local/manual testing) seeds its own listings
    // for this same fixed SEEDED_SELLER_ID. Clear them so this suite's "no
    // listings in that status" assertion holds regardless of what's already
    // in the DB (testing.md: "tables are cleaned between suites"). Re-run
    // `npx prisma db seed` after this suite if you need that data back — the
    // seed script is idempotent (upsert-based).
    await prisma.listing.deleteMany({ where: { sellerId: SEEDED_SELLER_ID } });

    await prisma.user.create({
      data: {
        id: otherSellerId,
        email: `other-seller-e2e-${otherSellerId}@renest.seed`,
        passwordHash: 'seed-only-not-a-real-hash',
        fullName: 'E2E Other Seller',
        city: 'Medellin',
      },
    });

    await prisma.category.create({
      data: {
        id: categoryId,
        name: `E2E category ${categoryId}`,
        slug: `e2e-category-${categoryId}`,
      },
    });

    // Only ACTIVE and PENDING are created for the current seller, so
    // COMPLETED is the "no listings in this status" case below.
    await prisma.listing.create({
      data: {
        id: activeListingId,
        sellerId: SEEDED_SELLER_ID,
        categoryId,
        title: 'E2E active listing',
        description: 'Fixture for GET /listings e2e tests.',
        condition: 'GENTLY_USED',
        priceCents: 10000,
        currency: 'COP',
        status: 'ACTIVE',
        photos: {
          create: {
            storageKey: `listings/${activeListingId}/photo-0.jpg`,
            position: 0,
          },
        },
      },
    });

    await prisma.listing.create({
      data: {
        id: pendingListingId,
        sellerId: SEEDED_SELLER_ID,
        categoryId,
        title: 'E2E pending listing',
        description: 'Fixture for GET /listings e2e tests.',
        condition: 'GENTLY_USED',
        priceCents: 20000,
        currency: 'COP',
        status: 'PENDING',
        photos: {
          create: {
            storageKey: `listings/${pendingListingId}/photo-0.jpg`,
            position: 0,
          },
        },
      },
    });

    await prisma.listing.create({
      data: {
        id: otherSellerListingId,
        sellerId: otherSellerId,
        categoryId,
        title: otherSellerListingTitle,
        description: 'Fixture for GET /listings e2e tests.',
        condition: 'GENTLY_USED',
        priceCents: 30000,
        currency: 'COP',
        status: 'ACTIVE',
        photos: {
          create: {
            storageKey: `listings/${otherSellerListingId}/photo-0.jpg`,
            position: 0,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.listing.deleteMany({
      where: {
        id: { in: [activeListingId, pendingListingId, otherSellerListingId] },
      },
    });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.delete({ where: { id: otherSellerId } });
    await app.close();
  });

  it('returns only the current seller listings matching the requested status', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings?status=ACTIVE')
      .expect(200);

    const ids = (response.body.data as Array<{ id: string }>).map(
      (listing) => listing.id,
    );
    expect(ids).toContain(activeListingId);
    expect(ids).not.toContain(pendingListingId);
    expect(ids).not.toContain(otherSellerListingId);
  });

  it('returns all of the current seller listings when no status is given', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings')
      .expect(200);

    const ids = (response.body.data as Array<{ id: string }>).map(
      (listing) => listing.id,
    );
    expect(ids).toContain(activeListingId);
    expect(ids).toContain(pendingListingId);
    expect(ids).not.toContain(otherSellerListingId);
  });

  it('returns an empty array when the seller has no listings in that status', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings?status=COMPLETED')
      .expect(200);

    expect(response.body).toEqual({ data: [], meta: { total: 0 } });
  });

  it('never returns another seller listing', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings')
      .expect(200);

    expect(
      (response.body.data as Array<{ title: string }>).some(
        (listing) => listing.title === otherSellerListingTitle,
      ),
    ).toBe(false);
  });

  it('returns 400 for an invalid status value', async () => {
    await request(app.getHttpServer())
      .get('/listings?status=NOT_A_STATUS')
      .expect(400);
  });
});
