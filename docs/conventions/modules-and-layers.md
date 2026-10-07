# Modules and layers

Project layout, module ownership, and what goes in a controller, DTO, guard or service.
DTO/validation details live in [api-design.md](api-design.md); Prisma details in
[database.md](database.md).

## Project layout

```
src/
  main.ts                    # bootstrap only
  app.module.ts
  common/                    # cross-cutting, no domain and no Prisma models: decorators/ (@Public, @CurrentUser), concurrency/ (Semaphore), pagination/; filters/, guards/, interceptors/, pipes/ when needed
    pagination/
      pagination-query.dto.ts  # PaginationQueryDto (page, pageSize) + DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_PAGE; list query DTOs extend it
      pagination.ts            # PageParams, Paginated<T> ({ data, meta: { page, pageSize, total } }), toSkipTake() → Prisma skip/take
  config/
    env.validation.ts        # EnvironmentVariables + validateEnv (ConfigModule fails fast at startup)
  prisma/
    prisma.module.ts
    prisma.service.ts
  <module>/                  # one module per domain, plural kebab-case: listings/, pickup-options/
    <module>.module.ts
    <module>.controller.ts
    <module>.service.ts
    <module>.service.spec.ts # unit test next to the code
    dto/                     # create-listing.dto.ts, update-listing.dto.ts, list-listings-query.dto.ts, listing-response.dto.ts
    exceptions/              # only if the module has its own exceptions
    events/                  # only if it emits events
test/
  <module>.e2e-spec.ts       # e2e against the real app + real Postgres
prisma/schema.prisma, prisma/migrations/, prisma/seed.ts
generated/prisma/            # generated client (gitignored): NEVER edit. Compiled with src/ (tsconfig.build.json), so the build entry is dist/src/main.js
```

Generate with the CLI (`nest g module|controller|service <name> --no-spec`, then adjust) so names
follow the conventions; check that generated relative imports end in `.js`.

## Modules and ownership

One NestJS module per domain under `src/<module>/`. A module owns its Prisma models: only its own
service writes to them. Other modules call that module's service (listed in its `exports`) and
never query its tables directly (❌ `prisma.<otherModulesModel>`).

| Module | Owns (Prisma models) | Status |
|---|---|---|
| `app` | — (scaffold health/root endpoint) | Exists (Nest scaffold) |
| `prisma` | — (`PrismaService`, DB connection) | Exists |
| `users` | `User` | Exists (A9). `UsersService` is the only code that touches `prisma.user`; `AuthModule` uses it. Also owns the zones list (`USER_ZONES`, a user's city) and serves it with `ZonesController` (`GET /zones`, no service: it returns a constant) |
| `auth` | — (login, sign-up, JWT issuing/verification, global `JwtAuthGuard`) | Exists (A9). Design in [security.md](../rules/security.md#auth-design-mvp) |
| `categories` | `Category` | Planned: A1 (`GET /categories`) |
| `listings` | `Listing`, `ListingPhoto`, `PickupOption` | Exists: `GET /listings?status=&page=&pageSize=` (the current seller's listings, BO-27) and `GET /feed?q=&page=&pageSize=` (every ACTIVE listing, title search, BO-5; `FeedController` in the same module). `POST /listings` (A1) still planned |
| *(domain modules)* | TBD | Added as features are agreed |

`@Public()` and `@CurrentUser()` live in `src/common/decorators/`, not in `auth/`: every module
uses them, and keeping them out of `AuthModule` is what makes it replaceable (see
[security.md](../rules/security.md#auth-design-mvp)). The guard that fills `request.user` stays in
`auth/`.

Update this table in the same commit that adds a module or a model. `prisma/seed.ts` and test
fixtures are outside Nest and may write any model directly.

## Dividing line between layers

| Layer | Does | Never does |
|---|---|---|
| **Controller** | Maps HTTP to a service call: route, params, DTO, status code, picks the current user from the request | Business rules, Prisma calls, `try/catch` for business errors, building responses with logic |
| **DTO** | Shape and format validation of input (types, required fields, lengths, enums) | Checks that need the DB ("does this exist?", "is it available?"), business rules |
| **Guard / middleware** | Authentication (who are you) and coarse authorization (role, is logged in) | Ownership or business checks that need domain data (those go in the service) |
| **Service** | Business rules, invariants, transactions, Prisma access, ownership checks, throwing typed exceptions | Reading `req`/`res`, knowing about HTTP status codes beyond the exception type |

Rule of thumb: if the check needs the database, it belongs in the service.

## Controller

Thin: route, params, DTO, status code, current user → one service call.

```ts
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get(':listingId')
  findOne(
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ): Promise<ListingResponseDto> {
    return this.listingsService.findOne(listingId);
  }

  @Delete(':listingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.listingsService.remove(listingId, user.id);
  }
}
```

❌ Prisma in the controller · ❌ `try/catch` to translate errors · ❌ Express `@Res()` (breaks
interceptors and serialization) except for streaming/downloads · ❌ business logic.

Method names: CRUD uses the Nest CLI names (`create`, `findAll`, `findOne`, `update`, `remove`);
business actions use their verb (`cancel`, `approve`, `markAsReturned`).

## Service

Business rules, transactions, Prisma access, ownership and typed exceptions. It does not know
about `req`/`res`: it receives the current user's id as an argument, not the request.

## Config

`@nestjs/config` is global (`ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`).
Every variable the app reads is declared, with `class-validator` decorators, in
`EnvironmentVariables` (`src/config/env.validation.ts`), so a missing or malformed value stops the
app at startup. Read it with `ConfigService<EnvironmentVariables, true>` and
`get('X', { infer: true })`. A new variable goes in that class and in `.env.example` in the same
commit. ❌ `process.env.X` in `src/`. (`prisma/seed.ts` is a standalone script outside Nest and
reads `process.env` directly.)
