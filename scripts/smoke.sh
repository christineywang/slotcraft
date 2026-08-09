#!/usr/bin/env bash
# Runtime smoke checks for Slotcraft API + web (requires `pnpm dev`).
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
EMAIL="${SMOKE_EMAIL:-admin@slotcraft.local}"
PASSWORD="${SMOKE_PASSWORD:-slotcraft}"

fail() {
  echo "smoke FAIL: $*" >&2
  exit 1
}

echo "→ GET ${API_URL}/health"
health="$(curl -fsS "${API_URL}/health")"
echo "  ${health}"
echo "${health}" | grep -q '"ok":true' || fail "health missing ok:true"
echo "${health}" | grep -q 'slotcraft-api' || fail "health missing service name"

echo "→ POST ${API_URL}/auth/login (admin)"
login="$(curl -fsS -X POST "${API_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"
echo "${login}" | grep -q 'accessToken' || fail "login missing accessToken"
echo "${login}" | grep -q "${EMAIL}" || fail "login missing email ${EMAIL}"

echo "→ GET ${WEB_URL}/ (login page)"
web_code="$(curl -sS -o /tmp/slotcraft-smoke-web.html -w '%{http_code}' "${WEB_URL}/")"
[[ "${web_code}" == "200" ]] || fail "web login page returned HTTP ${web_code}"
grep -q 'Slotcraft' /tmp/slotcraft-smoke-web.html || fail "web page missing Slotcraft brand"
grep -qi 'email\|password\|Continue\|Signing' /tmp/slotcraft-smoke-web.html \
  || fail "web page missing login form markers"

echo "smoke OK"
