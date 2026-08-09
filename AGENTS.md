# Agent instructions — Slotcraft

Monorepo: pnpm workspaces + Turborepo. Web (`apps/web`), API (`apps/api`), shared Zod package (`packages/shared`). Postgres via root `docker-compose.yml`.

## Local / cloud common commands

| Task | Command |
|------|---------|
| Full local setup | `pnpm setup` or see README |
| Dev servers | `pnpm dev` |
| Lint / typecheck | `pnpm lint` |
| Production build | `pnpm build` |
| Unit tests | `pnpm test` |
| Runtime smoke | `pnpm smoke` (API `/health`, admin login, web login page; needs `pnpm dev`) |
| DB up / down | `pnpm db:up` / `pnpm db:down` |
| Migrations | `pnpm db:migrate` |
| Reset DB + seed | `pnpm db:reset` |

Demo logins (after seed): `admin@slotcraft.local` / `slotcraft` (also viewer and member — see README).

API health: `http://localhost:3001/health`. Web: `http://localhost:3000`.

## Cursor Cloud specific instructions

Cloud agents use `.cursor/environment.json` in this repo. On boot they run `scripts/cloud-install.sh` (deps, Docker Postgres, migrate, seed), start Docker, then run `pnpm dev` in a shared terminal.

### If something fails during boot

1. Ensure Docker is up: `sudo service docker start` then `docker compose ps`.
2. Re-run install steps: `bash scripts/cloud-install.sh`.
3. If `@slotcraft/shared` imports fail: `pnpm --filter @slotcraft/shared build`.
4. If Prisma errors on `DATABASE_URL`: confirm `apps/api/.env` exists (install script copies from `.env.example`).

### Secrets (optional)

Default dev values from `.env.example` are copied on install and are enough for local Postgres + JWT in cloud.

For non-default secrets, add them in [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents) (Runtime Secret for `JWT_SECRET`, etc.). Restart the agent after adding secrets.

### Verifying agent work

- `pnpm lint` and `pnpm build` when changing types or shared contracts.
- Hit API: `curl -s http://localhost:3001/health`.
- Or run `pnpm smoke` after `pnpm dev` for `/health` + admin login + web login page.
- Manual UI checks on :3000 for calendar / booking flows (conflict → 409, viewer → 403).

### Faster startups (snapshot)

After a successful agent-driven or first Dockerfile boot, save a **snapshot** from [Environments](https://cursor.com/dashboard/cloud-agents#environments) and optionally set `"snapshot": "<id>"` in `.cursor/environment.json` to skip repeated Docker layer work.
