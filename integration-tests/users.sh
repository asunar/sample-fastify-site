#!/bin/sh
# Integration Tests — /users and /health
# Run the server first: npm start
#
# Every run uses a fresh set of email addresses. The unique constraint added in
# migration 3 means reusing fixed addresses would make the second run of this
# script fail with 409s that look like regressions.

BASE_URL="${BASE_URL:-http://localhost:3000}"
RUN_ID="$(date +%s)-$$"

PASS=0
FAIL=0

# check <expected-status> <description> <curl args...>
check() {
  expected="$1"
  description="$2"
  shift 2

  body_file=$(mktemp)
  actual=$(curl -s -o "$body_file" -w "%{http_code}" "$@")
  body=$(cat "$body_file")
  rm -f "$body_file"

  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1))
    printf '  ok   %s (HTTP %s)\n' "$description" "$actual"
  else
    FAIL=$((FAIL + 1))
    printf '  FAIL %s — expected HTTP %s, got %s\n' "$description" "$expected" "$actual"
    printf '       body: %s\n' "$body"
  fi
}

post_user() {
  curl -s -X POST "$BASE_URL/users" \
    -H "Content-Type: application/json" \
    -d "$1"
}

echo "=== Health ==="
check 200 "GET /health" "$BASE_URL/health"
check 200 "GET /health/ready" "$BASE_URL/health/ready"

echo "=== POST /users — valid ==="
ALICE="alice-$RUN_ID@example.com"
BOB="bob-$RUN_ID@example.com"

check 201 "email + dob" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ALICE\", \"dob\": \"1990-01-15\"}"

check 201 "email only (dob is optional)" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$BOB\"}"

echo "=== POST /users — conflict ==="
check 409 "duplicate email" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ALICE\"}"

echo "=== POST /users — invalid ==="
check 400 "missing email" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" -d '{"dob": "1990-01-15"}'

check 400 "malformed email" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" -d '{"email": "not-an-email"}'

check 400 "empty body" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" -d '{}'

check 400 "dob is not a date" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"carol-$RUN_ID@example.com\", \"dob\": \"not-a-date\"}"

check 400 "dob is a datetime instead of a date" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"carol-$RUN_ID@example.com\", \"dob\": \"1990-01-15T00:00:00Z\"}"

echo "=== PATCH /users/:id ==="
# Create a user to update, capturing the id the server assigned rather than
# assuming id 1 exists.
DAVE="dave-$RUN_ID@example.com"
USER_ID=$(post_user "{\"email\": \"$DAVE\"}" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -z "$USER_ID" ]; then
  echo "  FAIL could not create a user to PATCH — aborting"
  exit 1
fi
echo "  (created user id $USER_ID)"

check 204 "update email" -X PATCH "$BASE_URL/users/$USER_ID" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"dave-updated-$RUN_ID@example.com\"}"

check 204 "update dob" -X PATCH "$BASE_URL/users/$USER_ID" \
  -H "Content-Type: application/json" -d '{"dob": "1990-02-20"}'

check 204 "empty body on an existing user" -X PATCH "$BASE_URL/users/$USER_ID" \
  -H "Content-Type: application/json" -d '{}'

check 409 "rename to an address already taken" -X PATCH "$BASE_URL/users/$USER_ID" \
  -H "Content-Type: application/json" -d "{\"email\": \"$ALICE\"}"

check 404 "user does not exist" -X PATCH "$BASE_URL/users/99999999" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"ghost-$RUN_ID@example.com\"}"

check 400 "invalid email" -X PATCH "$BASE_URL/users/$USER_ID" \
  -H "Content-Type: application/json" -d '{"email": "not-an-email"}'

check 400 "invalid dob" -X PATCH "$BASE_URL/users/$USER_ID" \
  -H "Content-Type: application/json" -d '{"dob": "not-a-date"}'

echo ""
echo "=== $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
