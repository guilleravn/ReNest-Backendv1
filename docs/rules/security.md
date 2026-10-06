# Security

Mandatory security invariants, then how to apply them in this codebase. Read for any change that
touches auth, endpoints, user input, secrets, logging of user data or uploads.

## Auth design (MVP)

**Implemented** (story A9 · Log in with email and password). Keep it this small: anything beyond
it needs a new decision.

- **Login + sign-up.** Sign-up was moved into the MVP by product-owner decision on 2026-10-06
  (it was planned for R2). Still out of scope: password reset, social login, phone/identity
  verification, email verification, refresh tokens and token revocation. There is no
  fake/switchable "current user".
- **Contract** (all public except `/auth/me`; errors use the standard Nest body):
  - `POST /auth/login` `{ email, password }` → `200 { accessToken, expiresAt }`; `401`
    `"Invalid email or password"` for both an unknown email and a wrong password; `400`; `429`.
  - `POST /auth/register` `{ fullName, email, city, phoneE164?, password, acceptedTerms }` →
    `201 { accessToken, expiresAt }` (sign-up also signs the user in); `409` `"An account with this
    email already exists"`; `400`; `429`. `city` is one of `USER_ZONES`
    (`src/users/user-zones.ts`); `phoneE164` may be omitted, `null` or `""` (stored as NULL),
    otherwise separators are stripped and it must be E.164; `acceptedTerms` must be `true`
    (stored as `termsAcceptedAt`). New accounts start unverified.
  - `GET /auth/me` → `200 { id, email, fullName, city, phoneE164, isVerified }`; `401` when the
    token is missing, invalid, expired or its user no longer exists.
  - `accessToken` is a JWT signed with `@nestjs/jwt` (HS256, `JWT_SECRET`) carrying only the user id
    (`sub`). `expiresAt` is the token's `exp` as ISO 8601 UTC, so the frontend can set its cookie's
    lifetime without decoding the token.
  - Emails are trimmed and lowercased before validation, on login and sign-up alike.
- **One access token, ~7 days** (`JWT_EXPIRES_IN`, default `7d`), so the session survives closing
  the browser. Without refresh tokens, a short expiry would log users out constantly; the accepted
  trade-off is that a stolen token stays valid until it expires. Logout is done by the frontend
  deleting its cookie.
- The token never reaches browser JavaScript: the frontend server stores it in an httpOnly cookie
  and sends it as `Authorization: Bearer` (see ReNest-Frontend `docs/architecture.md`).
- **Account enumeration**: login never reveals whether an email exists (same message, and an
  unknown email still runs `argon2.verify` against a dummy hash so the timing matches). Sign-up's
  `409` does reveal it; accepted, because the sign-up form has to tell people the email is taken.
  Both endpoints are throttled per email, which limits harvesting through either.
- **Throttling**: a global `ThrottlerGuard` (`APP_GUARD`, registered before the JWT guard, so
  unauthenticated requests count too) allows `THROTTLE_LIMIT` requests per `THROTTLE_TTL_MS`
  per client IP (defaults 1000 / 60 000 ms, configurable via env). The browser never calls the
  API directly, so every request arrives from the Next.js server's IP: this limit applies to all
  users combined and is only a **coarse safety net** against runaway traffic, not per-user
  protection; size it for total app traffic. The meaningful protection is the credentials
  throttle: login and sign-up replace the global limit with a fixed 5 req / 60 s **per normalized
  email** (falling back to the IP when the body has no email), via
  `@Throttle(CREDENTIALS_THROTTLE)` and its `getTracker` (`src/auth/credentials-throttle.ts`). A
  per-IP login limit would lock out every user at once. Counters are in memory (one API
  instance).
- **Swappable boundary**: only `AuthModule` knows how users authenticate. The rest of the code
  depends on the global guard, `@Public()` and `@CurrentUser()` (in `src/common/decorators/`), so
  moving to an external provider only replaces `AuthModule`.

## Security invariants

