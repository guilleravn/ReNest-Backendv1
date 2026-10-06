# Known deviations

Places where the current code does not follow the docs yet. State as of 2026-10-06.
Do not rewrite these on your own initiative: fix them only within a slice that touches that file,
and remove the entry here in the same commit.

- `src/main.ts`: no global throttler yet (planned with the login slice, which needs the stricter
  limit, see [security.md](rules/security.md)). No CORS either: the browser never calls the API
  (the Next.js server does), so add the `CORS_ORIGINS` allowlist only if that changes.
- `test/app.e2e-spec.ts`: creates the app in `beforeEach` (one app per test; use `beforeAll`) and
  imports `'./../src/app.module.js'` (the `./` is redundant).
- `src/app.controller.spec.ts`: `it('should return ...')` instead of the
  `it('<returns…> when…')` style. It is scaffold; not worth touching in isolation.
- `.oxlintrc.json` disables `typescript/no-explicit-any`: the linter does not catch `any`; QA does.
