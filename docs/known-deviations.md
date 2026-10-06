# Known deviations

Places where the current code does not follow the docs yet. State as of 2026-10-06.
Do not rewrite these on your own initiative: fix them only within a slice that touches that file,
and remove the entry here in the same commit.

- `src/auth/current-user.decorator.ts`: `@CurrentUser()` is a stub that always returns the seeded
  seller (`SEEDED_SELLER_ID`) and there is no global JWT guard, so `GET /listings` is reachable
  without a token. Breaks "Protected routes require a valid token" in
  [security.md](rules/security.md) until BO-39 (login) adds the guard and makes the decorator read
  the verified user. Consumers already use `@CurrentUser()`, so only `src/auth/` changes.
- `GET /listings` (`src/listings/listings.service.ts`): `photoUrl` carries the cover photo's raw
  `storageKey`, not a URL, because there is no storage yet. The storage slice (A1, S3/R2) resolves
  it to a real URL under the same field name.
- `prisma/seed.ts`: the `PENDING` and `COMPLETED` listings have no reservation (and so no buyer or
  `seller_handed_over_at`), because the `reservations` table does not exist yet. The reservations
  slice must seed a consistent reservation for each.
- `src/main.ts`: no global throttler yet (planned with the login slice, which needs the stricter
  limit, see [security.md](rules/security.md)). No CORS either: the browser never calls the API
  (the Next.js server does), so add the `CORS_ORIGINS` allowlist only if that changes.
- `test/app.e2e-spec.ts`: creates the app in `beforeEach` (one app per test; use `beforeAll`) and
  imports `'./../src/app.module.js'` (the `./` is redundant).
- `src/app.controller.spec.ts`: `it('should return ...')` instead of the
  `it('<returns…> when…')` style. It is scaffold; not worth touching in isolation.
- `.oxlintrc.json` disables `typescript/no-explicit-any`: the linter does not catch `any`; QA does.
