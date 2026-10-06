import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SEEDED_SELLER_ID } from '../src/auth/current-user.decorator.js';

// Until BO-39 (login), every request acts as SEEDED_SELLER_ID (see
// src/auth/current-user.decorator.ts), so this suite cannot use a seller of its own: it owns that
// seller's listings for its duration. Replace with a per-suite user once tests can log in.

describe('GET /listings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const runId = randomUUID();
  const categoryId = randomUUID();
  const otherSellerId = randomUUID();
  const createdListingIds: string[] = [];

  type Status = 'ACTIVE' | 'PENDING' | 'COMPLETED';

  const createListing = async (fixture: {
    sellerId: string;
    title: string;
    status: Status;
    priceCents: number;
    createdAt: string;
    photoPositions: number[];
  }): Promise<string> => {
    const id = randomUUID();
    await prisma.listing.create({
      data: {
        id,
        sellerId: fixture.sellerId,
        categoryId,
        title: fixture.title,
        condition: 'GENTLY_USED',
        priceCents: fixture.priceCents,
        status: fixture.status,
        createdAt: new Date(fixture.createdAt),
        photos: {
          create: fixture.photoPositions.map((position) => ({
            storageKey: `listings/${id}/photo-${position}.jpg`,
            position,
          })),
        },
      },
    });
    createdListingIds.push(id);
    return id;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    // Same id and email as prisma/seed.ts, so whichever runs first, the other reuses the row.
    await prisma.user.upsert({
      where: { id: SEEDED_SELLER_ID },
      update: {},
      create: {
        id: SEEDED_SELLER_ID,
        email: 'samuel@renest.test',
        passwordHash: 'not-a-real-hash',
        fullName: 'Samuel Rojas',
        city: 'Ciudad de México',
      },
    });
    // The current seller is fixed, so start from a known state: drop the listings the seed (or
    // an earlier run) gave it. Photos and pickup options cascade.
    await prisma.listing.deleteMany({ where: { sellerId: SEEDED_SELLER_ID } });

    await prisma.user.create({
      data: {
        id: otherSellerId,
        email: `listings-other-seller-${runId}@renest.test`,
        passwordHash: 'not-a-real-hash',
        fullName: 'Other Seller',
        city: 'Guadalajara',
      },
    });
    await prisma.category.create({
      data: {
        id: categoryId,
        name: `Listings e2e ${runId}`,
        slug: `listings-e2e-${runId}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.listing.deleteMany({
      where: { id: { in: createdListingIds } },
    });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.delete({ where: { id: otherSellerId } });
    await app.close();
  });

  describe('when the current seller has no listings', () => {
    it('returns 200 with an empty data array when no listing matches the status', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?status=COMPLETED')
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      });
    });
  });

  describe('when the current seller has listings in every status', () => {
    let olderActiveId: string;
    let pendingId: string;
    let completedId: string;
    let newerActiveId: string;
    let otherSellerListingId: string;

    const card = (
      id: string,
      title: string,
      priceCents: number,
      status: Status,
      createdAt: string,
      coverPosition: number,
    ) => ({
      id,
      title,
      priceCents,
      photoUrl: `listings/${id}/photo-${coverPosition}.jpg`,
      status,
      createdAt,
    });

    beforeAll(async () => {
      olderActiveId = await createListing({
        sellerId: SEEDED_SELLER_ID,
        title: 'Older active listing',
        status: 'ACTIVE',
        priceCents: 100_00,
        createdAt: '2026-01-01T00:00:00.000Z',
        photoPositions: [0, 1],
      });
      pendingId = await createListing({
        sellerId: SEEDED_SELLER_ID,
        title: 'Pending listing',
        status: 'PENDING',
        priceCents: 200_00,
        createdAt: '2026-01-02T00:00:00.000Z',
        photoPositions: [0],
      });
      completedId = await createListing({
        sellerId: SEEDED_SELLER_ID,
        title: 'Completed listing',
        status: 'COMPLETED',
        priceCents: 300_00,
        createdAt: '2026-01-03T00:00:00.000Z',
        photoPositions: [0],
      });
      // No photo at position 0: the cover must still be the lowest position.
      newerActiveId = await createListing({
        sellerId: SEEDED_SELLER_ID,
        title: 'Newer active listing',
        status: 'ACTIVE',
        priceCents: 400_00,
        createdAt: '2026-01-04T00:00:00.000Z',
        photoPositions: [3, 2],
      });
      otherSellerListingId = await createListing({
        sellerId: otherSellerId,
        title: 'Other seller listing',
        status: 'ACTIVE',
        priceCents: 500_00,
        createdAt: '2026-01-05T00:00:00.000Z',
        photoPositions: [0],
      });
    });

    it('returns only the current seller ACTIVE listings, newest first, when status is ACTIVE', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?status=ACTIVE')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          card(
            newerActiveId,
            'Newer active listing',
            400_00,
            'ACTIVE',
            '2026-01-04T00:00:00.000Z',
            2,
          ),
          card(
            olderActiveId,
            'Older active listing',
            100_00,
            'ACTIVE',
            '2026-01-01T00:00:00.000Z',
            0,
          ),
        ],
        meta: { page: 1, pageSize: 20, total: 2 },
      });
    });

    it('returns only the current seller PENDING listings when status is PENDING', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?status=PENDING')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          card(
            pendingId,
            'Pending listing',
            200_00,
            'PENDING',
            '2026-01-02T00:00:00.000Z',
            0,
          ),
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      });
    });

    it('returns only the current seller COMPLETED listings when status is COMPLETED', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?status=COMPLETED')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          card(
            completedId,
            'Completed listing',
            300_00,
            'COMPLETED',
            '2026-01-03T00:00:00.000Z',
            0,
          ),
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      });
    });

    it('returns every current seller listing, newest first and without other sellers, when no status is given', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings')
        .expect(200);

      const ids = (response.body.data as Array<{ id: string }>).map(
        (listing) => listing.id,
      );
      expect(ids).toEqual([
        newerActiveId,
        completedId,
        pendingId,
        olderActiveId,
      ]);
      expect(ids).not.toContain(otherSellerListingId);
      expect(response.body.meta).toEqual({ page: 1, pageSize: 20, total: 4 });
    });

    it('returns the requested page and the full total when page and pageSize are given', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings?status=ACTIVE&page=2&pageSize=1')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          card(
            olderActiveId,
            'Older active listing',
            100_00,
            'ACTIVE',
            '2026-01-01T00:00:00.000Z',
            0,
          ),
        ],
        meta: { page: 2, pageSize: 1, total: 2 },
      });
    });
  });

  describe('invalid query', () => {
    it.each([
      ['status is not a listing status', 'status=NOT_A_STATUS'],
      ['page is 0', 'page=0'],
      ['page is not an integer', 'page=1.5'],
      ['pageSize is above the maximum', 'pageSize=101'],
      ['an unknown param is sent', 'sellerId=someone-else'],
    ])('returns 400 when %s', async (_condition, query) => {
      await request(app.getHttpServer()).get(`/listings?${query}`).expect(400);
    });
  });
});
