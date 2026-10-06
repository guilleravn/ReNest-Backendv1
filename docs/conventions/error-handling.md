# Error handling and logging

How services throw errors, how Prisma errors are translated, and what/how to log. Which status
code to use for each case: [api-design.md](api-design.md#error-status-codes).

## Throwing errors

- Services throw NestJS typed exceptions (`NotFoundException`, `ConflictException`,
  `ForbiddenException`, `BadRequestException`, `UnauthorizedException`) with an English message.
- Messages must not leak internals (SQL, stack traces, other users' data).
- Reusable domain errors: a subclass in `<module>/exceptions/`:

  ```ts
  export class ListingAlreadyReservedException extends ConflictException {
    constructor() { super('Listing is already reserved'); }
  }
  ```

- Controllers do not `try/catch` to convert errors; services throw the right type directly.
- **Never** let a raw `Error` or a raw Prisma error reach the client.

## Prisma errors

Translate known Prisma errors where they are **expected** (e.g. a create that can hit a unique
constraint):

- `P2002` (unique violation) → `ConflictException`
- `P2025` (record not found) → `NotFoundException`
- `P2003` (foreign key violation) → `ConflictException`

Check with `error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'`. Any
other error is rethrown as-is (it ends up as a generic 500).

## Anti-patterns

❌ Empty `catch (e) {}` · ❌ `throw new Error('...')` towards the client · ❌ `throw 'string'` ·
❌ returning `null` where a 404 belongs.

## Logging

- `private readonly logger = new Logger(ListingsService.name)`. ❌ `console.*`.
- Levels: `error` for failures needing attention (include `error.stack`); `warn` for anomalous but
  recoverable; `log` for relevant business events (created, cancelled); `debug` for development
  detail.
- Log **where the error is handled**, not in every layer that rethrows it.
- Fixed message + identifying data:
  ``this.logger.warn(`Reservation for listing ${listingId} rejected: already reserved`)``.
- **Never** log: passwords, hashes, tokens, `Authorization`, secrets, connection strings, whole
  `req.body`/`req.headers`, whole user objects. Pick fields explicitly.
