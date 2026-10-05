# ReNest Backend

REST API for ReNest, an item rental platform. Built with NestJS, Prisma and PostgreSQL.

## Getting started

```bash
npm install
cp .env.example .env      # then adjust values if needed
npm run db:up             # start local Postgres (Docker)
npm run prisma:generate   # generate the Prisma client
npm run start:dev
```

See [CLAUDE.md](CLAUDE.md) for commands and project rules, and [docs/](docs/) for conventions, business invariants and architecture.
