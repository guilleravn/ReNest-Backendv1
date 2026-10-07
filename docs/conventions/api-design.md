# API design

REST routes, status codes, request validation (DTOs), response shapes, pagination and contract
evolution. How errors are thrown inside the code: [error-handling.md](error-handling.md).

## Routes

Plural kebab-case nouns; the HTTP verb says the action. At most 2 levels of nesting, and only for
real ownership (`/listings/:listingId/photos`); if the child has its own identity, also expose it flat
(`/reservations/:reservationId`). Query params filter, sort and paginate, never identify
(✅ `/listings/42` · ❌ `/listings?id=42`).

| Operation | Method + route | Success |
|---|---|---|
| List | `GET /listings` | `200` + page |
| Read | `GET /listings/:listingId` | `200` |
| Create | `POST /listings` | `201` + created resource (includes `id`) |
| Partial update | `PATCH /listings/:listingId` | `200` + resource |
| Full replace (rare) | `PUT /listings/:listingId` | `200` |
| Delete | `DELETE /listings/:listingId` | `204` no body |
| Business action | `POST /reservations/:reservationId/confirm-handover` | `200` + resource, or `204` |

❌ `/getListings`, `/listings/create`, a `GET` that changes state, `200` with `{ error: true }`.

## Error status codes

| Code | Nest exception | When |
|---|---|---|
| 400 | `BadRequestException` / `ValidationPipe` | Malformed or invalid input |
| 401 | `UnauthorizedException` | No token, or invalid/expired token |
| 403 | `ForbiddenException` | Authenticated but not allowed (role) |
| 404 | `NotFoundException` | Does not exist **or does not belong to the user** (do not reveal other users' resources) |
| 409 | `ConflictException` | Clashes with current state: duplicate, invalid transition, resource taken |
| 422 | `UnprocessableEntityException` | Do not use unless the contract requires it (use 400/409) |
| 429 | (throttler) | Rate limit |
| 503 | `ServiceUnavailableException` | Temporarily overloaded, client may retry (`ServerBusyException`: argon2 queue full on login/sign-up) |
| 500 | — | A bug. Never thrown on purpose |

**Error body**: Nest's standard shape, identical on every endpoint:

```json
{ "statusCode": 404, "message": "Listing not found", "error": "Not Found" }
```

On validation errors `message` is an array of strings. A future global filter may **add** fields
(`path`, `timestamp`) but not change these three.

## DTOs and validation

Installed (`class-validator` + `class-transformer`) with the first endpoint.

- Global `ValidationPipe` with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`,
  registered as `{ provide: APP_PIPE, useValue: new ValidationPipe({...}) }` in `AppModule` (not in
  `main.ts`), so e2e tests inherit it.
- Every property has decorators; optional ones have `@IsOptional()` **and** their type
  (`@IsOptional() @IsString() notes?: string`). Strings with `@MaxLength`, numbers with `@IsInt`,
  `@Min`/`@Max`, enums with `@IsEnum`, dates with `@IsISO8601`/`@IsDateString`.
- `UpdateXDto extends PartialType(CreateXDto)` (from `@nestjs/mapped-types`, or `@nestjs/swagger`
  if Swagger is installed).
- Query params: their own DTO (`ListListingsQueryDto`) with `@Type(() => Number)` where needed.
- **Never** accept server-decided fields from the body: `id`, `sellerId`, `buyerId`, `userId`,
  `role`, `status`, `createdAt`, computed totals. The acting user (seller or buyer) comes from
  `@CurrentUser()`.
- Response: return a safe, explicit shape (Prisma `select` or mapping to `XResponseDto`).
  ⚠️ `@Exclude()` + `ClassSerializerInterceptor` do **not** work on plain Prisma objects; do not
  rely on them to hide `passwordHash`.

## Response shapes

**Pagination (proposal)**: offset with `page` (1-based, default 1) and `pageSize` (default 20, max
`MAX_PAGE_SIZE = 100`). Sorting with `sortBy` + `sortOrder=asc|desc`, against a whitelist of fields.
Query DTOs extend `PaginationQueryDto` and services return `Paginated<T>` using `toSkipTake()`
(`src/common/pagination/`).

```json
{ "data": [ { "id": "…" } ], "meta": { "page": 1, "pageSize": 20, "total": 57 } }
```

- Single resource: plain object, no envelope.
- Dates in ISO 8601 UTC (`"2026-10-05T14:00:00.000Z"`); calendar days as `"2026-10-05"`.
- Empty optional fields as `null`, not omitted.
- Enums as the raw string (`"PENDING_APPROVAL"`).

## Contract evolution

Additive changes only (a new optional field). Renaming fields, changing types, making something
required or changing a status code **breaks the frontend**: it needs agreement in the plan. No
versioning or global prefix today; if needed, URI versioning (`/v1`) via `enableVersioning`.
