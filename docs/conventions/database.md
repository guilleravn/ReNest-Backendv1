# Database (Prisma + PostgreSQL)

Schema design, money, queries, transactions, migrations and `PrismaService`. Naming of models,
fields and tables: [naming.md](naming.md). Setup and versions: [architecture.md](../architecture.md#stack--current-state).

## Source of truth

There is no separate ERD yet, so `prisma/schema.prisma` is the source of truth. If an ERD is added
under `docs/reference/`, any Prisma schema change must update the ERD in the same slice.

**Data model: not yet defined.** Do not invent tables; they get added slice by slice as features
are agreed.

## Model template

```prisma
model Item {
  id               String     @id @default(uuid(7)) @db.Uuid
  title            String     @db.VarChar(120)
  pricePerDayCents Int        @map("price_per_day_cents")
  isAvailable      Boolean    @default(true) @map("is_available")
  ownerId          String     @map("owner_id") @db.Uuid
  owner            User       @relation(fields: [ownerId], references: [id], onDelete: Restrict)
  createdAt        DateTime   @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime   @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([ownerId])
  @@map("items")
}
```

- **IDs**: UUID (`@default(uuid(7)) @db.Uuid`): does not expose volume or order and makes resources
  harder to enumerate by URL; v7 is time-ordered, so the index does not fragment like with v4.
  Validate with `ParseUUIDPipe`.
- **Timestamps**: every model has `createdAt` + `updatedAt` as `timestamptz`. Store in UTC.
- **Relations**: explicit `onDelete` (default `Restrict`; `Cascade` only for children without their
  own identity). `@@index` on every FK that is filtered on (Postgres does not index FKs by itself).
- **Invariants in the DB** whenever possible: `@unique`/`@@unique`, `NOT NULL`, enums. DTO
  validation does not replace the constraint.
- Index/constraint names: the ones Prisma generates; do not set them by hand unless they conflict.

## Money

The domain does not handle money yet. The moment it does:

- Amounts are **integers in minor units (cents) end to end**: `priceCents Int` in Prisma, `number`
  (integer) in TS. ❌ `Float`, ❌ `Decimal` → `number` with fractional values.
- Field names carry the unit (`totalCents`, not `total`).
- Any multiplication/division (percentages, prorating) rounds explicitly with `Math.round` at the
  step where it happens, and the rule is documented in
  [business-invariants.md](../rules/business-invariants.md).

## Queries

- Explicit `select` on reads that are exposed; no nested `include` without need.
- Avoid N+1: never `await` Prisma inside a `for`; use `include` / `in`.
- Collections always have `take` (paginated).
- Raw SQL only with `$queryRaw` and a tagged template (parameterized). ❌ `$queryRawUnsafe` with input.

## Transactions

Use `prisma.$transaction` when:

- Two or more writes must succeed or fail together (otherwise the DB can be left half-updated).
- A **check-then-write** protects a limited resource (e.g. availability, stock). In that case a
  transaction alone is not enough: pair it with a DB constraint, a row lock
  (`SELECT ... FOR UPDATE`) or `Serializable` isolation, and document which one in the invariant.

Use the transaction client (`tx`) for the whole block; ❌ mixing `this.prisma` inside
`$transaction(async (tx) => ...)`.

Each concrete case is listed with its invariant in
[business-invariants.md](../rules/business-invariants.md). None exist yet.

## Migrations

- `npm run prisma:migrate -- --name <snake_case>`.
- Never edit a migration that is already committed; schema + migration go in the same commit.
- `npm run prisma:generate` after every schema change (and after install).
- `npm run prisma:deploy` applies pending migrations in CI/prod.

## PrismaService

`PrismaService extends PrismaClient`, receives the `PrismaPg` adapter in its constructor and calls
`$disconnect()` in `onModuleDestroy`. `PrismaModule` exports it; every module that uses it imports
it explicitly. The generated client lives in `generated/prisma/` (gitignored, never edit); import
from there, never from `@prisma/client`.
