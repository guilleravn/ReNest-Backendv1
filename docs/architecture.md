# Architecture

## Stack — current state

This is a **living** section. Update it in the same commit as any change to dependencies, versions
or infrastructure. It describes what is installed, not what is planned.

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
| Containerization | Docker Compose (`db` + `api` services) | — | `docker-compose.yml`, `Dockerfile` |

Prisma specifics:
- Config lives in `prisma.config.ts` (loads `.env` via `dotenv`). Schema in `prisma/schema.prisma`,
  migrations in `prisma/migrations/`.
- The client is generated into `generated/prisma/` (gitignored). Import from there, not from
  `@prisma/client`. Run `npm run prisma:generate` after install and after every schema change.
- Do not install `prisma@latest` blindly: as of 2026-10 the npm `latest` tag points to an 8.0 RC.
  Keep CLI and client on the same stable version.

## Runtime topology

**Nothing is deployed.** The project runs locally only:

```
ReNest-Frontend  ──HTTP/REST──▶  ReNest-Backend (NestJS, :3000)  ──▶  PostgreSQL 17 (Docker, :5432)
```

- No job queue, cache, object storage or external services.
- No CI pipeline yet.

### Running the API in Docker

`docker-compose.yml` has two services: `db` (always used, even for local `npm run start:dev`) and
`api` (the built app, containerized). `npm run docker:up` builds and starts both, exposing the API
on `:3000` against the containerized Postgres — this is mainly for **ReNest-Frontend's e2e suite**,
so it can hit a real backend instead of mocking `page.route`. For day-to-day backend development,
keep using `npm run db:up` + `npm run start:dev` (faster feedback loop, no rebuild per change).
`npm run docker:down` stops both services.

## Production target

**Not decided.** Hosting, CI/CD, environments and monitoring are TBD. When decided, document here:
- Deploy shape (platform, how the API and DB are hosted, how migrations run: `npm run prisma:deploy` as a release step).
- Environments (dev / staging / prod) and where their config/secrets live.
- Background jobs, if a feature needs them, and which queue.
- What to monitor: health endpoint, error rate, latency, DB connections, failed jobs.

Do not add infrastructure to this doc until it actually exists or has been agreed.
