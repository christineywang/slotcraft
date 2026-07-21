# Slotcraft

Personal learning + demo monorepo: **resource booking** with real conflict detection, roles, and a Northlight week calendar.

Not a toy todo list — the interesting bits are overlap rejection, JWT authz, and a week-grid UI that makes those rules visible in a 5-minute demo.

## Stack

| Layer | Tech |
|--------|------|
| Web | Next.js 15 (App Router) + Tailwind |
| API | NestJS + Prisma + JWT |
| DB | Postgres 16 (Docker Compose) |
| Monorepo | pnpm workspaces + Turborepo |
| Shared | Zod schemas in `@slotcraft/shared` |

```
slotcraft/
├── apps/
│   ├── web/          # Next.js UI (login + week calendar)
│   └── api/          # NestJS API (auth, resources, bookings)
├── packages/
│   ├── shared/       # Zod contracts + demo credentials
│   └── tsconfig/     # shared TypeScript base
├── docs/
│   ├── ARCHITECTURE.md
│   └── DOMAIN.md
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) 10+
- Docker (for Postgres)

## Quick start

```bash
# 1. Clone / open the repo, then from the root:
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 2. Install + database
pnpm install
pnpm db:up
pnpm --filter @slotcraft/shared build
pnpm db:migrate
pnpm db:seed

# 3. Run API (:3001) + web (:3000)
pnpm dev
```

- **Web:** http://localhost:3000  
- **API health:** http://localhost:3001/health  

### Demo credentials

| Role   | Email                     | Password    |
|--------|---------------------------|-------------|
| Admin  | `admin@slotcraft.local`   | `slotcraft` |
| Viewer | `viewer@slotcraft.local`  | `slotcraft` |
| Member | `member@slotcraft.local`  | `slotcraft` |

## 5-minute demo script

1. `pnpm db:up && pnpm db:seed && pnpm dev`
2. Log in as **admin** → week calendar for Studio A / Boardroom / Desk 12
3. Click an empty hour → **Book** → teal block springs onto the grid (**success**)
4. Book the **same** slot again → coral banner + conflicting block highlighted (**409**)
5. Sign out → log in as **viewer** → open a slot → Book disabled / API **403**

That three-beat story (success / conflict / authz) is the point of the app.

## Scripts

| Command | What it does |
|---------|----------------|
| `pnpm dev` | API + web in parallel (Turbo) |
| `pnpm build` | Build shared → api → web |
| `pnpm lint` | Typecheck all packages |
| `pnpm db:up` | Start Postgres (`docker compose up -d`) |
| `pnpm db:down` | Stop Postgres |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Seed org, users, resources, sample bookings |
| `pnpm db:reset` | Reset DB + re-run migrations/seed |

## Build (production)

```bash
pnpm install
pnpm --filter @slotcraft/shared build
pnpm build
```

- API output: `apps/api/dist`
- Web output: `apps/web/.next`

Run API alone after build:

```bash
cd apps/api && node --env-file=../../.env dist/main.js
```

## Environment

Root [`.env.example`](.env.example) and package-local examples:

| File | Purpose |
|------|---------|
| `.env` | Shared secrets (`DATABASE_URL`, `JWT_SECRET`, ports) |
| `apps/api/.env` | Prisma + Nest (must include `DATABASE_URL`) |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_URL` |

Defaults point at local Docker Postgres:

```
postgresql://slotcraft:slotcraft@localhost:5432/slotcraft?schema=public
```

## Where the complexity lives

- **Conflict logic:** [`apps/api/src/bookings/bookings.service.ts`](apps/api/src/bookings/bookings.service.ts) — transactional overlap check → `409`
- **Roles:** JWT payload + `@Roles(...)` guard — viewers cannot `POST /bookings`
- **Calendar UX:** [`apps/web/src/components/WeekCalendar.tsx`](apps/web/src/components/WeekCalendar.tsx) + booking side panel

## Docs

- [Architecture](docs/ARCHITECTURE.md) — request path FE → API → Prisma
- [Domain](docs/DOMAIN.md) — booking rules & roles

## Phase map

- **Phase 1 (this repo):** login, resources, week calendar, create booking, conflict + authz
- **Phase 2+:** availability hours, cancel/reschedule, tests, optional websockets

## Troubleshooting

**Postgres not ready** — wait a few seconds after `pnpm db:up`, or check `docker compose ps`.

**Prisma can’t see `DATABASE_URL`** — ensure `apps/api/.env` exists (`cp apps/api/.env.example apps/api/.env`).

**`@slotcraft/shared` import errors** — run `pnpm --filter @slotcraft/shared build` before `pnpm dev` / `pnpm build`.

**Port in use** — web defaults to `3000`, API to `3001`; change via `.env` / `API_PORT`.
