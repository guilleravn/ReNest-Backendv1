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
**pickup options** (a location + one or more weekdays + an hour range); a buyer creates a
**reservation** by choosing one pickup option as a whole (the exact day among its weekdays is
coordinated on WhatsApp); the seller confirms the handover and the buyer confirms reception.

The rules below are **agreed** (MVP scope). **Requires** names the mechanism defined in the ERD
([erd.dbml](../erd.dbml)); **Tested by** is filled in by the slice that implements each rule.

### A reservation uses one pickup option exactly as the seller created it
- **Requires**: the buyer sends only a `pickupOptionId`; the API never accepts a location, weekday
  or time as separate values. Composite FK `reservations(pickup_option_id, listing_id)` →
  `pickup_options(id, listing_id)` guarantees in the DB that the option belongs to that listing.
- **Protects**: the buyer cannot combine a location from one option with a time from another.
- **Fails as**: a meetup at a place/time the seller never offered.
- **Tested by**: TBD.

### A listing can be reserved by only one buyer
- **Requires**: in one transaction: `UPDATE listings SET status = 'PENDING' WHERE id = ? AND
  status = 'ACTIVE'` (0 rows → `409`), then insert the reservation. `reservations.listing_id
  UNIQUE` is the DB backstop: a unique violation (P2002) also maps to `409`. See
  [database.md](../conventions/database.md#transactions).
- **Protects**: two buyers confirming at the same time never both get the item.
- **Fails as**: two active reservations for the same listing.
- **Tested by**: TBD. Concurrency e2e test against real Postgres (see
  [testing.md](../conventions/testing.md)).

### A seller cannot reserve their own listing
- **Requires**: service check `buyerId !== listing.sellerId` before reserving (cross-table, so no
  DB CHECK); otherwise `403`.
- **Protects**: sales and the North Star only count real two-party transactions.
- **Fails as**: a seller inflates completed transactions by buying their own items.
- **Tested by**: TBD.

### Reservations cannot be cancelled in the MVP
- **Requires**: no cancel endpoint; `reservations.listing_id UNIQUE` assumes one reservation per
  listing forever. Adding cancellation later needs a partial unique index instead.
- **Protects**: a reserved item stays with its buyer.
- **Fails as**: n/a (out of scope); listed so nobody adds a cancel flow without a decision.
- **Tested by**: n/a.

### Pickup options can only change on an active, unreserved listing
- **Requires**: the service checks `listings.status = 'ACTIVE'` and that no reservation exists, in
  the same transaction as the change; otherwise `409`. The Restrict FK from `reservations` also
  blocks deleting a reserved option.
- **Protects**: the pickup the buyer already chose cannot change under them.
- **Fails as**: a reserved buyer shows up at a place/time that no longer exists.
- **Tested by**: TBD.

### A published listing always has at least one pickup option
- **Requires**: publish requires at least one pickup option (C5); removing an option is rejected
  with `409` when it is the listing's last one (C7). Checked in the service, in the same
  transaction as the write.
- **Protects**: every reservable listing offers at least one way to pick it up.
- **Fails as**: an active listing nobody can reserve.
- **Tested by**: TBD.

### Pickup details are only visible to the buyer and seller of that reservation
- **Requires**: public fields (any buyer choosing an option): `location_label`, `weekdays`,
  `start_time`, `end_time`. Private fields: `address`, `latitude`, `longitude`, returned only to
  the listing's seller and to the buyer of its reservation. Enforced with separate response DTOs /
  `select` in the API, not only hidden in the UI. See [security.md](security.md).
- **Protects**: the private meetup details of other users' transactions.
- **Fails as**: any user reads another transaction's pickup details by calling the API.
- **Tested by**: TBD.

### Reception is a separate step, done later by the buyer
- **Requires**: reserving never sets `buyer_received_at`; reception is its own action, allowed only
  to the buyer of that reservation, and independent of the seller's handover.
- **Protects**: the buyer can leave right after reserving.
- **Fails as**: a reservation that cannot be completed without confirming reception on the spot.
- **Tested by**: TBD.

### Each side confirms independently; the transaction is completed when both have
- **Requires**: two timestamps on `reservations`:
  - Seller handover → `seller_handed_over_at` + `listings.status = 'COMPLETED'` in one
    transaction (My Listings, C10).
  - Buyer reception → `buyer_received_at` + `reservations.status = 'COMPLETED'` (My Purchases, A7),
    saved together with the inspection checklist. CHECK `(status = 'COMPLETED') = (buyer_received_at
    IS NOT NULL)`. The buyer's confirmation is the one that matters for the buyer: it unlocks the
    rating, whether or not the seller confirmed first.
  - North Star: both timestamps set, counted at the later of the two.
- **Protects**: the North Star metric (completed transactions per week) counts real, two-sided
  closures, and each user sees their own side's status.
- **Fails as**: a sale counted with only one confirmation, or a buyer stuck in "In progress" after
  confirming.
- **Tested by**: TBD.

### Only the buyer rates, once, after confirming reception
- **Requires**: `seller_ratings.reservation_id UNIQUE`; the service allows it only to the buyer of
  that reservation and only once `buyer_received_at` is set; `seller_id` is copied from the
  listing, never from input. CHECK `stars BETWEEN 1 AND 5`.
- **Protects**: seller ratings come from real, completed purchases.
- **Fails as**: fake or duplicate ratings distorting the seller's trust badge.
- **Tested by**: TBD.

### A listing cannot be published without a photo, and a pickup option needs weekdays, location and hour range
- **Requires**: DTO validation (at least one weekday, no duplicates, non-empty location and
  address, `end_time > start_time`, also as DB CHECKs) plus a service check at publish time for at
  least one photo, in the same transaction; no placeholder values.
- **Protects**: buyers always see a real photo and a complete, usable pickup option.
- **Fails as**: published listings with no photo or with an empty/placeholder location.
- **Tested by**: TBD.

### A listing price is whole US dollars, at least $1
- **Requires**: `price_cents` integer in USD minor units (single currency in the MVP, so no
  `currency` column); CHECK `price_cents >= 100`. The create form takes whole dollars, so the DTO
  also requires a multiple of 100.
- **Protects**: buyers always see a real, positive price in one currency.
- **Fails as**: free or fractional-cent listings, or prices that mean different things per country.
- **Tested by**: TBD.

Decided 2026-10-06 (A1 plan): currency is USD only (the prototype asks for "whole dollars, at
least $1"); `description` is optional (NULL when not given). Adding a currency later is an
additive migration.

## Evaluated and rejected

Alternatives considered and why they were not chosen.

- **Pickup option as one `starts_at`/`ends_at` interval**: a seller offers recurring availability
  ("Mondays 10–13, Saturdays 16–20"), not a single closed slot.
- **Buyer picks a concrete date when reserving**: not in the MVP; the pair is reserved as a whole
  and the exact day is coordinated on WhatsApp.
- **Full-text search over title + description**: the AC asks for title matches (B1); full-text
  returns description-only hits and does not match substrings. Title `ILIKE` instead.
