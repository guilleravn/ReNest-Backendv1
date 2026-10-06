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
