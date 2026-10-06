# Naming and casing

How to name files, classes, variables, Prisma models, routes, env vars and events. Code, comments,
error messages, logs and commits are always in English.

| Element | Convention | ✅ Example | ❌ Avoid |
|---|---|---|---|
| Module folder | kebab-case, plural | `pickup-options/` | `pickupOptions/`, `PickupOption/` |
| File | kebab-case + `.<type>.ts` | `pickup-options.service.ts` | `PickupOptionsService.ts`, `pickupOptions.service.ts` |
| File suffixes | `.module` `.controller` `.service` `.dto` `.guard` `.filter` `.interceptor` `.pipe` `.decorator` `.strategy` `.event` `.listener` `.exception` `.spec` `.e2e-spec` | `jwt-auth.guard.ts`, `listing-reserved.event.ts` | `auth-guard.ts`, `listings.test.ts` |
| Classes | PascalCase + role suffix | `ListingsService`, `ListingsController`, `JwtAuthGuard` | `listingsService`, `ListingsSvc` |
| Module / controller / service | plural of the resource | `ListingsModule` | `ListingModule` |
| DTO | PascalCase, verb + singular entity + `Dto` | `CreateListingDto`, `UpdateListingDto`, `ListListingsQueryDto`, `ListingResponseDto` | `ListingDTO`, `ListingCreateDto`, `CrearPublicacionDto` |
| Custom exception | PascalCase + `Exception` | `ListingAlreadyReservedException` | `ListingError` |
| Interfaces / types | PascalCase, no `I` prefix | `CurrentUserPayload` | `ICurrentUser` |
| Variables, functions, methods, properties | camelCase | `findActiveListings()`, `sellerId` | `find_listings`, `SellerId` |
| Booleans | `is`/`has`/`can`/`should` prefix | `isVerified`, `hasActiveReservation` | `verified`, `flag` |
| Module-level constants (fixed values) | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE = 100`, `IS_PUBLIC_KEY` | `maxPageSize` at file level |
| Local `const` | camelCase | `const total = ...` | `const TOTAL = ...` |
| Injection tokens | UPPER_SNAKE_CASE constant (or abstract class) | `@Inject(STRIPE_CLIENT)` | bare literal `@Inject('stripeClient')` |
| TS / Prisma enum | singular PascalCase type, UPPER_SNAKE_CASE members | `ReservationStatus.IN_PROGRESS` | `reservationStatus.inProgress` |
| Generics | `T` or `T` + name | `TListing` | `ListingType` |
| Prisma model | **singular** PascalCase + `@@map` to **plural** snake_case | `model PickupOption { @@map("pickup_options") }` | `model pickup_options`, `model PickupOptions` |
| Prisma field | camelCase + `@map` to snake_case if it has >1 word | `sellerId String @map("seller_id")` | `seller_id String` |
| FK | `<relation>Id` | `sellerId` + `seller User @relation(...)` | `seller_fk`, `userId` for the "seller" relation |
| DB table / column | snake_case (plural tables) | `pickup_options.created_at` | `"PickupOption"."createdAt"` |
| DB enum | `@@map` to snake_case | `enum ReservationStatus { ... @@map("reservation_status") }` | |
| Migration | descriptive snake_case (`--name`) | `add_listings_table`, `add_seller_index_to_listings` | `migration1`, `changes` |
| REST route | kebab-case, plural noun | `/pickup-options/:id` | `/pickupOptions`, `/pickup_options`, `/getPickupOptions` |
| Path param | camelCase | `/listings/:listingId/photos/:photoId` | `:listing_id` |
| Query param | camelCase | `?sellerId=…&sortBy=createdAt&pageSize=20` | `?seller_id=`, `?PageSize=` |
| JSON properties (request/response) | camelCase (same as Prisma/DTO fields) | `{ "priceCents": 1500 }` | `{ "price": 15 }` |
| Environment variables | UPPER_SNAKE_CASE, grouped by prefix | `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS` | `jwtSecret`, `SECRET` |
| Internal events | `domain.past-tense-verb`, lowercase | `'listing.reserved'` + class `ListingReservedEvent` | `'LISTING_RESERVED'`, `'onReserve'` |
| Queue / cron job names | kebab-case | `'pickup-reminders'` | `'PickupReminders'` |
| Logger context | the class name | `new Logger(ListingsService.name)` | `new Logger('listings')` |

## Units in the name

Money `…Cents`, durations `…Ms` / `…Seconds`, dates `…At` (instant) / `…Date` (calendar day).

✅ `totalCents`, `expiresAt`, `startDate` · ❌ `total`, `expires`, `start`.
