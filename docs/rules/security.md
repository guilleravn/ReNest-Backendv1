# Security

Mandatory security invariants, then how to apply them in this codebase. Read for any change that
touches auth, endpoints, user input, secrets, logging of user data or uploads.

## Auth design (MVP)

**Implemented** (story A9 · Log in with email and password). Keep it this small: anything beyond
it needs a new decision.

- **Login + sign-up.** Sign-up was moved into the MVP by product-owner decision on 2026-10-06
  (it was planned for R2; recorded in Linear BO-39). Still out of scope: password reset, social login, phone/identity
  verification, email verification, refresh tokens and token revocation. There is no
  fake/switchable "current user".
- **Contract** (all public except `/auth/me`; errors use the standard Nest body):
  - `POST /auth/login` `{ email, password }` → `200 { accessToken, expiresAt }`; `401`
    `"Invalid email or password"` for both an unknown email and a wrong password; `400`; `429`;
    `503` when the argon2 queue is full (see below).
  - `POST /auth/register` `{ fullName, email, city, phoneE164?, password }` →
    `201 { accessToken, expiresAt }` (sign-up also signs the user in); `409` `"An account with this
    email already exists"`; `400`; `429`; `503`. `city` is one of `USER_ZONES` (served by `GET /zones`);
    `phoneE164` may be omitted, `null` or `""` (stored as NULL), otherwise separators are stripped
    and it must be E.164. New accounts start unverified. There is no terms checkbox: it was removed
    (BO-39 review) until real Terms/Privacy content exists, so `acceptedTerms` is now an unknown
    field (`400`).
  - `GET /zones` (public) → `200` the `USER_ZONES` array of strings, in order. The backend is the
    single source of truth for the sign-up city list.
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
  Both endpoints share the credential throttlers below, which limits harvesting through either.
- **Client IP**: the browser never calls the API directly; the Next.js server forwards the
  browser's IP in `X-Forwarded-For`. Express `trust proxy` is set from `TRUST_PROXY` (in
  `AppModule.onModuleInit`, so e2e apps get it too) so that `req.ip` is that forwarded IP, but only
  when the request comes from a trusted proxy. Default `loopback` (Next.js on the same host);
  when the frontend runs elsewhere, set the Next server's IP/CIDR (`10.0.3.7`, `10.0.0.0/16`) or a
  hop count (`1`, when exactly one proxy sits in front). `true`/`*` is rejected at startup: it
  would let any client pick its own IP. `docker-compose.yml` sets `loopback, uniquelocal` because
  requests reach the container from the Docker bridge. Every per-IP limit below depends on this
  setting **and** on the frontend forwarding `X-Forwarded-For`; without them all users share the
  Next server's IP. See [Deployment prerequisite: trusted proxy](#deployment-prerequisite-trusted-proxy).
- **Throttling** (`@nestjs/throttler`, named throttlers, global `ThrottlerGuard` registered
  before the JWT guard so unauthenticated requests count too; counters in memory, one API
  instance):
  - `default`, every route: `THROTTLE_LIMIT` requests per `THROTTLE_TTL_MS` per client IP
    (defaults 1000 / 60 s). A coarse safety net.
  - Login and sign-up (`@CredentialsThrottle()`) additionally get two layered limits, **all
    applied together** and shared by both routes (`src/auth/credentials-throttle.ts`):
    1. per client IP + normalized email, 5 / 60 s (fixed): slows guessing one account's password;
    2. per client IP, `CREDENTIALS_IP_LIMIT` / 60 s (default 20): stops one client from rotating
       emails;
  - There is deliberately **no limit shared by all clients**: a single counter would let an
    attacker with a handful of IPs (or IPv6 /64s) lock every user out of login and sign-up.
    Resource exhaustion from argon2 is handled in `PasswordHasher` instead (next bullet).
  - Limit 2 is configurable only so the local Docker stack (`docker-compose.yml`, 1000) can serve
    the frontend's e2e suite, whose requests all come from one client IP. Every other environment,
    production included, keeps the default. Limit 1 stays fixed.
  - 20 / min per IP may be tight behind carrier-grade NAT (common on LatAm mobile networks, where
    many users share one IP): monitor 429s on login/sign-up after the first deploy.
  - The credential throttlers use `skipIf` so they never apply to other routes, and the
    `default` throttler is never overridden on credential routes.
  - **Remaining lockout trade-off**: keying by IP + email means an attacker elsewhere cannot lock
    a victim out, but one sharing the victim's IP (same NAT, office or mobile carrier) can, for
    up to 60 s.
- **argon2 concurrency and queue**: every hash/verify (including the dummy verify) goes through
  `PasswordHasher`, which runs at most `ARGON2_MAX_CONCURRENCY` (default 4) at once and lets at
  most `ARGON2_MAX_QUEUE` (default 32) callers wait for a permit. When the queue is full the call
  fails immediately with `ServerBusyException` (503 "Server is busy, try again shortly"), so a
  burst cannot exhaust memory (~64 MiB each), CPU or request latency. This, not a global
  throttler, is the answer to distributed floods. Trade-off: while a flood keeps the queue full,
  legitimate logins also get 503; unlike a global counter, they recover as soon as it stops.
- **Placeholder secret**: with `NODE_ENV=production` the app refuses to start if `JWT_SECRET` is
  the `.env.example` placeholder.
- **Swappable boundary**: only `AuthModule` knows how users authenticate. The rest of the code
  depends on the global guard, `@Public()` and `@CurrentUser()` (in `src/common/decorators/`), so
  moving to an external provider only replaces `AuthModule`.

### Deployment prerequisite: trusted proxy

**Not implemented; decide the topology before the first deploy.** The per-IP limits are only as
good as the client IP behind them.

- `TRUST_PROXY` must match the Next.js server exactly (its IP/CIDR, or the exact hop count).
- With the default `loopback` in a split deployment (API and Next.js on different hosts), every
  user shares the Next server's IP, so the per-IP limit (20 / min) produces legitimate 429s.
- On Vercel the egress IPs are dynamic, so address-based trust cannot work. The planned fix is to
  authenticate the forwarded IP with a shared-secret header sent by the Next server and checked by
  the API, instead of trusting an address.
- The frontend must sit behind a proxy that overwrites or appends `X-Forwarded-For`. A self-hosted
  Next.js reachable directly lets clients choose their own IP.
- Carrier-grade NAT (see the per-IP limit above) can still make 20 / min tight on mobile networks.
- E2E is not in CI (team decision), so none of this is exercised automatically: it must be
  verified by hand in the first deployed environment.

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
- **Tested by**: `src/config/env.validation.spec.ts` (missing/short secret, placeholder rejected
  in production).

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
- **The current user may no longer exist**: the global guard only verifies the token (signature,
  expiry, `sub` is a UUID); it does not check that the user still exists. Any endpoint that reads
  or writes on behalf of `@CurrentUser()` must handle a missing user: a not-found lookup or a
  foreign key violation (P2003) on a write maps to `401` (or `404` for the target resource),
  never a `500`. `GET /auth/me` returns `401`.
- **Ownership (BOLA/IDOR)**: the service filters by owner in the query itself
  (`where: { id: listingId, sellerId: userId }`) or compares and throws 404/403. Hiding a button in the
  frontend protects nothing.
- **Roles**: `@Roles(...)` + `RolesGuard` only for coarse authorization; rules about data go in the
  service.
- **Mass assignment**: `whitelist` + `forbidNonWhitelisted`; separate DTOs per role if the editable
  fields differ.
- **Passwords**: argon2id via `PasswordHasher` (concurrency-capped), 8–128 characters at sign-up;
  never in responses or logs.
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
