# Testing

What to cover and how to write the tests.

|  | Unit | E2E |
|---|---|---|
| File | `src/<module>/<module>.service.spec.ts` (next to the code) | `test/<module>.e2e-spec.ts` |
| Command | `npm test` | `npm run test:e2e` (requires `npm run db:up`) |
| Dependencies | mocked collaborators | real app (`AppModule`) via Supertest + real Postgres |

**E2E database**: e2e runs on its own database, `E2E_DATABASE_URL` (`renest_e2e` in
`.env.example`), never on the dev one. `test/e2e-global-setup.ts` creates it if missing and runs
`prisma migrate deploy` before the suite; `vitest.config.e2e.ts` overrides `DATABASE_URL` with it
for every spec and child process (e.g. the seed), and refuses to run if both URLs are the same.

## What to cover

**Unit**: **every service method has unit tests**, covering the happy path and every business rule
it enforces (each exception it can throw). Controllers only need tests if they contain mapping
logic beyond calling the service.

**E2E**: required for critical paths, against a real Postgres database (not mocked), covering the
happy path + the 400/401/403/404/409 cases of the contract:
- **Auth**: login (valid credentials, wrong password, unknown email), accessing a protected route
  with and without a valid token. There is no sign-up in the MVP.
- **The main business flow**: publish a listing → reserve it with a pickup option → confirm
  handover → confirm reception.
- **Anything involving money or payments**, if/when the domain gets it.

**Concurrency**: required wherever the domain has a real race condition, i.e. a limited resource
that two requests can claim at the same time (here, typically two buyers reserving the same
listing at once). These tests:
- Run against the **real database**, never a mock (a mock cannot reproduce a race).
- Fire the competing requests in parallel (`Promise.all`) and assert that exactly one succeeds and
  the DB invariant still holds.
- Are linked to their invariant in [business-invariants.md](../rules/business-invariants.md).

## Running the API for ReNest-Frontend's e2e tests

ReNest-Frontend's Playwright suite can run against a real backend instead of mocking with
`page.route`. To provide one, run `npm run docker:up` here: it builds and starts both `db` and
`api` in Docker (API on `:3000`, matching `API_URL` in the frontend's `.env.example`). Stop it with
`npm run docker:down`. See [architecture.md](../architecture.md#running-the-api-in-docker).

## Rule: never mock what the test exists to verify

If a test checks that a uniqueness rule, transaction or lock works, the DB involved must be real.
Mocking Prisma in that test makes it pass by construction and proves nothing. Mock only
collaborators that are *not* the subject of the test.

## How to write them

- **Vitest, not Jest**: `vi.fn()`, `vi.spyOn()`, `vi.mocked()`, `vi.useFakeTimers()`. Globals are
  enabled (`describe`/`it`/`expect` without importing).
- **Naming**: `describe('<ClassName>')` → `describe('<methodName>')` →
  `it('<behavior> when <condition>')`, in English, third person:
  ✅ `it('throws NotFoundException when the listing belongs to another user')`
  ❌ `it('works')`, `it('test 1')`, `it('should fail')`.
  E2E: `describe('POST /listings')` → `it('returns 400 when title is missing')`.
- Arrange/Act/Assert (or Given/When/Then) structure, one behavior per `it`.
- **Strong assertions**: `toEqual` with the expected object, `rejects.toThrow(NotFoundException)`,
  `toHaveBeenCalledWith(...)`. ❌ `toBeTruthy()`/`toBeDefined()` as the only assertion.
- **Unit mocks**: `Test.createTestingModule({ providers: [ListingsService, { provide: PrismaService,
  useValue: prismaMock }] })` with typed `vi.fn()`s; only the methods actually used.
- **Deterministic**: no real `Date.now()`/`new Date()` in assertions (fake timers or an injected
  date), no real network, no dependency on test order.
- **E2E setup**: `beforeAll` creates the app from `AppModule` (pipes/guards/filters registered as
  `APP_*` providers so they exist here), `afterAll` calls `app.close()`. Each test creates its own
  data (unique emails); tables are cleaned between suites. `overrideProvider` only for external
  services (email, payments, storage).
