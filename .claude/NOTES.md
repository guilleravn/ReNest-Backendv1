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
