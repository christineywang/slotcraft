# Architecture

## Request path

```
Browser (Next.js)
  └─ fetch + Bearer JWT
       └─ NestJS JwtAuthGuard / RolesGuard
            └─ Controller
                 └─ Service (domain rules)
                      └─ Prisma
                           └─ Postgres
```

### Auth

1. `POST /auth/login` validates email/password (bcrypt), loads the user’s org membership, signs a JWT (`sub`, `email`, `name`, `organizationId`, `role`).
2. Web stores the token + session in `localStorage`.
3. Subsequent API calls send `Authorization: Bearer <token>`.
4. Global `JwtAuthGuard` protects all routes except those marked `@Public()`.
5. `@Roles(...)` + `RolesGuard` enforce write permissions (viewers blocked on booking/resource writes).

### Modules (`apps/api`)

| Module | Responsibility |
|--------|----------------|
| `AuthModule` | login, JWT strategy, global guards |
| `ResourcesModule` | list + admin CRUD (owner/admin) |
| `BookingsModule` | range queries, create, reschedule, soft cancel |
| `PrismaModule` | shared PrismaClient |

### Conflict algorithm

`BookingsService.create` / `update` run inside `prisma.$transaction`:

1. Reject intervals outside the resource’s availability hours.
2. Load confirmed bookings for the resource that intersect `[startsAt, endsAt)` (excluding self on update).
3. If overlapping count ≥ `capacity` → `409 Conflict` with human-readable message + conflicting booking payload.
4. Else insert / update the booking.

Pure helpers live in `booking-rules.ts` (unit tested). Single source of truth for the demo: `apps/api/src/bookings/bookings.service.ts`.

### Frontend

- `/` — login with role quick-switch (admin / member / viewer)
- `/calendar` — resource switcher, week grid, booking panel (create/edit/cancel), resource admin
- Polling (~8s) refreshes the grid when panels are closed
- `@slotcraft/shared` keeps Zod contracts aligned with API inputs
