# Zero-Downtime Blue-Green Deployment System with Database Migration

## Overview

This project demonstrates a complete production-style **Blue-Green Deployment System** with:

- Zero-downtime deployments
- Automated traffic switching
- PostgreSQL database migrations
- Expand-Contract migration strategy
- Feature flags
- Health checks
- Graceful shutdown
- Rollback support
- Docker-based infrastructure
- Nginx load balancing
- Deployment automation using shell scripts

The system simulates how modern DevOps and SRE teams deploy applications safely in production environments.

---

# Architecture

```text
                    ┌────────────────────┐
                    │      Client        │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │       Nginx        │
                    │   Load Balancer    │
                    └───────┬────────────┘
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
    ┌─────────────────┐         ┌─────────────────┐
    │   Blue App      │         │   Green App     │
    │    v1.0.0       │         │    v2.0.0       │
    └────────┬────────┘         └────────┬────────┘
             │                             │
             └──────────────┬──────────────┘
                            ▼
                  ┌──────────────────┐
                  │   PostgreSQL DB  │
                  └──────────────────┘
```

---

# Features

## Blue-Green Deployment

- Two production environments:
  - Blue (current live version)
  - Green (new version)

- Traffic switching using Nginx
- Instant rollback support
- Zero downtime during deployment

---

## Expand-Contract Database Migration Pattern

Supports safe schema changes without downtime.

### Deployment Flow

1. Expand
2. Deploy Green
3. Smoke Test
4. Switch Traffic
5. Backfill Data
6. Contract Schema

---

## Health Checks

Both applications implement:

| Endpoint        | Purpose         |
| --------------- | --------------- |
| `/health`       | General health  |
| `/health/live`  | Liveness probe  |
| `/health/ready` | Readiness probe |

---

## Graceful Shutdown

Supports:

- SIGTERM handling
- Connection draining
- Readiness failure during shutdown
- In-flight request completion

---

## Feature Flags

Green version supports:

- phoneNumber feature
- profilePicture feature

Feature flags can be enabled/disabled dynamically.

---

# Tech Stack

| Component        | Technology     |
| ---------------- | -------------- |
| Backend          | Node.js        |
| Framework        | Express.js     |
| Database         | PostgreSQL     |
| Containerization | Docker         |
| Orchestration    | Docker Compose |
| Load Balancer    | Nginx          |
| Automation       | Bash           |
| API Testing      | curl + jq      |

---

# Project Structure

```text
blue-green-deployment-system/
│
├── app/
│   ├── v1.0/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── server.js
│   │   └── ...
│   │
│   └── v2.0/
│       ├── Dockerfile
│       ├── package.json
│       ├── server.js
│       └── ...
│
├── scripts/
│   ├── deploy-green.sh
│   ├── rollback.sh
│   ├── smoke-test.sh
│   │
│   └── migrations/
│       ├── 01_expand.sql
│       ├── 02_backfill.sql
│       └── 03_contract.sql
│
├── config/
│   └── nginx.conf
│
├── docker-compose.yml
├── .env.example
├── README.md
└── .gitignore
```

---

# Application Versions

---

# Blue Environment (v1.0.0)

## Features

- Basic CRUD operations
- User schema:
  - id
  - username
  - email

## Endpoints

| Method | Endpoint         |
| ------ | ---------------- |
| POST   | `/api/users`     |
| GET    | `/api/users/:id` |
| PUT    | `/api/users/:id` |
| DELETE | `/api/users/:id` |
| GET    | `/api/version`   |

---

# Green Environment (v2.0.0)

## Additional Features

- phone_number
- profile_picture_url
- Feature flags
- Graceful shutdown improvements

## Extended User Schema

| Field               | Type   |
| ------------------- | ------ |
| id                  | number |
| username            | string |
| email               | string |
| phone_number        | string |
| profile_picture_url | string |

---

# Feature Flag APIs

| Method | Endpoint              |
| ------ | --------------------- |
| GET    | `/api/features`       |
| PUT    | `/api/features/:name` |

Example:

```json
{
  "phoneNumber": true,
  "profilePicture": false
}
```

---

# Environment Variables

Create a `.env` file from `.env.example`

---

# .env.example

```env
POSTGRES_USER=user
POSTGRES_PASSWORD=your-password
POSTGRES_DB=appdb

APP_VERSION=1.0.0
ENVIRONMENT_NAME=blue

FEATURE_PHONE_NUMBER=true
FEATURE_PROFILE_PICTURE=true
```

---

# Docker Compose Setup

The project uses Docker Compose to orchestrate:

- Blue service
- Green service
- PostgreSQL database
- Nginx load balancer

---

# Start Entire System

```bash
docker compose up -d --build
```

---

# Verify Running Containers

```bash
docker ps
```

Expected containers:

- blue
- green
- db
- nginx

---

# Verify Application

```bash
curl http://localhost:8080/api/version
```

