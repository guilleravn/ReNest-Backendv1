# Business invariants

Rules the system must always uphold. Each entry states the exact mechanism, what it protects, and how it fails if broken. Only rules that have been agreed belong here. If it is not listed, it is not a confirmed rule.

Security invariants (auth, tokens, ownership, input validation) live in [security.md](security.md).

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
