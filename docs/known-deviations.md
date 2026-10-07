# Known deviations

Places where the current code does not follow the docs yet. State as of 2026-10-06.
Do not rewrite these on your own initiative: fix them only within a slice that touches that file,
and remove the entry here in the same commit.

- `src/main.ts`: no CORS: the browser never calls the API (the Next.js server does), so add the
  `CORS_ORIGINS` allowlist only if that changes.
- `GET /listings` and `GET /feed` (`src/listings/listings.service.ts`): `photoUrl` carries the
  cover photo's raw `storageKey`, not a URL, because there is no storage yet. The storage slice
  (A1, S3/R2) resolves it to a real URL under the same field name.
- `GET /feed` (`src/listings/feed.controller.ts`): a singular, non-resource route, against the
  plural-noun rule in [api-design.md](conventions/api-design.md#routes) and
  [naming.md](conventions/naming.md). On purpose: it is a buyer-facing view over the ACTIVE
  `listings` (every seller's, title search), not a resource of its own, and `GET /listings` is
  already the current seller's "My Listings". The contract is agreed with the frontend and with
  BO-6 (which adds the `category` filter on top), so renaming it needs a plan.
- `prisma/seed.ts`: the `PENDING` and `COMPLETED` listings have no reservation (and so no buyer or
  `seller_handed_over_at`), because the `reservations` table does not exist yet. The reservations
  slice must seed a consistent reservation for each.
- `test/app.e2e-spec.ts`: creates the app in `beforeEach` (one app per test; use `beforeAll`) and
  imports `'./../src/app.module.js'` (the `./` is redundant).
- `src/app.controller.spec.ts`: `it('should return ...')` instead of the
  `it('<returns…> when…')` style. It is scaffold; not worth touching in isolation.
- `.oxlintrc.json` disables `typescript/no-explicit-any`: the linter does not catch `any`; QA does.
