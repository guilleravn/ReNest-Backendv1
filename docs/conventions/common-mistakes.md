# Common mistakes

Checklist of the mistakes most often made in this repo. Implementers check it before handing off;
QA checks every change against it. Each item links to the doc with the full rule.

1. Forgetting `.js` on a relative import, or importing from `@prisma/client` instead of
   `generated/prisma` ([coding-style.md](coding-style.md#esm-imports)).
2. `import type` of a service or DTO → broken DI/validation with no compile error
   ([coding-style.md](coding-style.md#esm-imports)).
3. Accepting `ownerId`/`userId`/`role`/`status` from the body ([api-design.md](api-design.md#dtos-and-validation)).
4. Checking only authentication and not ownership (IDOR) on `GET/PATCH/DELETE /:id`
   ([security.md](../rules/security.md)).
5. Returning the full Prisma object (with `passwordHash` or other internal fields)
   ([api-design.md](api-design.md#dtos-and-validation)).
6. `ValidationPipe` only in `main.ts` → e2e tests pass without validation
   ([api-design.md](api-design.md#dtos-and-validation)).
7. Prisma calls or error-translating `try/catch` in the controller
   ([modules-and-layers.md](modules-and-layers.md#controller)).
8. Check-then-write without a transaction + constraint/lock on limited resources (availability)
   ([database.md](database.md#transactions)).
9. Money as `Float`/decimals; names without a unit (`price` instead of `priceCents`)
   ([database.md](database.md#money)).
10. `findMany()` without `take`, or Prisma queries inside a loop (N+1) ([database.md](database.md#queries)).
11. Promises without `await` (emails, events) → lost errors ([coding-style.md](coding-style.md#async)).
12. Wrong status codes: `200` on create, `500` for invalid input, `403` when it should be `401`
    ([api-design.md](api-design.md)).
13. Changing the shape of a response the frontend already consumes without agreeing on it
    ([api-design.md](api-design.md#contract-evolution)).
14. Logging `req.body`, tokens or the whole user ([error-handling.md](error-handling.md#logging)).
15. Editing an already committed migration, or changing `schema.prisma` without a migration
    ([database.md](database.md#migrations)).
16. Inventing tables, rules or endpoints the issue/plan does not define (ask instead).
17. Tests that mock Prisma to "prove" a constraint or a race condition
    ([testing.md](testing.md#rule-never-mock-what-the-test-exists-to-verify)).
