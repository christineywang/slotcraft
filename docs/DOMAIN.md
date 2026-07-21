# Domain

## Entities

- **Organization** — tenant boundary (seed: Northlight Studios)
- **Membership** — user ↔ org with role
- **Resource** — bookable room/desk (timezone + capacity)
- **Booking** — interval on a resource owned by a host user

## Roles

| Role | Read calendar | Create/cancel booking | Manage resources (Phase 2) |
|------|---------------|------------------------|----------------------------|
| `owner` / `admin` | yes | yes | yes |
| `member` | yes | yes | no |
| `viewer` | yes | no | no |

## Booking rules (Phase 1)

1. **Interval validity** — `endsAt` must be after `startsAt`.
2. **Org isolation** — resources and bookings are always scoped to the JWT’s `organizationId`.
3. **Overlap rejection** — two *confirmed* bookings on the same resource must not intersect:  
   `a.startsAt < b.endsAt && a.endsAt > b.startsAt`.
4. **Capacity** — schema has `capacity`; Phase 1 treats capacity as `1` (hard exclusive).
5. **Cancel** — soft cancel via `status = cancelled` (excluded from conflict checks).

## Demo seed story

- Admin: Alex Admin  
- Viewer: Vera Viewer  
- Seeded “Product sync” on Studio A (Wednesday slot) so conflicts are easy to trigger during demos.
