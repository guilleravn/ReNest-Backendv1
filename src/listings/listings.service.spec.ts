import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListingsService } from './listings.service.js';

const SELLER_ID = '018f6e5c-0000-7000-8000-000000000001';

function buildListingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '018f6e5c-0000-7000-8000-000000000101',
    title: 'Wooden dining table',
    priceCents: 2500000,
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
    it('returns only the current seller listings matching the given status', async () => {
      const row = buildListingRow({ status: 'ACTIVE' });
      prisma.listing.findMany.mockResolvedValue([row]);
      prisma.listing.count.mockResolvedValue(1);

      const result = await service.findAllForSeller(SELLER_ID, 'ACTIVE');

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sellerId: SELLER_ID, status: 'ACTIVE' },
          take: 20,
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
        meta: { total: 1 },
      });
    });

    it('returns all of the current seller listings when no status is given', async () => {
      prisma.listing.findMany.mockResolvedValue([
        buildListingRow({ status: 'ACTIVE' }),
        buildListingRow({ id: 'id-2', status: 'PENDING' }),
      ]);
      prisma.listing.count.mockResolvedValue(2);

      const result = await service.findAllForSeller(SELLER_ID, undefined);

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sellerId: SELLER_ID } }),
      );
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('returns an empty data array when the seller has no listings in that status', async () => {
      prisma.listing.findMany.mockResolvedValue([]);
      prisma.listing.count.mockResolvedValue(0);

      const result = await service.findAllForSeller(SELLER_ID, 'COMPLETED');

      expect(result).toEqual({ data: [], meta: { total: 0 } });
    });

    it('falls back to a null photoUrl when the listing has no cover photo', async () => {
      prisma.listing.findMany.mockResolvedValue([
        buildListingRow({ photos: [] }),
      ]);
      prisma.listing.count.mockResolvedValue(1);

      const result = await service.findAllForSeller(SELLER_ID, 'ACTIVE');

      expect(result.data[0]?.photoUrl).toBeNull();
    });
  });
});
