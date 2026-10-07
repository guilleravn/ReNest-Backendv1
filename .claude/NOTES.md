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

## 2026-10-06 · BO-44 (QA re-review) · backend-qa-reviewer
- `GET /feed` rejects a whitespace-only `search` with 400: an addition to the BO-44 contract
  ("1–100 chars"). Harmless for ReNest-Frontend's feed, which trims the term and omits blank
  ones (`src/features/feed/components/feed-search.tsx`, `feed-filters.ts`); any other client
  must do the same. Leading/trailing spaces inside a non-blank term are not trimmed by the API.
- Wildcard escaping is also covered positively (titles with literal `%`, `_`, `\` still match)
  in `test/feed.e2e-spec.ts`, which also guards against double-escaping if Prisma ever starts
  escaping `contains` itself.

## 2026-10-06 · BO-44 (QA fix) · backend-issue-implementer
- Fixed the QA-flagged LIKE-wildcard bug: `FeedService.findAll` now escapes `\`, `%` and `_` in
  `search` (`value.replace(/[\\%_]/g, '\\$&')`) before passing it to Prisma's `contains`, since
  Postgres's default `ILIKE` escape character is `\` and an unescaped `%`/`_` is otherwise
  interpreted as a wildcard instead of matched literally. Verified behaviorally against real
  Postgres via `test/feed.e2e-spec.ts`'s "treats LIKE wildcards in the search literally" case
  (was the 1 failing test QA reported; now passes). Added a matching unit test in
  `feed.service.spec.ts` asserting the exact escaped string reaches `contains`.
- `ListFeedQueryDto.search` now also requires `@Matches(/\S/)` (at least one non-whitespace
  char), on top of the existing `@MinLength(1)`/`@MaxLength(100)`: a whitespace-only value (e.g.
  a single space) used to pass validation and match every title containing a space. Chose
  rejection (400) over silently trimming, to stay consistent with how the rest of this DTO
  treats malformed input (category's slug pattern also rejects rather than normalizes).
- Added a one-line comment to `CategoriesService.findAll` explaining the missing `take` limit is
  intentional (small, seed-controlled set), per QA's non-blocking note, so it doesn't get
  re-flagged.
- Re-ran the full validation suite: `npm run lint`, `npm run typecheck`, `npm run format:check`,
  `npm test` (30 passed), `npm run test:e2e` (52 passed, via `npm run db:up`/`db:down`) — all
  green.

## 2026-10-06 · BO-44 · backend-issue-implementer
- `FeedService` queries `prisma.listing` directly instead of going through `ListingsService`: the
  module-ownership rule in `docs/conventions/modules-and-layers.md` says a module only queries its
  own Prisma models, but `ListingsService.findAllForSeller` is hardcoded to the current seller
  (`sellerId` in the `where`) and has a different filter set, so it cannot serve the public,
  unscoped buyer feed without changing its signature — out of this work package's owned files
  (`src/listings/**`). Documented as a deviation in `docs/known-deviations.md` and in the new
  `feed` row of the module table; worth revisiting if `listings` ever grows a reusable "public
  listings" query both modules can share.
- `category` filtering is format-only (`^[a-z0-9-]+$`) and goes through the `Listing -> Category`
  relation (`category: { slug: category }`), per the contract: an unknown/malformed-but-matching
  slug (e.g. `not-a-real-category`) returns `{ data: [], meta: { total: 0, ... } }`, not a 400.
  Covered by a unit test and an e2e test.
- `search` uses `@MinLength(1) @MaxLength(100)` (the contract's own range) and
  `{ contains: search, mode: 'insensitive' }` against `title` only, matching the existing "title
  ILIKE, not full-text" decision already in `business-invariants.md`.
- Pagination constants/validation (`page`/`pageSize`, defaults 1/20, max 100) are duplicated from
  `ListListingsQueryDto` into `ListFeedQueryDto` rather than shared, since `src/listings/**` is out
  of scope for this change and there's no existing shared DTO base to extend without touching it.
- Added the "the buyer feed only shows ACTIVE listings" invariant to
  `docs/rules/business-invariants.md`, enforced by hardcoding `status: 'ACTIVE'` in
  `FeedService.findAll` (not accepted as a query param), with a dedicated unit test asserting it
  holds regardless of which other filters are passed.
- `GET /categories` and `GET /feed` are reachable without a token, same as `GET /listings`: there
  is no global auth guard yet (BO-39 not landed), so no `@Public()` marker was needed or added.
- Ran `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm test` (27 passed) and
  `npm run test:e2e` (42 passed, via `npm run db:up`) — all green.

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
