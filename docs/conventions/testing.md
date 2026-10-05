# Testing

Runner: Vitest. Unit tests are `src/**/*.spec.ts` (`npm test`); e2e tests are `test/**/*.e2e-spec.ts` (`npm run test:e2e`) and use Supertest against the real Nest app.

## Unit tests

Default rule: **every service method has unit tests**, covering the happy path and every business rule it enforces (each exception it can throw).

Controllers only need tests if they contain mapping logic beyond calling the service.

## E2E tests

Required for critical paths, against a real Postgres database (not mocked):
- **Auth**: register, login, accessing a protected route with and without a valid token.
- **The main business flow**: the rental flow, once it is defined.
- **Anything involving money or payments**, if/when the domain gets it.

## Concurrency tests

Required wherever the domain has a real race condition, i.e. a limited resource that two requests can claim at the same time (for a rental platform, typically two users renting the same item for overlapping dates).

These tests:
- Run against the **real database**, never a mock (a mock cannot reproduce a race).
- Fire the competing requests in parallel (`Promise.all`) and assert that exactly one succeeds and the DB invariant still holds.

Each concurrency test is linked to its invariant in `docs/rules/business-invariants.md`.

## Rule: never mock what the test exists to verify

If a test checks that a uniqueness rule, transaction or lock works, the DB involved must be real. Mocking Prisma in that test makes it pass by construction and proves nothing. Mock only collaborators that are *not* the subject of the test.
