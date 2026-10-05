# Architecture

## Current state

**Nothing is deployed.** The project runs locally only:

```
ReNest-Frontend  ──HTTP/REST──▶  ReNest-Backend (NestJS, :3000)  ──▶  PostgreSQL 17 (Docker, :5432)
```

- No job queue, cache, object storage or external services.
- No CI pipeline yet.

## Production target

**Not decided.** Hosting, CI/CD, environments and monitoring are TBD. When decided, document here:
- Deploy shape (platform, how the API and DB are hosted, how migrations run: `npm run prisma:deploy` as a release step).
- Environments (dev / staging / prod) and where their config/secrets live.
- Background jobs, if a feature needs them (e.g. rental reminders, expirations) and which queue.
- What to monitor: health endpoint, error rate, latency, DB connections, failed jobs.

Do not add infrastructure to this doc until it actually exists or has been agreed.
