import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Same slugs/names as prisma/seed.ts. Upserted here (instead of relying on the seed having run
// first) so this suite does not depend on run order against other e2e files, same as
// test/listings.e2e-spec.ts.
const SEEDED_CATEGORIES = [
  { slug: 'furniture', name: 'Muebles' },
  { slug: 'electronics', name: 'Electrónica' },
  { slug: 'home', name: 'Hogar' },
];

describe('GET /categories (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get(PrismaService);

    for (const category of SEEDED_CATEGORIES) {
      await prisma.category.upsert({
        where: { slug: category.slug },
        update: { name: category.name },
        create: category,
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the seeded categories with id, name and slug', async () => {
    const response = await request(app.getHttpServer())
      .get('/categories')
      .expect(200);

    const bodies = response.body.data as Array<{
      id: string;
      name: string;
      slug: string;
    }>;

    for (const expected of SEEDED_CATEGORIES) {
      const match = bodies.find((category) => category.slug === expected.slug);
      expect(match).toEqual({
        id: expect.any(String),
        name: expected.name,
        slug: expected.slug,
      });
    }
  });
});
