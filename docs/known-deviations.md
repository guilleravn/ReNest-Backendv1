# Known deviations

Places where the current code does not follow the docs yet. State as of 2026-10-05 (scaffold).
Do not rewrite these on your own initiative: fix them only within a slice that touches that file,
and remove the entry here in the same commit.

- `src/main.ts`: no `helmet`, CORS or throttler yet (planned for the auth slice, see
  [security.md](rules/security.md)). `ValidationPipe` is registered globally as `APP_PIPE` in
  `AppModule` as of the `GET /listings` slice. Reads `process.env.PORT` directly: acceptable in the
  bootstrap until `@nestjs/config` exists.
- `test/app.e2e-spec.ts`: creates the app in `beforeEach` (one app per test; use `beforeAll`) and
  imports `'./../src/app.module.js'` (the `./` is redundant).
- `src/app.controller.spec.ts`: `it('should return ...')` instead of the
  `it('<returns…> when…')` style. It is scaffold; not worth touching in isolation.
- `prisma.config.ts` uses double quotes and is outside `npm run format` (the script only covers
  `src/` and `test/`); same for `vitest.config*.ts`.
- `.oxlintrc.json` disables `typescript/no-explicit-any`: the linter does not catch `any`; QA does.
