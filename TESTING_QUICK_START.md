# 🧪 How to Test the App Locally - Quick Start

## 60-Second Setup

```bash
# 1. Navigate to app directory
cd app

# 2. Start all services (Kafka, RabbitMQ, Redis, services)
docker compose -f docker/docker-compose.yml up --build

# Wait 30-60 seconds for services to start...
# ✅ You'll see: Order Service started on port 3000
```

**That's it!** Your app is now running locally.

---

## Testing the API (In Another Terminal)

### 1. Check Health Status
```bash
curl http://localhost:3000/healthz
# Response: {"status":"alive"}
```

### 2. Check Readiness
```bash
curl http://localhost:3000/readyz
# Response: {"status":"ready","kafka":true}
```

### 3. Create an Order
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"items":["apple","banana"]}'

# Response: 
# {
#   "orderId": "550e8400-e29b-41d4-a716-446655440000",
#   "status": "pending",
#   "items": ["apple","banana"],
#   "createdAt": "2026-05-04T10:30:00.000Z"
# }
```

### 4. Get All Orders
```bash
curl http://localhost:3000/orders
# Response: [order1, order2, ...]
```

### 5. View API Documentation
Open in browser:
```
http://localhost:3000/api-docs
```

### 6. View Metrics
```bash
curl http://localhost:3000/metrics | head -20
# Prometheus format metrics
```

### 7. Check RabbitMQ UI
Open in browser:
```
http://localhost:15672

Username: guest
Password: guest
```

---

## Running Unit Tests

### Option A: In Docker (Recommended)
```bash
# Test Order Service
docker compose -f app/docker/docker-compose.yml run --rm order-service npm run test:ci

# Test Inventory Service
docker compose -f app/docker/docker-compose.yml run --rm inventory-service npm run test:ci
```

### Option B: Locally
```bash
cd app/services/order-service
npm install
npm test

cd ../inventory-service
npm install
npm test
```

---

## Monitoring Services

### View All Service Logs
```bash
docker compose -f app/docker/docker-compose.yml logs -f

# Or specific service:
docker compose -f app/docker/docker-compose.yml logs -f order-service
```

### Check Service Health
```bash
docker compose -f app/docker/docker-compose.yml ps

# All should show "healthy" or "running"
```

### Check Kafka Topics
```bash
docker compose -f app/docker/docker-compose.yml exec kafka \
  kafka-topics --bootstrap-server kafka:29092 --list

# Expected: orders, orders_retry, orders_dlq
```

---

## Stop Services

```bash
# Stop but keep data
docker compose -f app/docker/docker-compose.yml stop

# Stop and remove everything
docker compose -f app/docker/docker-compose.yml down

# Stop and delete ALL data (fresh start next time)
docker compose -f app/docker/docker-compose.yml down -v
```

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Port 3000 already in use | `lsof -i :3000` then `kill -9 <PID>` |
| Services won't start | `docker compose down -v` then `up --build` again |
| Out of memory | Reduce Docker memory limit or close other apps |
| Kafka topics not created | Wait 60 seconds for kafka-init container to complete |
| Tests fail | Ensure services are healthy with `docker compose ps` |
| Connection refused | Services might still be starting - wait 30 seconds |

---

## Architecture (What You Get)

```
┌─────────────────────────────────────────────────┐
│         Order Service (Port 3000)               │
│  - REST API (/orders POST, GET)                 │
│  - Rate limiting (Redis-backed)                 │
│  - OpenTelemetry tracing                        │
│  - Prometheus metrics (/metrics)                │
│  - Swagger docs (/api-docs)                     │
└──────────────┬──────────────────────────────────┘
               │ Kafka (orders topic)
┌──────────────┴──────────────────────────────────┐
│      Inventory Service (Kafka Consumer)         │
│  - Listens to orders topic                      │
│  - Processes inventory updates                  │
├──────────────────────────────────────────────────┤
│  RabbitMQ (Port 15672)                          │
│  - DLQ for failed messages                      │
│  - Retry processing                             │
├──────────────────────────────────────────────────┤
│  Redis (Port 6379)                              │
│  - Distributed rate limiting cache              │
├──────────────────────────────────────────────────┤
│  Kafka (Port 9092)                              │
│  - Event streaming platform                     │
└──────────────────────────────────────────────────┘
```

---

## What to Test

### ✅ Basic Functionality
- [ ] Create order via POST /orders
- [ ] Retrieve orders via GET /orders
- [ ] Health checks respond
- [ ] API docs load in browser
- [ ] Rate limiting works (101st request fails)
- [ ] Metrics endpoint returns data

### ✅ Integration
- [ ] Kafka topics created
- [ ] Messages appear in Kafka (use kafka-console-consumer)
- [ ] RabbitMQ queues operational
- [ ] Redis cache working
- [ ] Inventory service processes messages

### ✅ Tests
- [ ] Order service tests pass (70% coverage required)
- [ ] Inventory service tests pass (65% coverage required)
- [ ] No test failures

### ✅ Performance
- [ ] Order creation < 50ms
- [ ] Health check < 5ms
- [ ] No memory leaks (watch docker stats over time)
- [ ] CPU usage idle < 5%

---

## Next Steps

### For More Details
- See [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md) for advanced testing
- See [README.md](./README.md) for architecture overview
- See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for AKS deployment
- See [RUNBOOKS.md](./RUNBOOKS.md) for operational procedures

### To Deploy to Kubernetes
1. Ensure Terraform infrastructure is deployed (`infra/envs/dev/`)
2. Configure Azure DevOps variable group `event-driven-azure-dev`
3. Push to `main` branch to trigger pipeline
4. Approve deployment in Azure Pipelines

### To Contribute
1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and test locally
3. Run tests: `npm test`
4. Commit and push: `git push origin feature/my-feature`
5. Create pull request
6. Pipeline runs automatically

---

## Environment Variables (For Local Development)

These are optional - docker-compose has defaults:

```bash
# .env file (in app/ directory, not tracked in git)
PORT=3000
CLIENT_ID=order-service
KAFKA_BROKER=kafka:29092
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://rabbitmq:5672
JWT_SECRET=your-secret-key-here
LOG_LEVEL=debug
```

---

**Happy Testing! 🎉**

For troubleshooting: Check [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md) troubleshooting section
