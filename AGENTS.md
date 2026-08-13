# Agent instructions — Slotcraft

Monorepo: pnpm workspaces + Turborepo. Web (`apps/web`), API (`apps/api`), shared Zod package (`packages/shared`). Postgres via root `docker-compose.yml`.

## Local / cloud common commands

| Task | Command |
|------|---------|
| Full local setup | `pnpm setup` or see README |
| Dev servers | `pnpm dev` |
| Lint / typecheck | `pnpm lint` |
| Production build | `pnpm build` |
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
3. If `@slotcraft/shared` imports fail (e.g. `Cannot find module '@slotcraft/shared/dist/index.js'` during `db:seed`/`dev`): the committed `packages/shared/tsconfig.tsbuildinfo` makes incremental `tsc` skip emitting `dist/index.js` on a clean checkout (only a `.d.ts.map` appears). Delete it first, then rebuild: `rm -f packages/shared/tsconfig.tsbuildinfo && pnpm --filter @slotcraft/shared build`.
4. If Prisma errors on `DATABASE_URL`: confirm `apps/api/.env` exists (install script copies from `.env.example`).

### Secrets (optional)

Default dev values from `.env.example` are copied on install and are enough for local Postgres + JWT in cloud.

For non-default secrets, add them in [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents) (Runtime Secret for `JWT_SECRET`, etc.). Restart the agent after adding secrets.

### Verifying agent work

- `pnpm lint` and `pnpm build` when changing types or shared contracts.
- Hit API: `curl -s http://localhost:3001/health`.
- Manual UI checks on :3000 for calendar / booking flows (conflict → 409, viewer → 403).

### Faster startups (snapshot)

After a successful agent-driven or first Dockerfile boot, save a **snapshot** from [Environments](https://cursor.com/dashboard/cloud-agents#environments) and optionally set `"snapshot": "<id>"` in `.cursor/environment.json` to skip repeated Docker layer work.

## Field Eng demo — repo defaults

These project rules live in this repo only (not team/org dashboard rules). Automations, Jira “Use Cursor”, and cloud agents should follow them.

| Item | Value |
|------|--------|
| Canonical GitHub repo | `christineywang/slotcraft` |
| Default base branch | `main` |

## PRs, evidence, and review

- **UI / feature PRs — evidence required:** For user-visible or UI work, you **must** include a short demo video and/or screenshots in the PR proving the change works. Commit files on the PR branch (e.g. `.github/evidence/<ticket-or-slug>/`). If you cannot capture evidence, say so in the PR with a reason; do not omit silently.
- **Screenshots and video in PR bodies:** Never use relative paths (e.g. `.github/evidence/...`). Embed using **absolute** raw GitHub URLs only: `https://raw.githubusercontent.com/christineywang/slotcraft/<branch>/path/to/file.png` (or `.webm` / `.mp4`; replace `<branch>` with the PR head branch). See `.cursor/rules/pr-evidence-urls.mdc`.
- **Draft PRs / Bugbot:** Cursor “Open PR” often creates drafts; Bugbot skips drafts by default. After opening a draft PR, run `gh pr ready` so it is ready for review.

## Jira (CHR / fe-anysphere-demo)

When writing Jira descriptions or comments for project CHR or fe-anysphere-demo: use GitHub-flavored Markdown (`##` headings, `**bold**`, lists, links). Do not use Confluence wiki markup (`h2.`, `{code}`, etc.) — it renders as plain text in Jira Cloud.
