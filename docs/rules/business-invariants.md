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

The domain is a C2C secondhand marketplace: a seller publishes a **listing** with one or more
**pickup options** (a location + day + time range); a buyer creates a **reservation** by choosing
one pickup option; the seller confirms the handover and the buyer confirms reception.

The rules below are **agreed** (MVP scope). The data model is not designed yet, so the exact
mechanism (**Requires**) of each one is decided with the ERD and filled in by the slice that
implements it, together with **Tested by**. Until then, do not pick a mechanism on your own: the
plan for the issue must state it.

### A reservation uses one pickup option exactly as the seller created it
- **Requires**: TBD (ERD). The buyer sends a pickup option that belongs to that listing; the API
  never accepts a location and a time as separate values.
- **Protects**: the buyer cannot combine a location from one option with a time from another.
- **Fails as**: a meetup at a place/time the seller never offered.
- **Tested by**: TBD.

### A listing can be reserved by only one buyer
- **Requires**: TBD (ERD): a DB constraint or a row lock inside a transaction (see
  [database.md](../conventions/database.md#transactions)). The losing request gets `409`.
- **Protects**: two buyers confirming at the same time never both get the item.
- **Fails as**: two active reservations for the same listing.
- **Tested by**: TBD. Concurrency e2e test against real Postgres (see
  [testing.md](../conventions/testing.md)).

### Pickup options can only change on an active, unreserved listing
- **Requires**: TBD (ERD). The service checks the listing status and the absence of a
  reservation in the same transaction as the change; otherwise `409`.
- **Protects**: the pickup the buyer already chose cannot change under them.
- **Fails as**: a reserved buyer shows up at a place/time that no longer exists.
- **Tested by**: TBD.

### Pickup details are only visible to the buyer and seller of that reservation
- **Requires**: TBD (ERD). Enforced in the API response (query filtered by the current user), not
  only hidden in the UI. See [security.md](security.md).
- **Protects**: the private meetup details of other users' transactions.
- **Fails as**: any user reads another transaction's pickup details by calling the API.
- **Tested by**: TBD.

### Reception is a separate step, done later by the buyer
- **Requires**: TBD (ERD). Reserving never requires or triggers reception; reception is its own
  action, allowed only to the buyer of that reservation.
- **Protects**: the buyer can leave right after reserving.
- **Fails as**: a reservation that cannot be completed without confirming reception on the spot.
- **Tested by**: TBD.

### A sale is completed only when both sides confirm
- **Requires**: TBD (ERD). Seller handover confirmation and buyer reception confirmation are
  stored separately, each with its own timestamp. Listing status: Active → Pending (reserved) →
  Completed (handover confirmed).
- **Protects**: the North Star metric (completed transactions per week) counts real, two-sided
  closures.
- **Fails as**: a sale counted with only one confirmation, or a confirmation with no timestamp.
- **Tested by**: TBD.

### A listing cannot be published without a photo, and a pickup option needs day, location and time range
- **Requires**: TBD. DTO validation plus a service check at publish time; no placeholder values.
- **Protects**: buyers always see a real photo and a complete, usable pickup option.
- **Fails as**: published listings with no photo or with an empty/placeholder location.
- **Tested by**: TBD.

Open questions (resolve with the ERD or in the issue's plan, never by assumption):
- Which pickup fields are public (shown to any buyer choosing an option) and which are private
  (shown only after reserving)? The buyer must see enough to choose.
- Can a seller reserve their own listing? Can a reservation be cancelled in the MVP, and by whom?
- Currency of `priceCents` for the MVP (one country/currency, or a currency field)?

## Evaluated and rejected

Alternatives considered and why they were not chosen.

*None yet.*
