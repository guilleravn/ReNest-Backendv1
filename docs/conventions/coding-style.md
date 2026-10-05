# Coding style

## Modules and ownership

One NestJS module per domain under `src/<module>/`. A module owns its Prisma models: only its own service writes to them. Other modules call that module's service and never query its tables directly.

| Module | Owns (Prisma models) | Status |
|---|---|---|
| `app` | — (scaffold health/root endpoint) | Exists (Nest scaffold) |
| `prisma` | — (`PrismaService`, DB connection) | Planned: first DB slice |
| `auth` | TBD | Planned: own auth, not designed yet |
| *(domain modules)* | TBD | Added as features are agreed |

Update this table in the same commit that adds a module or a model.

Module layout:

```
src/<module>/
  <module>.module.ts
  <module>.controller.ts
  <module>.service.ts
  <module>.service.spec.ts
  dto/
    create-<thing>.dto.ts
    update-<thing>.dto.ts
```

## ESM imports

The project is ESM (`"type": "module"`, `moduleResolution: nodenext`). **Relative imports must include the `.js` extension**, even from `.ts` files:

```ts
import { AppService } from './app.service.js';
```

## Dividing line between layers

| Layer | Does | Never does |
|---|---|---|
| **Controller** | Maps HTTP to a service call: route, params, status code, picks the current user from the request | Business rules, Prisma calls, `try/catch` for business errors, building responses with logic |
| **DTO** | Shape and format validation of input (types, required fields, lengths, enums) | Checks that need the DB ("does this exist?", "is it available?"), business rules |
| **Guard / middleware** | Authentication (who are you) and coarse authorization (role, is logged in) | Ownership or business checks that need domain data (those go in the service) |
| **Service** | Business rules, invariants, transactions, Prisma access, throwing typed exceptions | Reading `req`/`res`, knowing about HTTP status codes beyond the exception type |

Rule of thumb: if the check needs the database, it belongs in the service.

## Money

The domain does not handle money yet. When it does:
- Store and pass amounts as **integers in minor units** (cents): `priceCents: Int` in Prisma, `number` (integer) in TS.
- **Never** use `Float`/`Decimal` → `number` with fractional values for money.
- Any multiplication/division (percentages, prorating) rounds explicitly with `Math.round` at the step where it happens, and the rule is documented in `docs/rules/business-invariants.md`.
- Field names carry the unit (`totalCents`, not `total`).

## Transactions

Use `prisma.$transaction` when:
- Two or more writes must succeed or fail together (otherwise the DB can be left half-updated).
- A **check-then-write** protects a limited resource (e.g. availability, stock). In that case a transaction alone is not enough: pair it with a DB constraint, a row lock (`SELECT ... FOR UPDATE`) or `Serializable` isolation, and document which one in the invariant.

Each concrete case is listed with its invariant in `docs/rules/business-invariants.md`. None exist yet.

## Error handling

- Throw NestJS typed exceptions from services: `NotFoundException`, `ConflictException`, `ForbiddenException`, `BadRequestException`, `UnauthorizedException`.
- **Never** let a raw `Error` or a raw Prisma error reach the client. Known Prisma errors are translated (e.g. `P2002` unique violation → `ConflictException`, `P2025` record not found → `NotFoundException`).
- Error messages must not leak internals (SQL, stack traces, other users' data).
- Controllers do not `try/catch` to convert errors; services throw the right type directly.
