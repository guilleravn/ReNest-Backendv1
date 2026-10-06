import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListingsService } from './listings.service.js';

const SELLER_ID = '018f6e5c-0000-7000-8000-000000000001';
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

describe('ListingsService', () => {
  let service: ListingsService;
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
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ListingsService);
  });

  describe('findAllForSeller', () => {
    it('returns only the seller listings with the given status when a status is given', async () => {
      const row = buildListingRow({ status: 'ACTIVE' });
      prisma.listing.findMany.mockResolvedValue([row]);
      prisma.listing.count.mockResolvedValue(1);

      const result = await service.findAllForSeller(SELLER_ID, {
        status: 'ACTIVE',
        ...FIRST_PAGE,
      });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sellerId: SELLER_ID, status: 'ACTIVE' },
          skip: 0,
          take: 20,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
      expect(prisma.listing.count).toHaveBeenCalledWith({
        where: { sellerId: SELLER_ID, status: 'ACTIVE' },
      });
      expect(result).toEqual({
        data: [
          {
            id: row.id,
            title: row.title,
            priceCents: row.priceCents,
            photoUrl: 'listings/101/photo-0.jpg',
            status: 'ACTIVE',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      });
    });

    it('returns all of the seller listings when no status is given', async () => {
      prisma.listing.findMany.mockResolvedValue([
        buildListingRow({ status: 'ACTIVE' }),
        buildListingRow({ id: 'id-2', status: 'PENDING' }),
      ]);
      prisma.listing.count.mockResolvedValue(2);

      const result = await service.findAllForSeller(SELLER_ID, FIRST_PAGE);

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sellerId: SELLER_ID } }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('returns an empty data array when the seller has no listings in that status', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(0);

      const result = await service.findAllForSeller(SELLER_ID, {
        status: 'COMPLETED',
        ...FIRST_PAGE,
      });

      expect(result).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
      });
    });

    it('skips the previous pages when a later page is requested', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(7);

      const result = await service.findAllForSeller(SELLER_ID, {
        page: 3,
        pageSize: 5,
      });

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
      expect(result.meta).toEqual({ page: 3, pageSize: 5, total: 7 });
    });

    it('takes the photo with the lowest position as the cover when positions have gaps', async () => {
      prisma.listing.findMany.mockResolvedValue([buildListingRow()]);
      prisma.listing.count.mockResolvedValue(1);

      await service.findAllForSeller(SELLER_ID, FIRST_PAGE);

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            photos: {
              select: { storageKey: true },
              orderBy: { position: 'asc' },
              take: 1,
            },
          }),
        }),
      );
    });

    it('returns a null photoUrl when the listing has no photo', async () => {
      prisma.listing.findMany.mockResolvedValue([
        buildListingRow({ photos: [] }),
      ]);
      prisma.listing.count.mockResolvedValue(1);

      const result = await service.findAllForSeller(SELLER_ID, FIRST_PAGE);

      expect(result.data[0]?.photoUrl).toBeNull();
    });
  });
});
