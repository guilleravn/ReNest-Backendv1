# Naming and casing

How to name files, classes, variables, Prisma models, routes, env vars and events. Code, comments,
error messages, logs and commits are always in English.

| Element | Convention | ✅ Example | ❌ Avoid |
|---|---|---|---|
| Module folder | kebab-case, plural | `rental-requests/` | `rentalRequests/`, `RentalRequest/` |
| File | kebab-case + `.<type>.ts` | `rental-requests.service.ts` | `RentalRequestsService.ts`, `rentalRequests.service.ts` |
| File suffixes | `.module` `.controller` `.service` `.dto` `.guard` `.filter` `.interceptor` `.pipe` `.decorator` `.strategy` `.event` `.listener` `.exception` `.spec` `.e2e-spec` | `jwt-auth.guard.ts`, `item-created.event.ts` | `auth-guard.ts`, `items.test.ts` |
| Classes | PascalCase + role suffix | `ItemsService`, `ItemsController`, `JwtAuthGuard` | `itemsService`, `ItemsSvc` |
| Module / controller / service | plural of the resource | `ItemsModule` | `ItemModule` |
| DTO | PascalCase, verb + singular entity + `Dto` | `CreateItemDto`, `UpdateItemDto`, `ListItemsQueryDto`, `ItemResponseDto` | `ItemDTO`, `ItemCreateDto`, `CrearItemDto` |
| Custom exception | PascalCase + `Exception` | `ItemNotAvailableException` | `ItemError` |
| Interfaces / types | PascalCase, no `I` prefix | `CurrentUserPayload` | `ICurrentUser` |
| Variables, functions, methods, properties | camelCase | `findAvailableItems()`, `ownerId` | `find_items`, `OwnerId` |
| Booleans | `is`/`has`/`can`/`should` prefix | `isAvailable`, `hasActiveRental` | `available`, `flag` |
| Module-level constants (fixed values) | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE = 100`, `IS_PUBLIC_KEY` | `maxPageSize` at file level |
| Local `const` | camelCase | `const total = ...` | `const TOTAL = ...` |
| Injection tokens | UPPER_SNAKE_CASE constant (or abstract class) | `@Inject(STRIPE_CLIENT)` | bare literal `@Inject('stripeClient')` |
| TS / Prisma enum | singular PascalCase type, UPPER_SNAKE_CASE members | `RentalStatus.PENDING_APPROVAL` | `rentalStatus.pendingApproval` |
| Generics | `T` or `T` + name | `TItem` | `ItemType` |
| Prisma model | **singular** PascalCase + `@@map` to **plural** snake_case | `model RentalRequest { @@map("rental_requests") }` | `model rental_requests`, `model RentalRequests` |
| Prisma field | camelCase + `@map` to snake_case if it has >1 word | `ownerId String @map("owner_id")` | `owner_id String` |
| FK | `<relation>Id` | `ownerId` + `owner User @relation(...)` | `owner_fk`, `userId` for the "owner" relation |
| DB table / column | snake_case (plural tables) | `rental_requests.created_at` | `"RentalRequest"."createdAt"` |
| DB enum | `@@map` to snake_case | `enum RentalStatus { ... @@map("rental_status") }` | |
| Migration | descriptive snake_case (`--name`) | `add_items_table`, `add_owner_index_to_items` | `migration1`, `changes` |
| REST route | kebab-case, plural noun | `/rental-requests/:id` | `/rentalRequests`, `/rental_requests`, `/getRentals` |
| Path param | camelCase | `/items/:itemId/photos/:photoId` | `:item_id` |
| Query param | camelCase | `?ownerId=…&sortBy=createdAt&pageSize=20` | `?owner_id=`, `?PageSize=` |
| JSON properties (request/response) | camelCase (same as Prisma/DTO fields) | `{ "pricePerDayCents": 1500 }` | `{ "price_per_day": 15 }` |
| Environment variables | UPPER_SNAKE_CASE, grouped by prefix | `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS` | `jwtSecret`, `SECRET` |
| Internal events | `domain.past-tense-verb`, lowercase | `'rental.requested'` + class `RentalRequestedEvent` | `'RENTAL_REQUESTED'`, `'onRental'` |
| Queue / cron job names | kebab-case | `'rental-reminders'` | `'RentalReminders'` |
| Logger context | the class name | `new Logger(ItemsService.name)` | `new Logger('items')` |

## Units in the name

Money `…Cents`, durations `…Ms` / `…Seconds`, dates `…At` (instant) / `…Date` (calendar day).

✅ `totalCents`, `expiresAt`, `startDate` · ❌ `total`, `expires`, `start`.
