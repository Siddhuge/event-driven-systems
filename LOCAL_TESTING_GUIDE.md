# Local Testing Guide

Complete guide to test the event-driven Azure application locally with Docker Compose and unit tests.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start - Docker Compose](#quick-start---docker-compose)
3. [Testing API Endpoints](#testing-api-endpoints)
4. [Unit Tests](#unit-tests)
5. [Advanced Testing](#advanced-testing)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required
- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Node.js** >= 20 (for running tests locally without Docker)
- **curl** or **Postman** (for API testing)
- **Git** (to clone the repository)

### Optional
- **jq** (for JSON parsing in CLI)
- **Apache Bench** (for load testing)
- **k6** (for advanced load testing)

### Install Dependencies (macOS)
```bash
brew install docker docker-compose node curl jq
```

### Install Dependencies (Linux/Ubuntu)
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose nodejs npm curl jq
sudo usermod -aG docker $USER  # Add user to docker group
```

## Quick Start - Docker Compose

### Step 1: Start All Services

From the repository root:

```bash
cd app
docker compose -f docker/docker-compose.yml up --build
```

**What gets started:**
- ✅ Zookeeper (coordination)
- ✅ Kafka (event streaming)
- ✅ RabbitMQ (retry/DLQ processing)
- ✅ Redis (distributed rate limiting)
- ✅ Order Service (REST API on port 3000)
- ✅ Inventory Service (Kafka consumer)
- ✅ Retry Worker (RabbitMQ processor)

**Expected output:**
```
✓ zookeeper
✓ kafka
✓ kafka-init
✓ rabbitmq
✓ redis
✓ order-service      | Order Service started on port 3000
✓ inventory-service  | Consumer started
✓ retry-worker       | Retry worker started
```

### Step 2: Verify Services are Healthy

```bash
# Check all container status
docker compose -f app/docker/docker-compose.yml ps

# Should show all containers with "healthy" or "running" status
```

### Step 3: Stop Services (When Done)

```bash
# Stop without removing volumes (keeps data)
docker compose -f app/docker/docker-compose.yml stop

# Stop and remove everything
docker compose -f app/docker/docker-compose.yml down

# Stop and remove everything INCLUDING persistent data
docker compose -f app/docker/docker-compose.yml down -v
```

## Testing API Endpoints

### Test 1: Health Check

```bash
curl http://localhost:3000/healthz
# Expected: {"status":"alive"}
```

### Test 2: Readiness Check

```bash
curl http://localhost:3000/readyz
# Expected: {"status":"ready","kafka":true}
```

### Test 3: Metrics Endpoint

```bash
curl http://localhost:3000/metrics
# Expected: Prometheus format metrics
# Look for: orders_total, http_requests_duration_ms, etc.
```

### Test 4: Create an Order (POST)

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"items":["apple","banana","orange"]}'

# Expected response:
# {
#   "orderId": "550e8400-e29b-41d4-a716-446655440000",
#   "status": "pending",
#   "items": ["apple","banana","orange"],
#   "createdAt": "2026-05-04T10:30:00.000Z"
# }
```

### Test 5: Retrieve Orders (GET)

```bash
curl http://localhost:3000/orders
# Expected: List of all orders created
```

### Test 6: API Documentation

Open in browser:
```
http://localhost:3000/api-docs
```

This opens Swagger UI showing all API endpoints and schemas.

### Test 7: Rate Limiting

```bash
# Send 101 requests quickly (limit is 100/min)
for i in {1..101}; do
  curl -X POST http://localhost:3000/orders \
    -H "Content-Type: application/json" \
    -d '{"items":["item"]}' 2>/dev/null
  echo "Request $i"
done

# Request 101 should get: {"error":"Too many requests, please try again later"}
```

### Test 8: Check RabbitMQ Management UI

Open in browser:
```
http://localhost:15672

Username: guest
Password: guest
```

Features:
- View message queues
- Check message throughput
- Monitor connections
- View exchange bindings

### Test 9: Check Kafka Topics

```bash
# List all topics
docker compose -f app/docker/docker-compose.yml exec kafka \
  kafka-topics --bootstrap-server kafka:29092 --list

# Expected topics:
# - orders
# - orders_retry
# - orders_dlq

# View messages in a topic
docker compose -f app/docker/docker-compose.yml exec kafka \
  kafka-console-consumer --bootstrap-server kafka:29092 \
  --topic orders --from-beginning --max-messages 10
```

### Test 10: Check Redis Cache

```bash
# Connect to Redis
docker compose -f app/docker/docker-compose.yml exec redis \
  redis-cli

# Inside redis-cli:
> PING           # Should respond: PONG
> KEYS *         # Show all cache keys
> GET <key>      # Get specific key value
> INFO           # Show server info
```

## Unit Tests

### Run Tests in Docker (Recommended)

**Order Service Tests:**
```bash
docker compose -f app/docker/docker-compose.yml run \
  --rm order-service npm run test:ci
```

**Inventory Service Tests:**
```bash
docker compose -f app/docker/docker-compose.yml run \
  --rm inventory-service npm run test:ci
```

### Run Tests Locally (Without Docker)

**Setup:**
```bash
# Install dependencies
cd app/services/order-service
npm install

cd ../inventory-service
npm install
```

**Run tests:**
```bash
# Order Service
cd app/services/order-service
npm test

# Inventory Service
cd app/services/inventory-service
npm test

# With coverage report
npm run test:ci
```

**Coverage Thresholds:**
- Order Service: 70% (branches, functions, lines, statements)
- Inventory Service: 65%

**View Coverage:**
```bash
# After running tests
open coverage/lcov-report/index.html  # macOS
xdg-open coverage/lcov-report/index.html  # Linux
start coverage\lcov-report\index.html  # Windows
```

## Advanced Testing

### Load Testing with Apache Bench

```bash
# Install (macOS)
brew install httpd

# Simple load test: 1000 requests, 10 concurrent
ab -n 1000 -c 10 http://localhost:3000/healthz

# POST request load test
ab -n 100 -c 5 -p order.json -T application/json http://localhost:3000/orders
```

### Load Testing with k6

**Install k6:**
```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Or Docker
docker run -i grafana/k6 run - < load-test.js
```

**Run load tests from repo:**
```bash
cd app/load-tests

# Smoke test (quick validation)
npm run smoke

# Full load test (sustained load)
npm run load

# Stress test (increase load until failure)
npm run stress
```

### Integration Testing

**Test complete order flow:**

```bash
#!/bin/bash

echo "1️⃣ Creating order..."
ORDER_RESPONSE=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"items":["widget","gadget"]}')

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.orderId')
echo "Order ID: $ORDER_ID"

echo "2️⃣ Checking metrics..."
curl -s http://localhost:3000/metrics | grep orders_total

echo "3️⃣ Verifying readiness..."
curl -s http://localhost:3000/readyz | jq .

echo "4️⃣ Checking Kafka topic..."
docker compose -f docker/docker-compose.yml exec kafka \
  kafka-console-consumer --bootstrap-server kafka:29092 \
  --topic orders --max-messages 1 --from-beginning

echo "✅ Integration test complete"
```

### Testing with Postman

**Import Postman Collection:**

1. Open Postman
2. Click **Import**
3. Choose **Link** and paste:
   ```
   [Create a postman_collection.json in your repo]
   ```
4. Click **Import**

**Or create requests manually:**

| Method | URL | Body | Expected |
|--------|-----|------|----------|
| GET | `http://localhost:3000/healthz` | - | 200 {status: alive} |
| GET | `http://localhost:3000/readyz` | - | 200 {status: ready} |
| POST | `http://localhost:3000/orders` | `{"items":["x"]}` | 201 with orderId |
| GET | `http://localhost:3000/orders` | - | 200 [orders] |
| GET | `http://localhost:3000/metrics` | - | 200 prometheus format |
| GET | `http://localhost:3000/api-docs` | - | 200 Swagger UI |

## Troubleshooting

### Issue: "Port 3000 already in use"
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in docker-compose.yml:
# ports:
#   - "3001:3000"  # Use 3001 instead
```

### Issue: "Cannot connect to Docker daemon"
```bash
# Start Docker daemon
sudo systemctl start docker  # Linux

# Or on macOS, open Docker Desktop application
# Ensure Docker is running: docker ps
```

### Issue: "Database connection refused"
```bash
# Check if Kafka/Redis/RabbitMQ are healthy
docker compose -f app/docker/docker-compose.yml ps

# If not healthy, restart
docker compose -f app/docker/docker-compose.yml down -v
docker compose -f app/docker/docker-compose.yml up --build
```

### Issue: "Running out of disk space"
```bash
# Clean up Docker
docker system prune -a --volumes

# Remove specific containers/volumes
docker compose -f app/docker/docker-compose.yml down -v
```

### Issue: "Kafka topics not created"
```bash
# Manually create topics
docker compose -f app/docker/docker-compose.yml exec kafka \
  kafka-topics --bootstrap-server kafka:29092 \
  --create --topic orders --partitions 3 --replication-factor 1
```

### Issue: "Tests failing"

**Check logs:**
```bash
# Order service logs
docker compose -f app/docker/docker-compose.yml logs order-service

# All service logs
docker compose -f app/docker/docker-compose.yml logs

# Follow logs in real-time
docker compose -f app/docker/docker-compose.yml logs -f
```

**Common test issues:**
1. **Timeout**: Services not healthy yet - wait 30-60 seconds
2. **Connection refused**: Port already in use
3. **Out of memory**: Reduce concurrent connections
4. **Rate limit failures**: Run fewer parallel requests

### Issue: "Need to debug a specific service"

```bash
# Interactive shell in order-service
docker compose -f app/docker/docker-compose.yml exec order-service /bin/sh

# Check environment variables
env

# Install debugging tools
apk add --no-cache curl jq vim

# Check logs directly
tail -f /var/log/app.log
```

## Test Checklist

Before deploying to production:

- [ ] All services start without errors
- [ ] Health checks pass (`/healthz`, `/readyz`)
- [ ] Can create an order via POST endpoint
- [ ] Can retrieve orders via GET endpoint
- [ ] Metrics endpoint returns data
- [ ] Rate limiting works (101st request fails)
- [ ] All unit tests pass with required coverage
- [ ] Kafka topics created and receiving messages
- [ ] RabbitMQ queues working for retries
- [ ] Redis cache responding to requests
- [ ] API documentation loads in browser
- [ ] Load test shows acceptable performance
- [ ] No unhandled promise rejections in logs
- [ ] No memory leaks under load
- [ ] All expected containers are healthy

## Performance Benchmarks

**Expected local performance** (on moderate hardware):

| Metric | Expected |
|--------|----------|
| Order creation latency | < 50ms |
| Health check response | < 5ms |
| Metrics endpoint response | < 100ms |
| Kafka message latency | < 100ms |
| Cache hit rate | > 95% |
| Error rate | 0% |
| Memory per container | < 300MB |
| CPU usage (idle) | < 5% |

## Quick Aliases for Local Testing

Add to `.bashrc` or `.zshrc`:

```bash
# Docker compose shortcuts
alias dc='docker compose -f app/docker/docker-compose.yml'
alias dcup='dc up --build'
alias dcdown='dc down'
alias dclog='dc logs -f'

# Testing shortcuts
alias dctest='dc run --rm order-service npm run test:ci'
alias dcinvtest='dc run --rm inventory-service npm run test:ci'

# API shortcuts
alias healthz='curl http://localhost:3000/healthz'
alias readyz='curl http://localhost:3000/readyz'
alias metrics='curl http://localhost:3000/metrics | grep -E "^(# HELP|# TYPE|[a-z])" | head -20'

# Order creation
order() {
  curl -X POST http://localhost:3000/orders \
    -H "Content-Type: application/json" \
    -d "{\"items\":$(echo \"$@\" | jq -R 'split(" ")')}"
}
```

**Usage:**
```bash
dcup              # Start all services
healthz           # Check health
order apple banana  # Create order with items
dctest            # Run tests
dcdown            # Stop everything
```

---

**Last Updated**: May 4, 2026  
**Document**: LOCAL_TESTING_GUIDE.md
