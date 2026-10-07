import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('GET /feed (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const runId = randomUUID();
  const sellerId = randomUUID();
  const furnitureCategoryId = randomUUID();
  const electronicsCategoryId = randomUUID();
  const createdListingIds: string[] = [];

  type Status = 'ACTIVE' | 'PENDING' | 'COMPLETED';

  const createListing = async (fixture: {
    categoryId: string;
    title: string;
    status: Status;
    priceCents: number;
    createdAt: string;
  }): Promise<string> => {
    const id = randomUUID();
    await prisma.listing.create({
      data: {
        id,
        sellerId,
        categoryId: fixture.categoryId,
        title: fixture.title,
        condition: 'GENTLY_USED',
        priceCents: fixture.priceCents,
        status: fixture.status,
        createdAt: new Date(fixture.createdAt),
        photos: {
          create: [{ storageKey: `listings/${id}/photo-0.jpg`, position: 0 }],
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

    await prisma.user.create({
      data: {
        id: sellerId,
        email: `feed-seller-${runId}@renest.test`,
        passwordHash: 'not-a-real-hash',
        fullName: 'Feed Seller',
        city: 'Monterrey',
      },
    });
    await prisma.category.create({
      data: {
        id: furnitureCategoryId,
        name: `Feed furniture ${runId}`,
        slug: `feed-furniture-${runId}`,
      },
    });
    await prisma.category.create({
      data: {
        id: electronicsCategoryId,
        name: `Feed electronics ${runId}`,
        slug: `feed-electronics-${runId}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.listing.deleteMany({
      where: { id: { in: createdListingIds } },
    });
    await prisma.category.delete({ where: { id: furnitureCategoryId } });
    await prisma.category.delete({ where: { id: electronicsCategoryId } });
    await prisma.user.delete({ where: { id: sellerId } });
    await app.close();
  });

  describe('when listings exist in every status and category', () => {
    let activeFurnitureId: string;
    let activeElectronicsId: string;

    beforeAll(async () => {
      activeFurnitureId = await createListing({
        categoryId: furnitureCategoryId,
        title: `Wooden chair ${runId}`,
        status: 'ACTIVE',
        priceCents: 100_00,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      await createListing({
        categoryId: furnitureCategoryId,
        title: `Reserved table ${runId}`,
        status: 'PENDING',
        priceCents: 200_00,
        createdAt: '2026-01-02T00:00:00.000Z',
      });
      await createListing({
        categoryId: furnitureCategoryId,
        title: `Sold bookshelf ${runId}`,
        status: 'COMPLETED',
        priceCents: 300_00,
        createdAt: '2026-01-03T00:00:00.000Z',
      });
      activeElectronicsId = await createListing({
        categoryId: electronicsCategoryId,
        title: `Laptop ${runId}`,
        status: 'ACTIVE',
        priceCents: 400_00,
        createdAt: '2026-01-04T00:00:00.000Z',
      });
    });

    it('returns only ACTIVE listings across every category when no filter is given', async () => {
      const response = await request(app.getHttpServer())
        .get(`/feed?search=${encodeURIComponent(runId)}`)
        .expect(200);

      const ids = (response.body.data as Array<{ id: string }>).map(
        (listing) => listing.id,
      );
      expect(ids.sort()).toEqual(
        [activeFurnitureId, activeElectronicsId].sort(),
      );
    });

    it('filters by category slug', async () => {
      const furnitureSlug = `feed-furniture-${runId}`;
      const response = await request(app.getHttpServer())
        .get(`/feed?category=${furnitureSlug}`)
        .expect(200);

      const ids = (response.body.data as Array<{ id: string }>).map(
        (listing) => listing.id,
      );
      expect(ids).toEqual([activeFurnitureId]);
    });

    it('filters by a case-insensitive title search', async () => {
      const response = await request(app.getHttpServer())
        .get(`/feed?search=${encodeURIComponent(`LAPTOP ${runId}`)}`)
        .expect(200);

      const ids = (response.body.data as Array<{ id: string }>).map(
        (listing) => listing.id,
      );
      expect(ids).toEqual([activeElectronicsId]);
    });

    it('returns an empty data array, not an error, when category and search combined match nothing', async () => {
      const furnitureSlug = `feed-furniture-${runId}`;
      const response = await request(app.getHttpServer())
        .get(
          `/feed?category=${furnitureSlug}&search=${encodeURIComponent(`laptop ${runId}`)}`,
        )
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      });
    });

    it('returns an empty data array, not a 400, when the category slug matches no category', async () => {
      const response = await request(app.getHttpServer())
        .get('/feed?category=not-a-real-category')
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      });
    });
  });

  describe('when a category has several ACTIVE listings', () => {
    const pagedCategoryId = randomUUID();
    const pagedSlug = `feed-paged-${runId}`;
    let oldestId: string;
    let middleId: string;
    let newestId: string;
    let pendingId: string;
    let completedId: string;

    beforeAll(async () => {
      await prisma.category.create({
        data: {
          id: pagedCategoryId,
          name: `Feed paged ${runId}`,
          slug: pagedSlug,
        },
      });
      oldestId = await createListing({
        categoryId: pagedCategoryId,
        title: `Paged lamp ${runId}`,
        status: 'ACTIVE',
        priceCents: 10_00,
        createdAt: '2026-02-01T00:00:00.000Z',
      });
      middleId = await createListing({
        categoryId: pagedCategoryId,
        title: `Paged rug ${runId}`,
        status: 'ACTIVE',
        priceCents: 20_00,
        createdAt: '2026-02-02T00:00:00.000Z',
      });
      newestId = await createListing({
        categoryId: pagedCategoryId,
        title: `Paged mirror ${runId}`,
        status: 'ACTIVE',
        priceCents: 30_00,
        createdAt: '2026-02-03T00:00:00.000Z',
      });
      pendingId = await createListing({
        categoryId: pagedCategoryId,
        title: `Paged reserved vase ${runId}`,
        status: 'PENDING',
        priceCents: 40_00,
        createdAt: '2026-02-04T00:00:00.000Z',
      });
      completedId = await createListing({
        categoryId: pagedCategoryId,
        title: `Paged sold clock ${runId}`,
        status: 'COMPLETED',
        priceCents: 50_00,
        createdAt: '2026-02-05T00:00:00.000Z',
      });
    });

    afterAll(async () => {
      await prisma.listing.deleteMany({
        where: { categoryId: pagedCategoryId },
      });
      await prisma.category.delete({ where: { id: pagedCategoryId } });
    });

    it('returns the full listing card shape, newest first, when filtering by category', async () => {
      const response = await request(app.getHttpServer())
        .get(`/feed?category=${pagedSlug}`)
        .expect(200);

      const card = (
        id: string,
        title: string,
        priceCents: number,
        createdAt: string,
      ) => ({
        id,
        title,
        priceCents,
        photoUrl: `listings/${id}/photo-0.jpg`,
        status: 'ACTIVE',
        createdAt,
      });
      expect(response.body).toEqual({
        data: [
          card(
            newestId,
            `Paged mirror ${runId}`,
            30_00,
            '2026-02-03T00:00:00.000Z',
          ),
          card(
            middleId,
            `Paged rug ${runId}`,
            20_00,
            '2026-02-02T00:00:00.000Z',
          ),
          card(
            oldestId,
            `Paged lamp ${runId}`,
            10_00,
            '2026-02-01T00:00:00.000Z',
          ),
        ],
        meta: { page: 1, pageSize: 20, total: 3 },
      });
    });

    it('returns the requested page and the filtered ACTIVE total when page and pageSize are given', async () => {
      const response = await request(app.getHttpServer())
        .get(`/feed?category=${pagedSlug}&page=2&pageSize=2`)
        .expect(200);

      const ids = (response.body.data as Array<{ id: string }>).map(
        (listing) => listing.id,
      );
      expect(ids).toEqual([oldestId]);
      expect(response.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
    });

    it('returns only ACTIVE listings when no filter at all is given', async () => {
      const response = await request(app.getHttpServer())
        .get('/feed?pageSize=100')
        .expect(200);

      const listings = response.body.data as Array<{
        id: string;
        status: string;
      }>;
      expect(listings.length).toBeGreaterThan(0);
      expect(listings.every((listing) => listing.status === 'ACTIVE')).toBe(
        true,
      );
      const ids = listings.map((listing) => listing.id);
      expect(ids).not.toContain(pendingId);
      expect(ids).not.toContain(completedId);
    });

    it('does not return a PENDING or COMPLETED listing when the search matches its title exactly', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/feed?category=${pagedSlug}&search=${encodeURIComponent(`Paged reserved vase ${runId}`)}`,
        )
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      });
    });

    it('treats LIKE wildcards in the search literally when the search contains % or _', async () => {
      const wildcardSearches = [`P_ged lamp ${runId}`, `Paged%lamp ${runId}`];

      for (const search of wildcardSearches) {
        const response = await request(app.getHttpServer())
          .get(
            `/feed?category=${pagedSlug}&search=${encodeURIComponent(search)}`,
          )
          .expect(200);

        expect(response.body.data).toEqual([]);
      }
    });
  });

  describe('when a listing title contains literal %, _ and \\ characters', () => {
    const literalCategoryId = randomUUID();
    const literalSlug = `feed-literal-${runId}`;
    let literalId: string;

    beforeAll(async () => {
      await prisma.category.create({
        data: {
          id: literalCategoryId,
          name: `Feed literal ${runId}`,
          slug: literalSlug,
        },
      });
      literalId = await createListing({
        categoryId: literalCategoryId,
        title: `Desk 50% off_sale C:\\home ${runId}`,
        status: 'ACTIVE',
        priceCents: 60_00,
        createdAt: '2026-03-01T00:00:00.000Z',
      });
    });

    afterAll(async () => {
      await prisma.listing.deleteMany({
        where: { categoryId: literalCategoryId },
      });
      await prisma.category.delete({ where: { id: literalCategoryId } });
    });

    it.each([
      ['a percent sign', '50% off'],
      ['an underscore', 'off_sale'],
      ['a backslash', 'C:\\home'],
      ['all three together', '50% off_sale C:\\home'],
    ])(
      'still matches the listing when the search contains %s literally',
      async (_condition, search) => {
        const response = await request(app.getHttpServer())
          .get(
            `/feed?category=${literalSlug}&search=${encodeURIComponent(search)}`,
          )
          .expect(200);

        const ids = (response.body.data as Array<{ id: string }>).map(
          (listing) => listing.id,
        );
        expect(ids).toEqual([literalId]);
      },
    );
  });

  describe('invalid query', () => {
    it.each([
      ['category has uppercase letters', 'category=Furniture'],
      ['category has spaces', 'category=home%20goods'],
      ['category is empty', 'category='],
      ['category is sent twice', 'category=home&category=furniture'],
      ['search is empty', 'search='],
      ['search is longer than 100 characters', `search=${'a'.repeat(101)}`],
      ['page is 0', 'page=0'],
      ['page is not an integer', 'page=1.5'],
      ['pageSize is above the maximum', 'pageSize=101'],
      ['an unknown param is sent', 'status=ACTIVE'],
      ['a seller scope is sent', 'sellerId=someone'],
    ])('returns 400 when %s', async (_condition, query) => {
      await request(app.getHttpServer()).get(`/feed?${query}`).expect(400);
    });
  });
});
