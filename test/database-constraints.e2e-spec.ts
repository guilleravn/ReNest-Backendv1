// Proves the hand-written CHECK constraints of the first migration against the real Postgres.
// Invariants: docs/rules/business-invariants.md ("A listing price is whole US dollars, at least
// $1" and the pickup option one: weekdays, location and hour range).
import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const time = (hhmm: string): Date => new Date(`1970-01-01T${hhmm}:00.000Z`);

describe('Database constraints (e2e)', () => {
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let sellerId: string;
  let categoryId: string;
  let listingId: string;

  const runId = randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();
    prisma = app.get(PrismaService);

    const seller = await prisma.user.create({
      data: {
        email: `constraints-${runId}@renest.test`,
        passwordHash: 'not-a-real-hash',
        fullName: 'Constraint Tester',
        city: 'Ciudad de México',
      },
    });
    sellerId = seller.id;
    const category = await prisma.category.create({
      data: { name: `Constraints ${runId}`, slug: `constraints-${runId}` },
    });
    categoryId = category.id;
    const listing = await prisma.listing.create({
      data: {
        sellerId,
        categoryId,
        title: 'Constraint test listing',
        condition: 'LIKE_NEW',
        priceCents: 100,
      },
    });
    listingId = listing.id;
  });

  afterAll(async () => {
    // Pickup options and photos cascade from the listings.
    await prisma.listing.deleteMany({ where: { sellerId } });
    await prisma.user.delete({ where: { id: sellerId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await close();
  });

  describe('listings', () => {
    const validListing = () => ({
      sellerId,
      categoryId,
      title: 'Wooden chair',
      condition: 'GENTLY_USED' as const,
      priceCents: 2500,
    });

    it('accepts a listing priced at exactly $1 with no description', async () => {
      const listing = await prisma.listing.create({
        data: { ...validListing(), priceCents: 100 },
      });

      expect(listing).toMatchObject({
        priceCents: 100,
        description: null,
        status: 'ACTIVE',
      });
    });

    it('rejects a listing priced below $1', async () => {
      await expect(
        prisma.listing.create({ data: { ...validListing(), priceCents: 99 } }),
      ).rejects.toThrow(/listings_price_cents_check/);
    });

    it('rejects a listing price that is not a whole number of dollars', async () => {
      await expect(
        prisma.listing.create({ data: { ...validListing(), priceCents: 150 } }),
      ).rejects.toThrow(/listings_price_cents_whole_dollars_check/);
    });

    it('rejects a listing with a zero or negative price', async () => {
      await expect(
        prisma.listing.create({ data: { ...validListing(), priceCents: 0 } }),
      ).rejects.toThrow(/listings_price_cents_check/);
      await expect(
        prisma.listing.create({
          data: { ...validListing(), priceCents: -100 },
        }),
      ).rejects.toThrow(/listings_price_cents_check/);
    });
  });

  describe('pickup_options', () => {
    const validOption = () => ({
      listingId,
      locationLabel: 'Parque Lleras',
      address: 'Calle 10 #40-20',
      weekdays: ['MONDAY' as const, 'WEDNESDAY' as const],
      startTime: time('10:00'),
      endTime: time('13:00'),
    });

    it('accepts a pickup option with weekdays, location, address and a valid range', async () => {
      const option = await prisma.pickupOption.create({ data: validOption() });

      expect(option).toMatchObject({
        locationLabel: 'Parque Lleras',
        address: 'Calle 10 #40-20',
        weekdays: ['MONDAY', 'WEDNESDAY'],
        startTime: time('10:00'),
        endTime: time('13:00'),
      });
    });

    it('rejects a pickup option with no weekdays', async () => {
      await expect(
        prisma.pickupOption.create({
          data: { ...validOption(), weekdays: [] },
        }),
      ).rejects.toThrow(/pickup_options_weekdays_check/);
    });

    it('rejects a pickup option whose weekdays are NULL', async () => {
      // The Prisma client cannot send NULL for a list, so this goes through raw SQL.
      await expect(
        prisma.$executeRaw`
          INSERT INTO pickup_options
            (id, listing_id, location_label, address, weekdays, start_time, end_time, updated_at)
          VALUES
            (${randomUUID()}::uuid, ${listingId}::uuid, 'Parque', 'Calle 1', NULL,
             '10:00', '13:00', now())`,
      ).rejects.toThrow(/null value in column "weekdays"/);
    });

    it('rejects a pickup option with a blank location label', async () => {
      await expect(
        prisma.pickupOption.create({
          data: { ...validOption(), locationLabel: '   ' },
        }),
      ).rejects.toThrow(/pickup_options_location_label_check/);
      await expect(
        prisma.pickupOption.create({
          data: { ...validOption(), locationLabel: '' },
        }),
      ).rejects.toThrow(/pickup_options_location_label_check/);
    });

    it('rejects a pickup option with a blank address', async () => {
      await expect(
        prisma.pickupOption.create({
          data: { ...validOption(), address: ' ' },
        }),
      ).rejects.toThrow(/pickup_options_address_check/);
    });

    it('rejects a pickup option whose end time equals the start time', async () => {
      await expect(
        prisma.pickupOption.create({
          data: {
            ...validOption(),
            startTime: time('10:00'),
            endTime: time('10:00'),
          },
        }),
      ).rejects.toThrow(/pickup_options_time_range_check/);
    });

    it('rejects a pickup option whose end time is before the start time', async () => {
      await expect(
        prisma.pickupOption.create({
          data: {
            ...validOption(),
            startTime: time('13:00'),
            endTime: time('10:00'),
          },
        }),
      ).rejects.toThrow(/pickup_options_time_range_check/);
    });

    it('deletes pickup options together with their listing', async () => {
      const listing = await prisma.listing.create({
        data: {
          sellerId,
          categoryId,
          title: 'Cascade test',
          condition: 'HEAVILY_USED',
          priceCents: 500,
          pickupOptions: { create: { ...validOption(), listingId: undefined } },
        },
      });

      await prisma.listing.delete({ where: { id: listing.id } });

      await expect(
        prisma.pickupOption.count({ where: { listingId: listing.id } }),
      ).resolves.toBe(0);
    });
  });
});
