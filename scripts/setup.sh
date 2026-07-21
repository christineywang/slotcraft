#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Slotcraft setup"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "    created .env"
fi
if [[ ! -f apps/api/.env ]]; then
  cp apps/api/.env.example apps/api/.env
  echo "    created apps/api/.env"
fi
if [[ ! -f apps/web/.env.local ]]; then
  cp apps/web/.env.example apps/web/.env.local
  echo "    created apps/web/.env.local"
fi

echo "==> pnpm install"
pnpm install

echo "==> Postgres (docker compose)"
pnpm db:up

echo "==> Build shared package"
pnpm --filter @slotcraft/shared build

echo "==> Migrate + seed"
pnpm db:migrate
pnpm db:seed

echo ""
echo "Done. Start with:  pnpm dev"
echo "  Web  http://localhost:3000"
echo "  API  http://localhost:3001/health"
echo "  Admin  admin@slotcraft.local / slotcraft"
