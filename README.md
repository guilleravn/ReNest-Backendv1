# ReNest Backend

REST API for ReNest, a C2C marketplace for buying and selling secondhand items in LatAm. Built with NestJS, Prisma and PostgreSQL.

## Getting started

```bash
npm install
cp .env.example .env      # then adjust values if needed
npm run db:up             # start local Postgres (Docker)
npm run prisma:generate   # generate the Prisma client
npm run prisma:deploy     # apply migrations
npm run db:seed           # categories + pre-created accounts (password: SEED_USER_PASSWORD)
npm run start:dev
```

See [CLAUDE.md](CLAUDE.md) for commands and project rules, and [docs/README.md](docs/README.md) for the docs index (conventions, business and security rules, architecture).