Expected response:

```json
{
  "version": "1.0.0",
  "environment": "blue"
}
```

---

# Database Migration Strategy

This project follows the **Expand-Contract Pattern**.

---

# 1. Expand Migration

File:

```text
scripts/migrations/01_expand.sql
```

Adds new nullable columns:

- phone_number
- profile_picture_url

Safe for both Blue and Green applications.

---

# 2. Backfill Migration

File:

```text
scripts/migrations/02_backfill.sql
```

Populates existing records with default values.

---

# 3. Contract Migration

File:

```text
scripts/migrations/03_contract.sql
```

Applies breaking schema changes:

- Makes phone_number NOT NULL

Executed only after Blue is retired.

---

# Deployment Workflow

The deployment process is fully automated.

---

# Deploy Green Version

Run:

```bash
./scripts/deploy-green.sh
```

---

# Deployment Steps

The script performs:

1. Run expand migration
2. Start Green environment
3. Wait for Green readiness
4. Execute smoke tests
5. Switch Nginx traffic
6. Reload Nginx
7. Wait for connection draining
8. Stop Blue container
9. Run backfill migration

---

# Traffic Switching

Nginx initially routes traffic to:

```nginx
server blue:8080;
```

During deployment:

```nginx
server green:8080;
```

Nginx reload command:

```bash
docker exec nginx nginx -s reload
```

---

# Smoke Testing

Smoke tests validate:

- User creation
- User retrieval
- User update
- User deletion

---

# Run Smoke Test

```bash
./scripts/smoke-test.sh http://localhost:8080
```

---

# Expected Result

```text
All smoke tests passed
```

---

# Rollback Procedure

Rollback instantly redirects traffic back to Blue.

---

# Run Rollback

```bash
./scripts/rollback.sh
```

---

# Rollback Steps

1. Ensure Blue is running
2. Switch Nginx upstream to Blue
3. Reload Nginx
4. Optionally stop Green

---

# Health Checks

---

# Health Endpoint

```bash
curl http://localhost:8080/health
```

Response:

```json
{
  "status": "healthy"
}
```

---

# Liveness Probe

```bash
curl http://localhost:8080/health/live
```

Returns:

- 200 while process is alive

---

# Readiness Probe

```bash
curl http://localhost:8080/health/ready
```

Returns:

- 200 when ready
- 503 during shutdown

---

# Graceful Shutdown

Applications support graceful shutdown using SIGTERM.

---

# Shutdown Behavior

When container receives SIGTERM:

1. Readiness becomes 503
2. Liveness remains 200
3. Existing requests complete
4. New traffic blocked
5. Process exits after timeout

---

# Test Graceful Shutdown

```bash
docker stop -t 35 blue
```

Then poll:

```bash
curl http://localhost:8080/health/ready
```

Expected:

```text
503 Service Unavailable
```

---

# API Documentation

---

# Create User

```http
POST /api/users
```

Request:

```json
{
  "username": "john",
  "email": "john@example.com"
}
```

---

# Get User

```http
GET /api/users/:id
```

---

# Update User

```http
PUT /api/users/:id
```

---

# Delete User

```http
DELETE /api/users/:id
```

---

# Version Endpoint

```http
GET /api/version
```

Blue response:

```json
{
  "version": "1.0.0",
  "environment": "blue"
}
```

Green response:

```json
{
  "version": "2.0.0",
  "environment": "green",
  "features": {
    "phoneNumber": true,
    "profilePicture": true
  }
}
```

---

# Verification Checklist

## Docker

- [x] All containers start successfully
- [x] Health checks pass
- [x] Nginx serves traffic

---

## Blue Application

- [x] CRUD operations work
- [x] Health endpoints work
- [x] Version endpoint works

---

## Green Application

- [x] Extended fields supported
- [x] Feature flags work
- [x] Graceful shutdown implemented

---

## Deployment

- [x] Zero downtime deployment
- [x] Smoke tests pass
- [x] Traffic switching works

---

## Rollback

- [x] Rollback successful
- [x] Blue becomes active again

---

# Security Considerations

- Secrets stored in `.env`
- `.env` excluded using `.gitignore`
- No hardcoded credentials
- Readiness probes prevent unhealthy routing

---

# Future Improvements

Possible production enhancements:

- Kubernetes deployment
- CI/CD pipeline integration
- GitHub Actions
- Prometheus monitoring
- Grafana dashboards
- Redis caching
- SSL/TLS support
- Canary deployments
- Auto rollback
- Observability and tracing

---

# Learning Outcomes

This project demonstrates:

- DevOps engineering
- Docker orchestration
- Production deployment strategies
- Database migration management
- High availability systems
- Infrastructure automation
- Graceful shutdown handling
- Feature flag architecture

---

# Author

Developed as part of an advanced DevOps and Backend Engineering project focused on production-grade deployment systems.

---
