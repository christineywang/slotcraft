# Domain

## Entities

- **Organization** — tenant boundary (seed: Northlight Studios)
- **Membership** — user ↔ org with role
- **Resource** — bookable room/desk (timezone, capacity, availability hours)
- **Booking** — interval on a resource owned by a host user

## Roles

| Role | Read calendar | Create booking | Cancel/edit | Manage resources |
|------|---------------|----------------|-------------|------------------|
| `owner` / `admin` | yes | yes | any booking | yes |
| `member` | yes | yes | own bookings only | no |
| `viewer` | yes | no | no | no |

## Booking rules (v2)

1. **Interval validity** — `endsAt` must be after `startsAt`.
2. **Org isolation** — resources and bookings are always scoped to the JWT’s `organizationId`.
3. **Availability hours** — interval must fall on a single local day inside `[availableFromHour, availableToHour)`.
4. **Capacity-aware overlap** — confirmed bookings that intersect count toward `capacity`. Reject when overlapping count ≥ capacity.
5. **Cancel** — soft cancel via `status = cancelled` (excluded from conflict checks).
6. **Reschedule** — `PATCH /bookings/:id` re-runs availability + capacity checks, excluding the booking being edited.

## Demo seed story

- Admin: Alex Admin — can manage resources and edit anyone’s bookings
- Member: Morgan Member — owns “Design critique” + Desk 12 “Focus block”
- Viewer: Vera Viewer — read-only
- Studio A — capacity 1, open 9–18, seeded “Product sync” Wednesday 14:00
- Boardroom — capacity 1, open 8–20, seeded “Design critique” Thursday
- Desk 12 — capacity 2, open 8–20, seeded “Focus block” Wednesday 14:00 (one seat free)
