# AGENTS.md

## Cursor Cloud specific instructions

Slotcraft is a pnpm + Turborepo monorepo. Standard commands and demo credentials live in `README.md`; scripts are in the root `package.json`. Notes below cover only non-obvious, durable caveats for running it in Cursor Cloud.

### Services
- `@slotcraft/shared` — Zod contracts compiled to `packages/shared/dist` (consumed by api + web).
- `@slotcraft/api` — NestJS API on `:3001` (`/health`), needs Postgres.
- `@slotcraft/web` — Next.js UI on `:3000` (`/calendar`).
- Postgres 16 — via Docker Compose (`docker-compose.yml`), on `:5432`.

### Startup (services are NOT auto-started by the update script)
1. Docker daemon must be running. On a fresh pod it is started manually (systemd is unavailable): `sudo dockerd &`. The `ubuntu` user is in the `docker` group, so `docker`/`pnpm db:up` work without sudo once the daemon is up.
2. `pnpm db:up` — start Postgres. The DB lives in a Docker volume and starts empty, so it must be migrated + seeded before use: `pnpm db:migrate && pnpm db:seed`.
3. `pnpm dev` — runs api + web + `shared` (tsc watch) in parallel via Turbo.

### Non-obvious caveats
- `pnpm dev` does NOT build `@slotcraft/shared` first (the Turbo `dev` task has no `^build` dependency). The update script pre-builds it; if `packages/shared/dist/index.js` is missing, api/web fail with `Cannot find module '@slotcraft/shared/dist/index.js'`.
- The committed `packages/shared/tsconfig.tsbuildinfo` makes incremental `tsc` skip emitting `dist/index.js` on a clean checkout (only a `.d.ts.map` appears). Delete `packages/shared/tsconfig.tsbuildinfo` before building `@slotcraft/shared`, otherwise the shared library is never emitted. The update script handles this; do the same manually if you rebuild shared after editing it.
- `pnpm lint` is a typecheck (`tsc --noEmit`) across all packages; there is no ESLint.
- Env files (`.env`, `apps/api/.env`, `apps/web/.env.local`) are gitignored; the update script creates them from the `.env.example` templates if missing.
