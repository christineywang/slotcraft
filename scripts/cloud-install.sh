#!/usr/bin/env bash
# Idempotent Cloud Agent install (runs on every agent boot from environment.json).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v sudo >/dev/null && ! docker info >/dev/null 2>&1; then
  sudo service docker start
fi

echo "==> Env files (from examples if missing)"
[[ -f .env ]] || cp .env.example .env
[[ -f apps/api/.env ]] || cp apps/api/.env.example apps/api/.env
[[ -f apps/web/.env.local ]] || cp apps/web/.env.example apps/web/.env.local

echo "==> pnpm install"
pnpm install

echo "==> Prisma client"
pnpm --filter @slotcraft/api prisma:generate

echo "==> Build @slotcraft/shared"
pnpm --filter @slotcraft/shared build

echo "==> Postgres (docker compose)"
pnpm db:up

echo "==> Wait for Postgres"
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U slotcraft -d slotcraft >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker compose exec -T postgres pg_isready -U slotcraft -d slotcraft

echo "==> Migrate + seed"
pnpm db:migrate
pnpm db:seed

echo "==> Cloud install complete"
