# Security

Mandatory security invariants, then how to apply them in this codebase. Read for any change that
touches auth, endpoints, user input, secrets, logging of user data or uploads.

## Security invariants

Auth is implemented in-house and **does not exist yet**. These rules apply from the auth slice
onwards. Entry format: see [business-invariants.md](business-invariants.md#format).

### Passwords are never stored in plain text
- **Requires**: hash with a slow password hash (argon2 or bcrypt) before persisting; the hash never appears in any API response.
- **Protects**: user credentials if the DB leaks.
- **Fails as**: leaked DB → every user's password exposed.

### Tokens are signed with a secret from the environment
- **Requires**: JWT secret and expiry read from env (`.env`, never committed); tokens have a short expiry.
- **Protects**: nobody can forge a valid token.
- **Fails as**: a committed or hardcoded secret → anyone can mint tokens for any user.

### Protected routes require a valid token
- **Requires**: auth guard on every non-public route; public routes are explicitly marked.
- **Protects**: data and actions are only reachable by authenticated users.
- **Fails as**: anonymous access to user data or actions.

### Ownership is checked in the service
- **Requires**: services verify the current user owns (or may act on) the resource before reading/changing it.
- **Protects**: users cannot read or modify other users' resources by changing an ID.
- **Fails as**: IDOR: user A edits or deletes user B's data.

### All input is validated and unknown fields are rejected
- **Requires**: global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, and DTOs with `class-validator` decorators. (Not installed yet; added with the first endpoint slice.)
- **Protects**: services only receive well-formed, expected input; clients cannot set fields like `id`, `role` or `ownerId`.
- **Fails as**: mass assignment (e.g. a user sets `role: "admin"`) or crashes on malformed input.

## How to apply them

- **Global auth**: JWT guard registered as `APP_GUARD`; public routes marked with `@Public()`
  (`IS_PUBLIC_KEY`). Nothing is public by default.
- **Ownership (BOLA/IDOR)**: the service filters by owner in the query itself
  (`where: { id: itemId, ownerId: userId }`) or compares and throws 404/403. Hiding a button in the
  frontend protects nothing.
- **Roles**: `@Roles(...)` + `RolesGuard` only for coarse authorization; rules about data go in the
  service.
- **Mass assignment**: `whitelist` + `forbidNonWhitelisted`; separate DTOs per role if the editable
  fields differ.
- **Passwords**: argon2 or bcrypt; never in responses or logs. Login returns the same message for
  "user does not exist" and "wrong password".
- **Secrets** (API keys, connection strings, JWT secrets) never go in the repo or in a prompt: only
  in `.env` (gitignored); `.env.example` holds placeholders only. JWT with short expiry.
- **HTTP** (when the API is exposed): `helmet`, CORS with an allowlist from `CORS_ORIGINS`
  (❌ `app.enableCors()` without options in prod), global `@nestjs/throttler`, stricter on login.
- **External input** (webhooks, third-party APIs) is untrusted: validate it and verify signatures.
- **Uploads**: validate type/size; generated file name (`randomUUID()`), never the original one.
- **Logging**: never log credentials, tokens or whole user objects (see
  [error-handling.md](../conventions/error-handling.md#logging)).
