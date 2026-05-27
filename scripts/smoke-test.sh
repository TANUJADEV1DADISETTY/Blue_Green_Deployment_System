#!/bin/bash
set -e

BASE_URL=$1

if [ -z "$BASE_URL" ]; then
  echo "Usage: $0 <base_url>"
  exit 1
fi

echo "Running smoke tests against $BASE_URL..."

# 1. Create a user
echo "Creating user..."
RESPONSE=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/users" -H "Content-Type: application/json" -d '{"username": "smoke_user", "email": "smoke@example.com"}')
HTTP_CODE=${RESPONSE: -3}
BODY=${RESPONSE:0:${#RESPONSE}-3}

if [ "$HTTP_CODE" -ne 201 ]; then
  echo "Failed to create user. HTTP Code: $HTTP_CODE, Body: $BODY"
  exit 1
fi

USER_ID=$(echo "$BODY" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
echo "Created user with ID: $USER_ID"

# 2. Get the user
echo "Getting user $USER_ID..."
RESPONSE=$(curl -s -w "%{http_code}" "$BASE_URL/api/users/$USER_ID")
HTTP_CODE=${RESPONSE: -3}

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "Failed to get user. HTTP Code: $HTTP_CODE"
  exit 1
fi
echo "Successfully got user."

# 3. Update the user
echo "Updating user $USER_ID..."
RESPONSE=$(curl -s -w "%{http_code}" -X PUT "$BASE_URL/api/users/$USER_ID" -H "Content-Type: application/json" -d '{"username": "smoke_user_updated"}')
HTTP_CODE=${RESPONSE: -3}

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "Failed to update user. HTTP Code: $HTTP_CODE"
  exit 1
fi
echo "Successfully updated user."

# 4. Delete the user
echo "Deleting user $USER_ID..."
RESPONSE=$(curl -s -w "%{http_code}" -X DELETE "$BASE_URL/api/users/$USER_ID")
HTTP_CODE=${RESPONSE: -3}

if [ "$HTTP_CODE" -ne 204 ]; then
  echo "Failed to delete user. HTTP Code: $HTTP_CODE"
  exit 1
fi
echo "Successfully deleted user."

echo "Smoke tests passed!"
exit 0
