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
