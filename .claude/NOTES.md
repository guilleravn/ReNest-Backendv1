# Agent notes

Shared log between the issue-implementer and qa-reviewer agents, and context for the user and
future runs. Only what is relevant and **not already in the plan or the issue**: deviations,
decisions taken, risks, open questions. Newest first.

Format:

```
## YYYY-MM-DD · <issue code> · <agent>
- <note>
```

---

## 2026-10-06 · A9 / BO-39 (configurable credential limits) · backend-issue-implementer

- The per-IP (20) and global (100) login/sign-up limits are now env vars
  (`CREDENTIALS_IP_LIMIT`, `CREDENTIALS_GLOBAL_LIMIT`); `credentialsThrottlers(limits)` replaces
  the `CREDENTIALS_THROTTLERS` constant. Only `docker-compose.yml`'s `api` service raises them
  (1000 each): the frontend Playwright suite sends every request from one forwarded IP and got 429
  on 43/70 tests. Per IP + email stays hardcoded at 5. `start:dev` and the backend e2e suite use
  the defaults; a local `.env` needs nothing new.

## 2026-10-06 · A9 / BO-39 (merge of develop with BO-27/BO-40) · main session

- Merged `origin/develop` (BO-27 `GET /listings`) into `feat/a9-auth` instead of rebasing: the
  branch was already pushed, and replaying its commits would leave intermediate commits broken
  (the global guard makes the unauthenticated BO-27 e2e fail).
- The BO-40 `@CurrentUser()` stub (`src/auth/current-user.decorator.ts`) is deleted, as its own
  comment planned: `ListingsController` uses the real decorator from `src/common/decorators/`, so
  `GET /listings` now requires a token (its known-deviations entry is removed).
  `SEEDED_SELLER_ID` moved into `prisma/seed-fixtures.ts`.
- `test/listings.e2e-spec.ts` authenticates as `SEEDED_SELLER_ID` with a JWT signed by the app's
  `JwtService` and gained a 401-without-token case. Its fixture users use zone cities.
- Dev databases seeded before the fixed ids make the seed stop with a reset hint
  (`npx prisma migrate reset`), per BO-40's `assertFixedUserIds`.

## 2026-10-06 · A9 / BO-39 (code review round) · backend-qa-reviewer

- Every per-IP credential limit assumes ReNest-Frontend's server sends `X-Forwarded-For` with the
  browser's IP, and that it **sets or appends** that IP rather than relaying a client-supplied
  header unchecked (Express takes the right-most untrusted address, so appending is safe). Without
  the header, all users share the Next server's IP: 20 logins/sign-ups per minute for the whole
  app.
- `test/throttling.e2e-spec.ts` boots its own app with `THROTTLE_LIMIT=8` and a `TRUST_PROXY` that
  excludes loopback, to prove the `default` throttler still runs on login and that an untrusted
  `X-Forwarded-For` is ignored. It sets those env vars before importing `AppModule` and restores
  them afterwards.
- `docs/conventions/testing.md`: the new "E2E is not in CI" paragraph sits inside the E2E bullet
  list, so the "main business flow" and "money" bullets now read as part of it. Move the paragraph
  after the list next time the file is touched.

## 2026-10-06 · A9 / BO-39 (code review round) · backend-issue-implementer

- Supersedes the earlier A9 notes on throttling ("per-email limit replaces the global one") and on
  the seed's `termsAcceptedAt` (the column is gone: new migration
  `20261006195909_drop_terms_accepted_at_from_users`).
- That migration was written by hand from `prisma migrate diff` (same SQL Prisma generates) and
  applied with `prisma:deploy`: `prisma migrate dev` refuses to run non-interactively when a
  migration drops a column. `prisma migrate status` and a datasource-vs-schema diff report no
  drift.
- E2E is not in CI (team decision). Until the job is reinstated, `npm run test:e2e` must pass
  locally before merging; it needs `JWT_SECRET` in `.env` (`NODE_ENV`, `TRUST_PROXY`,
  `ARGON2_MAX_CONCURRENCY` and the `THROTTLE_*` vars have defaults). Also in `testing.md`.
- Credential throttlers are opt-in through `skipIf` + `@CredentialsThrottle()` metadata (named
  throttlers otherwise apply to every route); their keys ignore the route, so login and sign-up
  share one budget. The `default` throttler still runs on those routes.
- `test/auth.e2e-spec.ts` resets the in-memory throttler storage in `beforeEach` by calling
  `ThrottlerStorageService.onApplicationShutdown()` (the only public way to clear both of its maps).
  If the storage changes (e.g. Redis), replace that reset.
- `docker-compose.yml` sets `TRUST_PROXY: 'loopback, uniquelocal'` for the `api` service: inside
  Docker the Next.js server's requests come from the bridge network, not loopback.
- `NODE_ENV` is now validated (`development|test|production`, default `development`); any other
  value (e.g. `staging`) stops the app at startup.
- The global credential limit (100 / 60 s, all clients) is a DoS lever by design: an attacker can
  block every login/sign-up for up to a minute. Accepted for the MVP; documented in security.md.

