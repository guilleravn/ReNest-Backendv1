import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: {
    category: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CategoriesService);
  });

  describe('findAll', () => {
    it('returns every category with only id, name and slug, ordered by name', async () => {
      const rows = [
        { id: 'category-1', name: 'Electrónica', slug: 'electronics' },
        { id: 'category-2', name: 'Hogar', slug: 'home' },
      ];
      prisma.category.findMany.mockResolvedValue(rows);

      const result = await service.findAll();

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
      });
      expect(result).toEqual({ data: rows });
    });

    it('returns an empty data array when there are no categories', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual({ data: [] });
    });
  });
});
