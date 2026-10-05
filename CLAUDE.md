# CLAUDE.md

## Language

All code, comments, commit messages and docs are written in **English**, even when the conversation happens in Spanish.

## What this is

ReNest Backend is the REST API for ReNest, an item rental platform. The frontend lives in a separate repo (`ReNest-Frontend`). The project was just bootstrapped: the domain and the data model are still being defined feature by feature.

## Stack — current state

This is a **living** section. Update it in the same commit as any change to dependencies, versions or infrastructure. It describes what is installed, not what is planned.

| Area | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | 24.x | |
| Language | TypeScript | 6.0 | `strict`, ESM (`"type": "module"`, `nodenext`) |
| Framework | NestJS | 12.1 | `@nestjs/platform-express` |
| API style | REST | — | |
| ORM | Prisma | 7.10 | `prisma` CLI + `@prisma/client` pinned to the same version |
| DB driver | `@prisma/adapter-pg` + `pg` | 7.10 / 8.x | Prisma 7 requires a driver adapter at runtime |
| Database | PostgreSQL | 17 (Docker, local) | `docker-compose.yml` |
| Auth | Own implementation | — | **Not implemented yet** |
| Job queue | None | — | |
| Tests | Vitest + Supertest | 4.1 / 7.x | |
| Lint / format | oxlint (type-aware) / Prettier | 1.x / 3.x | |

Prisma specifics:
- Config lives in `prisma.config.ts` (loads `.env` via `dotenv`). Schema in `prisma/schema.prisma`, migrations in `prisma/migrations/`.
- The client is generated into `generated/prisma/` (gitignored). Import from there, not from `@prisma/client`. Run `npm run prisma:generate` after install and after every schema change.
- Do not install `prisma@latest` blindly: as of 2026-10 the npm `latest` tag points to an 8.0 RC. Keep CLI and client on the same stable version.

**Data model: not yet defined.** No entities exist. Do not invent tables; they get added slice by slice as features are agreed.

## Commands

```bash
npm install
cp .env.example .env         # local config; never commit .env

npm run db:up                # start local Postgres (Docker)
npm run db:down              # stop it
npm run prisma:generate      # regenerate the Prisma client
npm run prisma:migrate       # create + apply a migration (dev)
npm run prisma:deploy        # apply pending migrations (CI/prod)
npm run prisma:studio        # browse the DB

npm run start:dev            # dev server with watch (PORT, default 3000)
npm run build                # compile to dist/
npm run start:prod           # run compiled build

npm run lint                 # oxlint --type-aware
npm run format               # prettier
npm test                     # unit tests (*.spec.ts)
npm run test:e2e             # e2e tests (test/*.e2e-spec.ts)
npm run test:cov             # unit tests with coverage
```

## Non-negotiable process rules

1. **Plan before implementing** anything non-trivial (plan mode). Agree on the plan, then build.
2. **Commit per slice**, never everything at the end. A slice is not done until the docs it affects are updated **in the same commit**.
3. **Never `git push`** unless the user explicitly asks for it at that moment. A generic "you can always push" does not count.
4. **Show the full commit message in chat and wait for approval** before committing.
5. **No AI attribution in commits**: no `Co-Authored-By`, no "Generated with".
6. **Secrets never go in the repo or in a prompt**: API keys, connection strings, JWT secrets. They live in `.env` (gitignored); `.env.example` holds placeholders only.
7. **Money**: the domain does not handle money yet. The moment it does, amounts are **integer minor units (cents) end to end**, never floats (see `docs/conventions/coding-style.md`).
8. **Schema source of truth**: there is no separate ERD yet, so `prisma/schema.prisma` is the source of truth. If an ERD is added under `docs/reference/`, any Prisma schema change must update the ERD in the same slice.

## Where to look

| Question | Doc |
|---|---|
| Is this business rule real? What does it protect? | [docs/rules/business-invariants.md](docs/rules/business-invariants.md) |
| Does logic go in the controller, DTO, guard or service? | [docs/conventions/coding-style.md](docs/conventions/coding-style.md) |
| Which module owns this entity? | [docs/conventions/coding-style.md](docs/conventions/coding-style.md) |
| Does this need a transaction? | [docs/conventions/coding-style.md](docs/conventions/coding-style.md) |
| How do I throw errors to the client? | [docs/conventions/coding-style.md](docs/conventions/coding-style.md) |
| What needs a unit / e2e / concurrency test? | [docs/conventions/testing.md](docs/conventions/testing.md) |
| What is a slice? How do I structure a commit? | [docs/conventions/git-workflow.md](docs/conventions/git-workflow.md) |
| Auth, tokens, input validation rules | [docs/rules/business-invariants.md](docs/rules/business-invariants.md#security-invariants) |
| How is this deployed / what runs in production? | [docs/architecture.md](docs/architecture.md) |
