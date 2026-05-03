# App — Local Dev & Deployment

Containerized event-driven Node.js services using Kafka, RabbitMQ, and Redis.

## Run Locally With Docker

From the repo root:

```bash
docker compose -f app/docker/docker-compose.yml up --build
```

This starts:

- `order-service` on `http://localhost:3000`
- `inventory-service` Kafka consumer
- `retry-worker` RabbitMQ retry processor
- Kafka + Zookeeper
- RabbitMQ management UI on `http://localhost:15672` (guest / guest)
- Redis on `localhost:6379`

Kafka topics created automatically: `orders`, `orders_retry`, `orders_dlq`

## Send A Test Order

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"items":["item1","item2"]}'
```

Watch service logs:

```bash
docker compose -f app/docker/docker-compose.yml logs -f order-service inventory-service retry-worker
```

## Stop The Stack

```bash
docker compose -f app/docker/docker-compose.yml down

# Remove persisted volumes (Kafka, RabbitMQ, Zookeeper, Redis data)
docker compose -f app/docker/docker-compose.yml down -v
```

## Build Individual Images

```bash
docker build -t order-service:local     app/services/order-service
docker build -t inventory-service:local app/services/inventory-service
```

## Deploy To AKS

The Helm chart is in `app/helm/order-service` and deploys:

- `order-service` API + ClusterIP service
- `inventory-service` Kafka consumer
- `retry-worker` RabbitMQ retry processor
- HPAs, PodDisruptionBudgets, security contexts, health probes, NetworkPolicy

The pipeline expects an Azure DevOps variable group named `event-driven-azure-dev`:

| Variable | Example | Notes |
|----------|---------|-------|
| `acrName` | `eventdrivendevacr` | ACR name only — no `.azurecr.io` suffix |
| `azureResourceGroup` | `event-driven-dev-rg` | Resource group containing the AKS cluster |
| `aksClusterName` | `event-driven-dev-aks` | AKS cluster name |
| `keyVaultName` | `event-driven-dev-kv` | Key Vault used by pipeline for runtime secrets |
| `kafkaBroker` | `kafka.event-driven.svc.cluster.local:29092` | Kubernetes DNS name reachable from pods |
| `approvalNotifyUsers` | `platform-team@example.com` | Users notified for manual approval |

If Kafka is in the same namespace as the app, `kafka:29092` is enough. If it is in another namespace, use `<service>.<namespace>.svc.cluster.local:<port>`.

Store runtime secrets in Azure Key Vault:

| Key Vault secret | Kubernetes env key | Example |
|------------------|--------------------|---------|
| `rabbitmq-url` | `RABBITMQ_URL` | `amqp://rabbitmq.event-driven.svc.cluster.local:5672` |
| `redis-url` | `REDIS_URL` | `redis://redis.event-driven.svc.cluster.local:6379` |
| `jwt-secret` | `JWT_SECRET` | 32-byte random hex string |

The pipeline enforces these gates before deployment:

- Trivy config scan (Dockerfiles and Helm manifests)
- Trivy source scan (dependency vulnerabilities and secrets)
- NPM audit for services with lockfiles
- Trivy image scan against the images pushed to ACR
- Key Vault secret retrieval at deploy time
- Manual approval before the Helm deployment stage

## One-Off Local Deployment

```bash
kubectl create namespace event-driven

kubectl create secret generic event-driven-azure-runtime \
  --namespace event-driven \
  --from-literal=RABBITMQ_URL='amqp://<rabbitmq-host>:5672' \
  --from-literal=REDIS_URL='redis://<redis-host>:6379' \
  --from-literal=JWT_SECRET='<random-hex>'

helm upgrade --install event-driven-azure app/helm/order-service \
  --namespace event-driven \
  --create-namespace \
  --atomic \
  --timeout 10m \
  --set-string global.imageRegistry='<ACR_NAME>.azurecr.io' \
  --set-string global.imageTag='<IMAGE_TAG>' \
  --set-string config.kafkaBroker='<KAFKA_BOOTSTRAP_SERVER>' \
  --set secrets.create=false \
  --set-string secrets.existingSecret='event-driven-azure-runtime'
```
