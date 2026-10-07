import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { SEEDED_SELLER_ID } from '../src/auth/current-user.decorator.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// The feed is global (every ACTIVE listing in the database, the seed's included), so every search
// below includes a token unique to this run (every fixture title ends with it): it scopes the
// results to this suite's own fixtures.

describe('GET /feed (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const runId = randomUUID();
  const token = `feede2e${runId.slice(0, 8)}`;
  const categoryId = randomUUID();
  const categorySlug = `feed-e2e-${runId}`;
  const categoryName = `Feed e2e ${runId}`;
  const sellerId = randomUUID();
  const createdListingIds: string[] = [];

  type Status = 'ACTIVE' | 'PENDING' | 'COMPLETED';

  const createListing = async (fixture: {
    sellerId?: string;
    title: string;
    status?: Status;
    description?: string;
    priceCents?: number;
    publishedAt: string;
    photoPositions?: number[];
  }): Promise<string> => {
    const id = randomUUID();
    await prisma.listing.create({
      data: {
        id,
        sellerId: fixture.sellerId ?? sellerId,
        categoryId,
        title: fixture.title,
        description: fixture.description ?? null,
        condition: 'GENTLY_USED',
        priceCents: fixture.priceCents ?? 100_00,
        status: fixture.status ?? 'ACTIVE',
        publishedAt: new Date(fixture.publishedAt),
        photos: {
          create: (fixture.photoPositions ?? [0]).map((position) => ({
            storageKey: `listings/${id}/photo-${position}.jpg`,
            position,
          })),
        },
      },
    });
    createdListingIds.push(id);
    return id;
  };

  const search = (query: string) =>
    request(app.getHttpServer()).get(`/feed?${query}`);
  const q = (text: string): string => `q=${encodeURIComponent(text)}`;
  const ids = (body: { data: Array<{ id: string }> }): string[] =>
    body.data.map((listing) => listing.id);

  let leatherArmchairId: string;
  let oakArmchairId: string;
  let deskLampId: string;
  let percentTitleId: string;
  let percentLookalikeId: string;
  let underscoreTitleId: string;
  let underscoreLookalikeId: string;
  let backslashTitleId: string;
  let backslashLookalikeId: string;
  let noPhotoId: string;
  let pendingArmchairId: string;
  let completedArmchairId: string;
  let ownListingId: string;

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
        city: 'Ciudad de México',
      },
    });
    await prisma.category.create({
      data: { id: categoryId, name: categoryName, slug: categorySlug },
    });

    leatherArmchairId = await createListing({
      title: `Leather Armchair ${token}`,
      description: 'Brown leather, solid frame.',
      priceCents: 180_00,
      publishedAt: '2026-01-03T00:00:00.000Z',
      photoPositions: [2, 1],
    });
    oakArmchairId = await createListing({
      title: `Oak armchair ${token}`,
      publishedAt: '2026-01-02T00:00:00.000Z',
    });
    deskLampId = await createListing({
      title: `Desk lamp ${token}`,
      // Only the description mentions the word searched for in the description test.
      description: `Pairs well with a ${token}zebrawood desk.`,
      publishedAt: '2026-01-01T00:00:00.000Z',
    });
    percentTitleId = await createListing({
      title: `50% off rug ${token}`,
      publishedAt: '2026-01-04T00:00:00.000Z',
    });
    percentLookalikeId = await createListing({
      title: `50 cm off rug ${token}`,
      publishedAt: '2026-01-05T00:00:00.000Z',
    });
    underscoreTitleId = await createListing({
      title: `a_b cable ${token}`,
      publishedAt: '2026-01-06T00:00:00.000Z',
    });
    underscoreLookalikeId = await createListing({
      title: `axb cable ${token}`,
      publishedAt: '2026-01-07T00:00:00.000Z',
    });
    backslashTitleId = await createListing({
      title: `c\\d plug ${token}`,
      publishedAt: '2025-12-30T00:00:00.000Z',
    });
    backslashLookalikeId = await createListing({
      title: `cd plug ${token}`,
      publishedAt: '2025-12-31T00:00:00.000Z',
    });
    noPhotoId = await createListing({
      title: `Photoless stool ${token}`,
      publishedAt: '2026-01-08T00:00:00.000Z',
      photoPositions: [],
    });
    pendingArmchairId = await createListing({
      title: `Reserved armchair ${token}`,
      status: 'PENDING',
      publishedAt: '2026-01-09T00:00:00.000Z',
    });
    completedArmchairId = await createListing({
      title: `Sold armchair ${token}`,
      status: 'COMPLETED',
      publishedAt: '2026-01-10T00:00:00.000Z',
    });

    // The feed is not scoped by user: the current user's (SEEDED_SELLER_ID) ACTIVE listings show
    // too. Same id and email as prisma/seed.ts, so whichever runs first, the other reuses the row.
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
    ownListingId = await createListing({
      sellerId: SEEDED_SELLER_ID,
      title: `Own wardrobe ${token}`,
      publishedAt: '2025-12-01T00:00:00.000Z',
    });
  });

  afterAll(async () => {
    await prisma.listing.deleteMany({
      where: { id: { in: createdListingIds } },
    });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.delete({ where: { id: sellerId } });
    await app.close();
  });

  it('returns the matching ACTIVE listings with the card fields, newest first, when q matches', async () => {
    const response = await search(q(`armchair ${token}`)).expect(200);

    expect(response.body).toEqual({
      data: [
        {
          id: leatherArmchairId,
          title: `Leather Armchair ${token}`,
          priceCents: 180_00,
          photoUrl: `listings/${leatherArmchairId}/photo-1.jpg`,
          category: { slug: categorySlug, name: categoryName },
          publishedAt: '2026-01-03T00:00:00.000Z',
        },
        {
          id: oakArmchairId,
          title: `Oak armchair ${token}`,
          priceCents: 100_00,
          photoUrl: `listings/${oakArmchairId}/photo-0.jpg`,
          category: { slug: categorySlug, name: categoryName },
          publishedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 2 },
    });
  });

  it('excludes PENDING and COMPLETED listings when their title matches q', async () => {
    const response = await search(`q=${token}`).expect(200);

    expect(ids(response.body)).not.toContain(pendingArmchairId);
    expect(ids(response.body)).not.toContain(completedArmchairId);
    expect(response.body.meta.total).toBe(11);
  });

  it('matches a partial word regardless of case when q is a fragment in another case', async () => {
    const response = await search(
      q(`ATHER ARMCHAIR ${token.toUpperCase()}`),
    ).expect(200);

    expect(ids(response.body)).toEqual([leatherArmchairId]);
  });

  it('trims q before matching when it has surrounding spaces', async () => {
    const response = await search(q(`   desk lamp ${token}  `)).expect(200);

    expect(ids(response.body)).toEqual([deskLampId]);
  });

  it('does not match a word that only appears in the description', async () => {
    const response = await search(q(`${token}zebrawood`)).expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    });
  });

  it('returns 200 with an empty data array when nothing matches', async () => {
    const response = await search(q(`no-such-item ${token}`)).expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    });
  });

  it('matches % literally instead of as a wildcard', async () => {
    const response = await search(q(`50% off rug ${token}`)).expect(200);

    expect(ids(response.body)).toEqual([percentTitleId]);
    expect(ids(response.body)).not.toContain(percentLookalikeId);
  });

  it('matches _ literally instead of as a single-character wildcard', async () => {
    const response = await search(q(`a_b cable ${token}`)).expect(200);

    expect(ids(response.body)).toEqual([underscoreTitleId]);
    expect(ids(response.body)).not.toContain(underscoreLookalikeId);
  });

  it('matches a backslash literally instead of as an escape character', async () => {
    const response = await search(q(`c\\d plug ${token}`)).expect(200);

    expect(ids(response.body)).toEqual([backslashTitleId]);
    expect(ids(response.body)).not.toContain(backslashLookalikeId);
  });

  it('returns a null photoUrl when the listing has no photo', async () => {
    const response = await search(q(`photoless stool ${token}`)).expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({ id: noPhotoId, photoUrl: null }),
    ]);
  });

  // Unscoped by design: the total is checked against the DB count, so the test holds however
  // many ACTIVE rows the database has (no reliance on them fitting in one page).
  it('returns every ACTIVE listing, newest first, when q is missing or blank', async () => {
    const activeTotal = await prisma.listing.count({
      where: { status: 'ACTIVE' },
    });

    for (const query of ['', 'q=', `q=${encodeURIComponent('   ')}`]) {
      const response = await search(query).expect(200);

      expect(response.body.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: activeTotal,
      });
      const publishedAts = (
        response.body.data as Array<{ publishedAt: string }>
      ).map((listing) => listing.publishedAt);
      expect(publishedAts).toEqual([...publishedAts].sort().reverse());
    }
  });

  it('returns the requested page and the full total when page and pageSize are given', async () => {
    const response = await search(`q=${token}&page=2&pageSize=3`).expect(200);

    // ACTIVE fixtures newest first: no-photo, axb, a_b, | 50 cm, 50%, leather, | oak, desk, cd, | c\d, own.
    expect(ids(response.body)).toEqual([
      percentLookalikeId,
      percentTitleId,
      leatherArmchairId,
    ]);
    expect(response.body.meta).toEqual({ page: 2, pageSize: 3, total: 11 });
  });

  it('returns 200 with an empty data array and the full total when page is past the last one', async () => {
    const response = await search(`q=${token}&page=5&pageSize=3`).expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 5, pageSize: 3, total: 11 },
    });
  });

  it("includes the current user's own ACTIVE listings when their title matches q", async () => {
    const response = await search(q(`own wardrobe ${token}`)).expect(200);

    expect(ids(response.body)).toEqual([ownListingId]);
  });

  it('returns 200 when q is 120 characters after trimming its surrounding spaces', async () => {
    await search(q(`  ${'a'.repeat(120)}  `)).expect(200);
  });

  it.each([
    ['a NUL character', 'q=lamp%00'],
    ['a line feed', 'q=a%0Ab'],
    ['a tab between words', 'q=desk%09lamp'],
    ['the unit separator (U+001F)', 'q=a%1Fb'],
    ['DEL (U+007F)', 'q=a%7Fb'],
  ])(
    'returns 400 with the standard validation error body when q contains %s',
    async (_character, query) => {
      const response = await search(query).expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: ['q must not contain control characters'],
      });
    },
  );

  it('returns 200 when q has a control character only at its ends, since trimming removes it', async () => {
    const response = await search(`q=%0Adesk%20lamp%20${token}%09`).expect(200);

    expect(ids(response.body)).toEqual([deskLampId]);
  });

  it('returns 200 when q has accented letters or symbols outside the control range', async () => {
    const response = await search(q(`lámpara € ✓ ${token}`)).expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    });
  });

  it('returns 200 when q is exactly 120 characters', async () => {
    await search(`q=${'a'.repeat(120)}`).expect(200);
  });

  describe('invalid query', () => {
    it.each([
      ['q is longer than 120 characters', `q=${'a'.repeat(121)}`],
      ['q is sent twice', 'q=lamp&q=desk'],
      ['page is 0', 'page=0'],
      ['page is not an integer', 'page=1.5'],
      ['pageSize is above the maximum', 'pageSize=101'],
      ['an unknown param is sent', 'status=PENDING'],
    ])('returns 400 when %s', async (_condition, query) => {
      await search(query).expect(400);
    });
  });
});
