#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Initiating Rollback to Blue..."

# 1. Ensure Blue is running
echo "Starting Blue container (if not running)..."
docker-compose start blue

# Wait for Blue to be healthy
echo "Waiting for Blue container to be healthy..."
RETRIES=30
until [ "`docker inspect -f {{.State.Health.Status}} blue`" == "healthy" ]; do
    sleep 2;
    let RETRIES-=1
    if [ "$RETRIES" -le 0 ]; then
        echo "Blue container failed to become healthy. Aborting rollback."
        exit 1
    fi
done
echo "Blue container is healthy."

sleep 5

# 2. Modify nginx config to point back to Blue
echo "Switching traffic back to Blue..."
sed -i 's/server green:8080;/server blue:8080;/g' config/nginx.conf

# 3. Reload Nginx
docker exec nginx nginx -s reload
echo "Traffic switched back to Blue."

# Wait for connections to drain from Green
echo "Waiting for connections to drain from Green (10s)..."
sleep 10

# 4. Shut down Green
echo "Shutting down Green container..."
docker-compose stop green

echo "Rollback Complete!"
