import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListCategoriesResponseDto } from './dto/category-response.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ListCategoriesResponseDto> {
    // No `take` limit: categories are a small, seed-controlled fixed set (not
    // user-generated), so unbounded growth isn't a concern here.
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });

    return { data: categories };
  }
}