## 2026-10-06 · A9 (auth) · backend-qa-reviewer

- `JWT_SECRET` is now required at startup: a local `.env` created before A9 makes `start:dev`,
  the e2e suite and the Docker `api` container fail until it is copied from `.env.example` (only
  the `THROTTLE_*` vars have defaults). CI needs nothing today (it runs unit tests only and none
  boot `AppModule`), but reinstating the e2e job means adding `JWT_SECRET` to its env.
- On login/sign-up, every request without a usable email (missing body, non-string email) shares
  one per-IP bucket of 5 / 60 s. All traffic comes from the Next.js server, so those malformed
  requests share it across users; harmless (they are 400s anyway), but keep it in mind when
  adding e2e cases that omit the email (see the comment in `test/auth.e2e-spec.ts`).

## 2026-10-06 · A9 (auth) · backend-issue-implementer

- Per-email throttling uses the library's per-route tracker (`@Throttle({ default: { limit,
  ttl, getTracker } })`, `src/auth/credentials-throttle.ts`) instead of a custom guard subclass
  overriding `getTracker`: same behavior, no extra guard. On login/register it **replaces** the
  global per-IP limit (it does not stack), and login and register count separately (the key
  includes the handler).
- Follow-up decided by the main session: the global per-IP limit sees only the Next.js server's IP,
  so it applies to all users combined. It is now configurable (`THROTTLE_LIMIT`, default 1000;
  `THROTTLE_TTL_MS`, default 60000) and documented as a coarse safety net; the per-email
  credentials limit (5 / 60 s) stays hardcoded. The two throttle vars are optional (defaults
  apply); `JWT_SECRET` is still required, see above.
- `JWT_EXPIRES_IN` must carry a unit (`7d`, `12h`; validated at startup): jsonwebtoken reads a bare
  numeric string as **milliseconds**, so `604800` would silently mean ~10 minutes.
- `UsersService.create` maps **any** P2002 to 409 without inspecting `meta.target` (its shape
  differs with the pg driver adapter); `email` is the only caller-controlled unique column.
- `GET /auth/me` 401s for a valid token whose user was deleted; the global guard itself does not hit
  the DB, so other protected routes must not assume `@CurrentUser()` still exists.
- Seed: `termsAcceptedAt` left NULL for the seeded accounts; cities typed against `UserZone`
  (type-only import from `src/users/user-zones.ts`, so tsx does not load `src/` at runtime).
  Existing dev databases keep the old cities until `npm run db:seed` is re-run.
- Docs also updated beyond the brief's list: `docs/conventions/testing.md` (said "no sign-up").

## 2026-10-06 · BO-40 (PR #7 review fixes) · backend-qa-reviewer
- The current-seller stub is now the `@CurrentUser()` param decorator in
  `src/auth/current-user.decorator.ts` (the boundary security.md defines); `CurrentSellerProvider`
  is gone. BO-39 only swaps the decorator body and adds the global guard.
- `GET /listings` now takes `page`/`pageSize` (default 20, max 100) and returns
  `meta: { page, pageSize, total }`, per api-design.md: the "silently truncated at 20" note below
  no longer applies. The FE contract only gained fields.
- Seed: one pickup option per listing; prices lowered to $250/$80/$120/$50 (the USD note below is
  resolved); a user's id is never rewritten on upsert, and the seed stops with a reset hint if
  Samuel/Valentina exist with other ids (DBs seeded before the fixed ids). Fixed seed ids live in
  `prisma/seed-fixtures.ts`.
- Seed gaps that wait for the reservations slice are listed in `docs/known-deviations.md`.

## 2026-10-06 · BO-40 (post-merge re-review) · backend-qa-reviewer
- After the BO-36 merge, `test/seed.e2e-spec.ts` runs the seed (which now recreates the current
  seller's listings) while `test/listings.e2e-spec.ts` clears them and asserts the COMPLETED tab
  is empty: a race between files. `vitest.config.e2e.ts` now sets `fileParallelism: false`, so
  e2e spec files run one at a time. Keep it unless every spec stops sharing fixed rows.
- Seed listing prices were written as COP amounts and are now USD: $25,000 dining table, $8,000
  chair, $12,000 bookshelf, $5,000 lamp. Lower them when the seed is next touched (demo data only).

## 2026-10-06 · BO-40 · backend-qa-reviewer
- `GET /listings` has no pagination params (`page`/`pageSize`): the sub-issue's contract is
  `{ data, meta: { total } }` only, and `ListingsService.findAllForSeller` hardcodes
  `take: DEFAULT_LISTINGS_TAKE` (20). A seller with more than 20 listings in one status will
  silently see only the first 20 (ordered by `createdAt desc`), even though `meta.total` reports
  the real count. Fine for the MVP seed/demo; add `page`/`pageSize` (per the proposal in
  `api-design.md`) in the slice that first needs it, rather than assuming 20 is always enough.
- `test/listings.e2e-spec.ts` seeds its own fixtures for `SEEDED_SELLER_ID` (the hardcoded current
  seller, see `src/auth/current-seller.ts`) and clears that seller's listings in `beforeAll` first,
  because `prisma/seed.ts` seeds demo data for the same fixed id. Re-run `npx prisma db seed`
  after running this e2e suite if you need the demo fixtures back locally (idempotent, upsert-based).
- Reviewed and kept as-is three infra fixes made directly on this branch while running the
  migration/seed/build locally (not part of the BO-40 feature code, but needed to even run it):
  `tsx` to run `prisma/seed.ts` (plain `node` could not resolve the generated client's `.js`
  imports), `import 'dotenv/config'` in `src/main.ts` + `vitest.config.e2e.ts` (the app never
  loaded `.env` anywhere), and `tsconfig.build.json` `rootDir`/`include` + `start:prod` pointing at
  `dist/src/main` (Nest's build couldn't see `generated/prisma/`, which lives outside `src/`).
  **Superseded by the BO-36 merge below**: `ConfigModule` (env validation) now loads `.env` and
  provides `DATABASE_URL`/`PORT`, so the `dotenv/config` imports were dropped from `src/main.ts`
  and `vitest.config.e2e.ts` in favor of BO-36's `ConfigService`/`readE2eDatabaseUrl` setup; the
  `tsconfig.build.json`/`start:prod` fix still stands, as does `tsx` for the seed.
- Merged `develop` (BO-36 DB foundation) into this branch before opening the PR: took BO-36's
  `schema.prisma` (superset — adds `PickupOption`/`Weekday`, drops the unused `currency` column
  now that every price is USD per BO-36's decision), dropped this branch's now-redundant
  `add_listings_core` migration (BO-36's `add_listings_domain` already creates the same tables),
  and merged `prisma/seed.ts` so BO-36's canonical accounts/categories seed also creates the BO-40
  listings fixtures (`Samuel Rojas` now seeded with the id `CurrentSellerProvider` stubs as the
  current seller, `Valentina Cruz` as the other seller for ownership-scoping tests).

## 2026-10-06 · BO-36 (DB foundation, review fixes) · backend-qa-reviewer

- `readE2eDatabaseUrl` compares the two URLs as strings: the same database written differently
  (other query string, host alias, quoting) passes the guard. Harmless today (specs only touch
  their own rows and the seed upserts), but compare host/port/database name if e2e ever starts
  truncating tables.

## 2026-10-06 · BO-36 (DB foundation, review fixes) · main session

- Code review fixes applied: opt-in seed on container start (`SEED_ON_START`), module ownership
  table, whole-dollar CHECK (new migration, the first one was already pushed), lint/format now
  cover `prisma/` and the config files, dedicated e2e database, buyer persona Camila in the seed.
- Decided with the user: every price is USD regardless of country.
- Deferred (not in this PR): the full BO-36 seed (listings in every category/condition/status,
  photos, pickup options, no-rating/no-badge data) needs the remaining ERD tables (reservations,
  seller_ratings, reception_checklists) and real photo objects in storage. The e2e job in CI was
  dropped earlier by team decision; reopening it needs the team's agreement.
- For A1's endpoints: Prisma returns `time` columns as `Date` on 1970-01-01 UTC. Serialize pickup
  times as `"HH:mm"` and never apply a time zone conversion.

## 2026-10-06 · BO-36 (DB foundation) · backend-qa-reviewer

- The DB-level half of the price and pickup option invariants is now proven by
  `test/database-constraints.e2e-spec.ts`; their "Tested by: TBD" in `business-invariants.md`
  should point there (plus the DTO tests) when the A1 endpoint slice fills in the API half.
- `src/config/env.validation.ts` relies on `reflect-metadata` being loaded (Nest does it in the
  app); unit tests that import it directly need `import 'reflect-metadata'`.
- The Docker `api` service now runs the seed on every start: a local `.env` created before this
  change has no `SEED_USER_PASSWORD`, so the container crash-loops until it is added from
  `.env.example`.

## 2026-10-06 · BO-36 (DB foundation) · main session

- Branch split agreed with the user: this branch is infra + schema + seed only; A1's endpoints
  (storage, categories, `POST /listings`) come in a later branch.
- Migration includes only the tables A1 needs (users, categories, listings, listing_photos,
  pickup_options). Reservations, checklists and ratings come with their slices.
- `pickup_options.weekdays` is set `NOT NULL` by hand: Prisma creates scalar lists as nullable
  arrays, and `cardinality(NULL)` would let the CHECK pass. Verified that `migrate dev` reports no
  drift with this change.
- Extra DB CHECKs beyond the ERD's original list: non-blank `location_label`/`address` (required
  by the "pickup option needs weekdays, location and hour range" invariant) and
  `price_cents >= 100` (was `>= 0`). ERD updated.
- `tsconfig.build.json` now compiles `generated/` too (the client lives outside `src/`), so the
  build entry moved to `dist/src/main.js`.
- Open for A2: the "Punto de encuentro" UI has a single field, while the schema has a public
  `location_label` and a private `address`.
