import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { FeedService } from './feed.service.js';

const FIRST_PAGE = { page: 1, pageSize: 20 };

function buildListingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '018f6e5c-0000-7000-8000-000000000101',
    title: 'Wooden dining table',
    priceCents: 25000,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    photos: [{ storageKey: 'listings/101/photo-0.jpg' }],
    ...overrides,
  };
}

describe('FeedService', () => {
  let service: FeedService;
  let prisma: {
    listing: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      listing: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FeedService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(FeedService);
  });

  describe('findAll', () => {
    it('scopes the query to ACTIVE listings only when no filter is given', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(0);

      await service.findAll(FIRST_PAGE);

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ACTIVE' } }),
      );
      expect(prisma.listing.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
    });

    it('filters by category slug alone when only category is given', async () => {
      prisma.listing.findMany.mockResolvedValue([buildListingRow()]);
      prisma.listing.count.mockResolvedValue(1);

      await service.findAll({ category: 'furniture', ...FIRST_PAGE });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE', category: { slug: 'furniture' } },
        }),
      );
    });

    it('filters by a case-insensitive title search alone when only search is given', async () => {
      prisma.listing.findMany.mockResolvedValue([buildListingRow()]);
      prisma.listing.count.mockResolvedValue(1);

      await service.findAll({ search: 'table', ...FIRST_PAGE });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'ACTIVE',
            title: { contains: 'table', mode: 'insensitive' },
          },
        }),
      );
    });

    it('escapes LIKE wildcard characters in the search so they match literally', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(0);

      await service.findAll({ search: 'P_ged%lamp\\desk', ...FIRST_PAGE });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'ACTIVE',
            title: {
              contains: 'P\\_ged\\%lamp\\\\desk',
              mode: 'insensitive',
            },
          },
        }),
      );
    });

    it('combines the category and search filters when both are given', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(0);

      await service.findAll({
        category: 'electronics',
        search: 'laptop',
        ...FIRST_PAGE,
      });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'ACTIVE',
            category: { slug: 'electronics' },
            title: { contains: 'laptop', mode: 'insensitive' },
          },
        }),
      );
    });

    it('returns an empty data array without a 400 when the category slug matches no category', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(0);

      const result = await service.findAll({
        category: 'not-a-real-category',
        ...FIRST_PAGE,
      });

      expect(result).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      });
    });

    it('still paginates correctly when filters are applied', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(45);

      const result = await service.findAll({
        category: 'furniture',
        page: 3,
        pageSize: 10,
      });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta).toEqual({ page: 3, pageSize: 10, total: 45 });
    });

    it('never includes PENDING or COMPLETED listings regardless of the filters given', async () => {
      prisma.listing.findMany.mockResolvedValue([buildListingRow()]);
      prisma.listing.count.mockResolvedValue(1);

      await service.findAll({
        category: 'furniture',
        search: 'table',
        ...FIRST_PAGE,
      });

      const where = prisma.listing.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('ACTIVE');
    });

    it('maps each row to the shared listing response shape', async () => {
      prisma.listing.findMany.mockResolvedValue([buildListingRow()]);
      prisma.listing.count.mockResolvedValue(1);

      const result = await service.findAll(FIRST_PAGE);

      expect(result).toEqual({
        data: [
          {
            id: '018f6e5c-0000-7000-8000-000000000101',
            title: 'Wooden dining table',
            priceCents: 25000,
            photoUrl: 'listings/101/photo-0.jpg',
            status: 'ACTIVE',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      });
    });

    it('returns a null photoUrl when the listing has no photo', async () => {
      prisma.listing.findMany.mockResolvedValue([
        buildListingRow({ photos: [] }),
      ]);
      prisma.listing.count.mockResolvedValue(1);

      const result = await service.findAll(FIRST_PAGE);

      expect(result.data[0]?.photoUrl).toBeNull();
    });
  });
});