These rules apply from the auth slice (A9) onwards. Entry format: see
[business-invariants.md](business-invariants.md#format).

### Passwords are never stored in plain text
- **Requires**: hash with a slow password hash (argon2 or bcrypt) before persisting; the hash never appears in any API response.
- **Protects**: user credentials if the DB leaks.
- **Fails as**: leaked DB → every user's password exposed.
- **Tested by**: `test/auth.e2e-spec.ts` (sign-up stores an argon2id hash),
  `test/seed.e2e-spec.ts` (seeded accounts).

### Tokens are signed with a secret from the environment
- **Requires**: JWT secret and expiry read from env (`.env`, never committed); expiry as agreed in
  [Auth design](#auth-design-mvp).
- **Protects**: nobody can forge a valid token.
- **Fails as**: a committed or hardcoded secret → anyone can mint tokens for any user.

### Protected routes require a valid token
- **Requires**: auth guard on every non-public route; public routes are explicitly marked.
- **Protects**: data and actions are only reachable by authenticated users.
- **Fails as**: anonymous access to user data or actions.
- **Tested by**: `test/auth.e2e-spec.ts` (`GET /auth/me`: no token, malformed, wrong secret,
  expired, deleted user).

### Ownership is checked in the service
- **Requires**: services verify the current user owns (or may act on) the resource before reading/changing it.
- **Protects**: users cannot read or modify other users' resources by changing an ID.
- **Fails as**: IDOR: user A edits or deletes user B's data.

### Phone numbers are only exposed where a story needs them
- **Requires**: response DTOs with an explicit `select`. The seller's `phoneE164` is returned with
  the listing detail / seller snapshot (WhatsApp contact, B5) and may be `null` (the client shows
  the fallback). The buyer's `phoneE164` is returned only to the seller of that buyer's
  reservation (C9). No other endpoint returns another user's phone.
- **Protects**: buyers' contact details; a buyer only shares their phone by reserving.
- **Fails as**: any authenticated user harvests buyers' phone numbers through the API.

### All input is validated and unknown fields are rejected
- **Requires**: global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` (registered as `APP_PIPE` in `AppModule`), and DTOs with `class-validator` decorators.
- **Protects**: services only receive well-formed, expected input; clients cannot set fields like `id`, `role` or `sellerId`.
- **Fails as**: mass assignment (e.g. a user sets `role: "admin"`) or crashes on malformed input.

## How to apply them

- **Global auth**: JWT guard registered as `APP_GUARD`; public routes marked with `@Public()`
  (`IS_PUBLIC_KEY`). Nothing is public by default.
- **Ownership (BOLA/IDOR)**: the service filters by owner in the query itself
  (`where: { id: listingId, sellerId: userId }`) or compares and throws 404/403. Hiding a button in the
  frontend protects nothing.
- **Roles**: `@Roles(...)` + `RolesGuard` only for coarse authorization; rules about data go in the
  service.
- **Mass assignment**: `whitelist` + `forbidNonWhitelisted`; separate DTOs per role if the editable
  fields differ.
- **Passwords**: argon2id (`argon2`), 8–128 characters at sign-up; never in responses or logs.
  Login returns the same message for "user does not exist" and "wrong password".
- **Secrets** (API keys, connection strings, JWT secrets) never go in the repo or in a prompt: only
  in `.env` (gitignored); `.env.example` holds placeholders only.
- **HTTP** (when the API is exposed): `helmet`, CORS with an allowlist from `CORS_ORIGINS`
  (❌ `app.enableCors()` without options in prod), global `@nestjs/throttler`, stricter on login
  and sign-up (see [Auth design](#auth-design-mvp)).
- **External input** (webhooks, third-party APIs) is untrusted: validate it and verify signatures.
- **Uploads**: validate type/size; generated file name (`randomUUID()`), never the original one.
- **Logging**: never log credentials, tokens or whole user objects (see
  [error-handling.md](../conventions/error-handling.md#logging)).

## Evaluated and rejected

- **External provider (Firebase Auth / Auth0 / Clerk)**: users would live in two places (provider
  and Postgres) and the seed would have to sync both; it needs accounts and secrets per
  environment and a provider or emulator for e2e tests. Too much setup for a one-week MVP with
  login only. Still not worth it with our own sign-up in the MVP; reconsider (behind the
  `AuthModule` boundary) if social login, phone verification or password reset are needed.
- **Server-side sessions in Nest**: the browser never calls the API directly (it goes through the
  Next.js server), so a Nest session cookie would add cross-origin cookie handling for no gain.
- **Auth.js (NextAuth) in the frontend**: the API would still need to trust the user's identity,
  so it ends up issuing or verifying a JWT anyway; one more library for the same result.
- **Refresh tokens**: not needed for a demo-length MVP; the long-lived access token is the
  accepted trade-off.
