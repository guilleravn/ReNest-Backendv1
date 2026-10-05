# Business invariants

Rules the system must always uphold. Each entry states the exact mechanism, what it protects, and how it fails if broken. Only rules that have been agreed belong here. If it is not listed, it is not a confirmed rule.

## Format

```
### <Rule name>
- **Requires**: the exact mechanism (DB constraint, transaction + lock, guard, validation...).
- **Protects**: the business invariant.
- **Fails as**: what concretely happens if it breaks.
- **Tested by**: test file / test name.
```

## Domain invariants

**TBD.** They get filled in as features are built. The domain is item rentals; no rules have been agreed yet.

Open questions to resolve before the first rental feature:
- Can the same item be rented for overlapping periods? (If not, this becomes the main concurrency invariant.)
- Who can list items, and can a user rent their own item?
- Does a rental have states (requested / accepted / active / returned / cancelled), and which transitions are allowed?

## Evaluated and rejected

Alternatives considered and why they were not chosen.

*None yet.*

## Security invariants

Auth is implemented in-house and **does not exist yet**. These rules apply from the auth slice onwards:

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
