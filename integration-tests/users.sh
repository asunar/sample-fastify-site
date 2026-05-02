# Integration Tests — POST /users
# Run the server first: npm start

echo "=== Valid: email + dob ==="
PAYLOAD='{"email": "alice@example.com", "dob": "1990-01-15"}'
echo "Payload: $PAYLOAD"
echo "Response:"
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "=== Valid: email only (dob is optional) ==="
PAYLOAD='{"email": "bob@example.com"}'
echo "Payload: $PAYLOAD"
echo "Response:"

curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "=== Invalid: missing email ==="
curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"dob": "1990-01-15"}'

echo ""
echo "=== Invalid: malformed email ==="
PAYLOAD='{"email": "not-an-email"}'
echo "Payload: $PAYLOAD"
echo "Response:"

curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "=== Invalid: empty body ==="
PAYLOAD='{}'
echo "Payload: $PAYLOAD"
echo "Response:"

curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "=== Invalid: dob is not a date ==="
PAYLOAD='{"email": "carol@example.com", "dob": "not-a-date"}'
echo "Payload: $PAYLOAD"
echo "Response:"

curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "=== Invalid: dob is a datetime instead of a date ==="
PAYLOAD='{"email": "carol@example.com", "dob": "1990-01-15T00:00:00Z"}'
echo "Payload: $PAYLOAD"
echo "Response:"

curl -s -w "\nHTTP %{http_code}\n" -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "=== PATCH: update email ==="

PAYLOAD='{"email": "alice-updated@example.com"}'
echo "Payload: $PAYLOAD"
echo "Response:"


curl -s -w "\nHTTP %{http_code}\n" -X PATCH http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "=== PATCH: update dob ==="
PAYLOAD='{"dob": "1990-02-20"}'
echo "Payload: $PAYLOAD"
echo "Response:"

curl -s -w "\nHTTP %{http_code}\n" -X PATCH http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "=== PATCH: invalid email ==="
PAYLOAD='{"email": "not-an-email"}'
echo "Payload: $PAYLOAD"
echo "Response:"

curl -s -w "\nHTTP %{http_code}\n" -X PATCH http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "=== PATCH: invalid dob ==="
PAYLOAD='{"dob": "not-a-date"}'
echo "Payload: $PAYLOAD"
echo "Response:"
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
