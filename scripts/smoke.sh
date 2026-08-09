#!/usr/bin/env bash
# Smoke test 3 (CHR-14): API + web runtime path covering health, auth,
# resources, booking create/list/cancel, conflict 409, and viewer 403.
# Requires `pnpm dev` (and seeded DB).
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
ADMIN_EMAIL="${SMOKE_EMAIL:-admin@slotcraft.local}"
ADMIN_PASSWORD="${SMOKE_PASSWORD:-slotcraft}"
VIEWER_EMAIL="${SMOKE_VIEWER_EMAIL:-viewer@slotcraft.local}"
VIEWER_PASSWORD="${SMOKE_VIEWER_PASSWORD:-slotcraft}"

fail() {
  echo "smoke FAIL: $*" >&2
  exit 1
}

json_get() {
  local json="$1"
  local expr="$2"
  python3 -c 'import json,sys; data=json.loads(sys.argv[1]); print(eval(sys.argv[2], {"data": data}))' \
    "${json}" "${expr}"
}

echo "→ GET ${API_URL}/health"
health="$(curl -fsS "${API_URL}/health")"
echo "  ${health}"
echo "${health}" | grep -q '"ok":true' || fail "health missing ok:true"
echo "${health}" | grep -q 'slotcraft-api' || fail "health missing service name"

echo "→ POST ${API_URL}/auth/login (admin)"
admin_login="$(curl -fsS -X POST "${API_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")"
admin_token="$(json_get "${admin_login}" "data['accessToken']")"
[[ -n "${admin_token}" ]] || fail "admin login missing accessToken"
echo "${admin_login}" | grep -q "${ADMIN_EMAIL}" || fail "login missing email ${ADMIN_EMAIL}"

echo "→ GET ${API_URL}/auth/me"
me="$(curl -fsS "${API_URL}/auth/me" -H "Authorization: Bearer ${admin_token}")"
echo "${me}" | grep -q "${ADMIN_EMAIL}" || fail "/auth/me missing admin email"
role="$(json_get "${me}" "data.get('membership',{}).get('role') or data.get('role','')")"
[[ "${role}" == "admin" ]] || fail "/auth/me expected admin role, got '${role}'"

echo "→ GET ${API_URL}/resources"
resources="$(curl -fsS "${API_URL}/resources" -H "Authorization: Bearer ${admin_token}")"
echo "${resources}" | grep -q 'Studio A' || fail "resources missing Studio A"
echo "${resources}" | grep -q 'Boardroom' || fail "resources missing Boardroom"
echo "${resources}" | grep -q 'Desk 12' || fail "resources missing Desk 12"

boardroom_id="$(RESOURCES_JSON="${resources}" python3 - <<'PY'
import json, os, sys
resources = json.loads(os.environ["RESOURCES_JSON"])
for r in resources:
    if r.get("name") == "Boardroom":
        print(r["id"])
        break
else:
    sys.exit("Boardroom not found")
PY
)"
[[ -n "${boardroom_id}" ]] || fail "could not resolve Boardroom id"

# Far-future Monday 10:00–11:00 America/Los_Angeles so we avoid seed conflicts.
slot_json="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
    tz = ZoneInfo("America/Los_Angeles")
except Exception:
    tz = timezone(timedelta(hours=-7))
now = datetime.now(tz)
# Next Monday at least 14 days out
days_ahead = (7 - now.weekday()) % 7
if days_ahead == 0:
    days_ahead = 7
monday = (now + timedelta(days=days_ahead + 14)).replace(
    hour=10, minute=0, second=0, microsecond=0
)
end = monday + timedelta(hours=1)
print(monday.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"))
print(end.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"))
print((monday - timedelta(hours=1)).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"))
print((end + timedelta(hours=1)).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"))
PY
)"
starts_at="$(echo "${slot_json}" | sed -n '1p')"
ends_at="$(echo "${slot_json}" | sed -n '2p')"
from_at="$(echo "${slot_json}" | sed -n '3p')"
to_at="$(echo "${slot_json}" | sed -n '4p')"

echo "→ GET ${API_URL}/resources/${boardroom_id}/bookings"
bookings="$(curl -fsS \
  "${API_URL}/resources/${boardroom_id}/bookings?from=${from_at}&to=${to_at}" \
  -H "Authorization: Bearer ${admin_token}")"
echo "${bookings}" | grep -q '^\[' || fail "bookings list not an array"

echo "→ POST ${API_URL}/bookings (create smoke booking)"
create_body="$(python3 - <<PY
import json
print(json.dumps({
  "resourceId": "${boardroom_id}",
  "title": "CHR-14 smoke test 3",
  "notes": "ephemeral smoke booking",
  "startsAt": "${starts_at}",
  "endsAt": "${ends_at}",
}))
PY
)"
created="$(curl -fsS -X POST "${API_URL}/bookings" \
  -H "Authorization: Bearer ${admin_token}" \
  -H 'Content-Type: application/json' \
  -d "${create_body}")"
booking_id="$(json_get "${created}" "data['id']")"
[[ -n "${booking_id}" ]] || fail "create booking missing id"
echo "  created ${booking_id}"

echo "→ POST ${API_URL}/bookings (expect conflict 409)"
conflict_code="$(curl -sS -o /tmp/slotcraft-smoke-conflict.json -w '%{http_code}' \
  -X POST "${API_URL}/bookings" \
  -H "Authorization: Bearer ${admin_token}" \
  -H 'Content-Type: application/json' \
  -d "${create_body}")"
[[ "${conflict_code}" == "409" ]] || fail "expected conflict HTTP 409, got ${conflict_code}"
grep -q '409\|conflict\|Conflict' /tmp/slotcraft-smoke-conflict.json \
  || fail "conflict response missing conflict markers"

echo "→ POST ${API_URL}/auth/login (viewer) + create (expect 403)"
viewer_login="$(curl -fsS -X POST "${API_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${VIEWER_EMAIL}\",\"password\":\"${VIEWER_PASSWORD}\"}")"
viewer_token="$(json_get "${viewer_login}" "data['accessToken']")"
viewer_code="$(curl -sS -o /tmp/slotcraft-smoke-viewer.json -w '%{http_code}' \
  -X POST "${API_URL}/bookings" \
  -H "Authorization: Bearer ${viewer_token}" \
  -H 'Content-Type: application/json' \
  -d "${create_body}")"
[[ "${viewer_code}" == "403" ]] || fail "expected viewer HTTP 403, got ${viewer_code}"

echo "→ DELETE ${API_URL}/bookings/${booking_id}"
curl -fsS -X DELETE "${API_URL}/bookings/${booking_id}" \
  -H "Authorization: Bearer ${admin_token}" >/dev/null

echo "→ GET ${WEB_URL}/ (login page)"
web_code="$(curl -sS -o /tmp/slotcraft-smoke-web.html -w '%{http_code}' "${WEB_URL}/")"
[[ "${web_code}" == "200" ]] || fail "web login page returned HTTP ${web_code}"
grep -q 'Slotcraft' /tmp/slotcraft-smoke-web.html || fail "web page missing Slotcraft brand"
grep -qi 'email\|password\|Continue\|Signing' /tmp/slotcraft-smoke-web.html \
  || fail "web page missing login form markers"

echo "smoke OK (test 3)"
