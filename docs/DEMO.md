# Demo script (Slotcraft v2)

Aim for ~7 minutes. Reset first so seeded conflicts are fresh:

```bash
pnpm db:reset && pnpm dev
```

## Beats

### 1. Success (admin)

1. On login, leave **Admin** selected → Continue.
2. Open **Studio A**. Click an empty mid-morning hour → Book “Standup”.
3. Teal block springs onto the grid.

### 2. Hard conflict (capacity 1)

1. Book the same Studio A slot again (or Wednesday 2–3pm **Product sync**).
2. Coral banner + conflicting block flashes (**409**).

### 3. Cancel frees the slot

1. Click the conflicting booking → **Cancel booking**.
2. Re-book the same hour → success.

### 4. Availability hours

1. Still on Studio A (open **9–6**). Click an **8am** closed (dimmed) slot → Book.
2. API rejects with “only bookable 9 AM–6 PM”.

### 5. Capacity > 1

1. Switch to **Desk 12** (badge ×2). Wednesday 2pm already has **Focus block** (1 of 2 seats).
2. Book a second overlapping hour → succeeds (side-by-side blocks).
3. Book a third overlap → **at capacity** 409.

### 6. Role boundaries

1. Sign out → **Member**. Click Alex’s **Product sync** (or any admin-hosted booking).
2. Panel explains members can only edit their own; Cancel disabled.
3. Sign out → **Viewer** → Book disabled / create returns **403**.

### 7. Resource admin (optional)

1. Sign in as **Admin** → **Resources**.
2. Change Desk 12 capacity or add a room — calendar switcher updates immediately.

## Talking points

- Overlap + capacity logic lives in one transactional path (`bookings.service.ts`).
- Soft cancel excludes bookings from conflict checks.
- JWT roles gate writes; members are scoped to their own bookings.
- Shared Zod contracts keep FE/API aligned (`@slotcraft/shared`).
