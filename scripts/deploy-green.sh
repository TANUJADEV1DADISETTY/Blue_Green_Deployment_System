#!/bin/bash
set -e

# Change to the project root
cd "$(dirname "$0")/.."

echo "Starting Green Deployment..."

# 1. Run expand migration
echo "Running Expand Migration (01_expand.sql)..."
docker exec -i db psql -U user -d appdb < scripts/migrations/01_expand.sql

# 2. Start Green
echo "Starting Green container..."
docker-compose up -d --build green

# 3. Wait for Green to be healthy/ready
echo "Waiting for Green container to be healthy..."
RETRIES=30
until [ "`docker inspect -f {{.State.Health.Status}} green`" == "healthy" ]; do
    sleep 2;
    let RETRIES-=1
    if [ "$RETRIES" -le 0 ]; then
        echo "Green container failed to become healthy. Aborting deployment."
        docker-compose stop green
        exit 1
    fi
done
echo "Green container is healthy."

# Wait a bit more for the app to be fully ready to accept traffic
sleep 5

# 4. Run smoke tests on Green
echo "Running smoke tests on Green environment..."
# Assuming green is exposed on 8082 for direct testing
if ! ./scripts/smoke-test.sh http://localhost:8082; then
    echo "Smoke tests failed on Green. Aborting deployment."
    docker-compose stop green
    exit 1
fi

# 5. Switch traffic
echo "Switching traffic to Green..."
# Modify nginx config
sed -i 's/server blue:8080;/server green:8080;/g' config/nginx.conf
# Reload nginx
docker exec nginx nginx -s reload
echo "Traffic switched to Green."

# Wait for connections to drain from Blue
echo "Waiting for connections to drain from Blue (30s)..."
sleep 30

# 6. Shut down Blue
echo "Shutting down Blue container..."
docker-compose stop blue

# 7. Run backfill migration
echo "Running Backfill Migration (02_backfill.sql)..."
docker exec -i db psql -U user -d appdb < scripts/migrations/02_backfill.sql

echo "Green Deployment Complete!"
