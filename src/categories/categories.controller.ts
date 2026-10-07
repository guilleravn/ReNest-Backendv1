import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';
import type { ListCategoriesResponseDto } from './dto/category-response.dto.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(): Promise<ListCategoriesResponseDto> {
    return this.categoriesService.findAll();
  }
}
