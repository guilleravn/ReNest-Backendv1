# CLAUDE.md

ReNest Backend is the REST API for ReNest, an item rental platform (frontend in the separate
`ReNest-Frontend` repo). Just bootstrapped: the domain and data model are defined feature by
feature, so **do not invent tables, rules or endpoints** the issue/plan does not define.

Stack: Node 24, TypeScript (strict, ESM), NestJS 12, Prisma 7 + PostgreSQL 17 (Docker), Vitest +
Supertest, oxlint + Prettier. Versions: [docs/architecture.md](docs/architecture.md#stack--current-state).

All code, comments, commit messages and docs are in **English**, even when the conversation is in
Spanish.

## Commands

```bash
npm install
cp .env.example .env         # local config; never commit .env

npm run db:up                # start local Postgres (Docker)
npm run db:down              # stop it
npm run docker:up            # build + start Postgres AND the API in Docker (:3000)
npm run docker:down          # stop both — needed for ReNest-Frontend's e2e against a real backend
npm run prisma:generate      # regenerate the Prisma client
npm run prisma:migrate       # create + apply a migration (dev)
npm run prisma:deploy        # apply pending migrations (CI/prod)
npm run prisma:studio        # browse the DB

npm run start:dev            # dev server with watch (PORT, default 3000)
npm run build                # compile to dist/
npm run start:prod           # run compiled build

npm run lint                 # oxlint --type-aware
npm run typecheck            # tsc --noEmit
npm run format               # prettier
npm run format:check         # prettier check (pre-commit)
npm test                     # unit tests (*.spec.ts)
npm run test:e2e             # e2e tests (test/*.e2e-spec.ts)
npm run test:cov             # unit tests with coverage
```

## Hard rules

Sync with `origin` before starting or resuming work; branch off the latest `develop`, never
`main`; plan first; commits grouped by functionality/area with their docs and tests, made
directly by QA (no approval step); no AI attribution; **never `git push`** unless asked at that
moment. One PR per Linear ticket, targeting `develop`, needs CI green and 1 approval to merge.
Details: [docs/conventions/git-workflow.md](docs/conventions/git-workflow.md).

## Docs

Start at [docs/README.md](docs/README.md): it says which file to read for each kind of change.
**Read only the docs relevant to the current task**, never all of them. The docs are split by
topic so you can load just what you need (e.g. a DTO change → api-design; a schema change →
database). Most used: [modules-and-layers](docs/conventions/modules-and-layers.md),
[api-design](docs/conventions/api-design.md), [database](docs/conventions/database.md),
[testing](docs/conventions/testing.md), [security](docs/rules/security.md),
[business-invariants](docs/rules/business-invariants.md).
