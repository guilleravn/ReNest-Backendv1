# Modules and layers

Project layout, module ownership, and what goes in a controller, DTO, guard or service.
DTO/validation details live in [api-design.md](api-design.md); Prisma details in
[database.md](database.md).

## Project layout

```
src/
  main.ts                    # bootstrap only
  app.module.ts
  common/                    # (proposal) cross-cutting: decorators/, filters/, guards/, interceptors/, pipes/
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
prisma/schema.prisma, prisma/migrations/
generated/prisma/            # generated client (gitignored): NEVER edit
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
| `prisma` | — (`PrismaService`, DB connection) | Planned: first DB slice |
| `auth` | TBD | Planned: own auth, not designed yet |
| *(domain modules)* | TBD | Added as features are agreed |

Update this table in the same commit that adds a module or a model.

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

Today only `PORT` and `DATABASE_URL`, read via `process.env` in the bootstrap. When adding the
first new variable: install `@nestjs/config` with `isGlobal: true` and schema validation at startup
(fail fast), inject `ConfigService`, and update `.env.example`. ❌ `process.env.X` scattered across
services.
