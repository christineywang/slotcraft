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
5. `@Roles(...)` + `RolesGuard` enforce write permissions (viewers blocked on `POST /bookings`).

### Modules (`apps/api`)

| Module | Responsibility |
|--------|----------------|
| `AuthModule` | login, JWT strategy, global guards |
| `ResourcesModule` | list org resources |
| `BookingsModule` | range queries + conflict-checked create |
| `PrismaModule` | shared PrismaClient |

### Conflict algorithm

`BookingsService.create` runs inside `prisma.$transaction`:

1. Load confirmed bookings for the resource that intersect `[startsAt, endsAt)`.
2. If any overlap → `409 Conflict` with human-readable message + conflicting booking payload.
3. Else insert the new booking.

Single source of truth for the demo: point at `apps/api/src/bookings/bookings.service.ts`.

### Frontend

- `/` — login (Northlight)
- `/calendar` — resource switcher + week grid + booking side panel
- `@slotcraft/shared` keeps Zod contracts aligned with API inputs
