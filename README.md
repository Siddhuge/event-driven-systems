# Event Driven Azure

Containerized event-driven Node.js services using Kafka, RabbitMQ, and Redis.

## Run Locally With Docker

From the repo root:

```bash
docker compose -f docker/docker-compose.yml up --build
```

This starts:

- `order-service` on `http://localhost:3000`
- `inventory-service` Kafka consumer
- `retry-worker` RabbitMQ retry processor
- Kafka and Zookeeper
- RabbitMQ management UI on `http://localhost:15672` with `guest` / `guest`
- Redis on `localhost:6379`

Kafka topics are created automatically by the `kafka-init` container:

- `orders`
- `orders_retry`
- `orders_dlq`

## Send A Test Order

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"items":["item1","item2"]}'
```

Watch service logs:

```bash
docker compose -f docker/docker-compose.yml logs -f order-service inventory-service retry-worker
```

## Stop The Stack

```bash
docker compose -f docker/docker-compose.yml down
```

Remove persisted Kafka, RabbitMQ, Zookeeper, and Redis data:

```bash
docker compose -f docker/docker-compose.yml down -v
```

## Build Individual Images

```bash
docker build -t order-service:local services/order-service
docker build -t inventory-service:local services/inventory-service
```

## Deploy To AKS

The Helm chart is in `helm/order-service` and deploys:

- `order-service` API deployment and ClusterIP service
- `inventory-service` Kafka consumer deployment
- `retry-worker` RabbitMQ retry deployment
- HPAs, PodDisruptionBudgets, security contexts, health probes, and a NetworkPolicy

The pipeline expects an Azure DevOps variable group named `event-driven-azure-dev`. Keep environment-specific values there instead of hardcoding them in `azure-pipelines-app.yml`.

| Variable | Example | Notes |
| --- | --- | --- |
| `acrName` | `mycompanyacr` | ACR name only, without `.azurecr.io`. |
| `azureResourceGroup` | `rg-aks-dev` | Resource group containing the AKS cluster. |
| `aksClusterName` | `aks-event-driven-dev` | AKS cluster name. |
| `kafkaBroker` | `kafka.event-driven.svc.cluster.local:29092` | Kubernetes DNS name and port reachable from pods. |
| `approvalNotifyUsers` | `platform-team@example.com` | Users or groups notified for manual approval. |

If Kafka is deployed in the same namespace as the app, `kafka:29092` is enough. If it is in another namespace, use `<service>.<namespace>.svc.cluster.local:<port>`.

The pipeline enforces these release gates before deployment:

- Pre-build Trivy config scan for Dockerfiles and Helm/Kubernetes manifests
- Pre-build Trivy source scan for dependency vulnerabilities and secrets
- NPM dependency audit for services with lockfiles
- Post-build Trivy image scan against the images pushed to ACR
- Manual approval before the Helm deployment stage

Create the runtime secret in the target namespace before deploying. In production, source these values from Azure Key Vault or your secret-management workflow.

```bash
kubectl create namespace event-driven

kubectl create secret generic event-driven-azure-runtime \
  --namespace event-driven \
  --from-literal=RABBITMQ_URL='amqp://<rabbitmq-host>:5672' \
  --from-literal=REDIS_URL='redis://<redis-host>:6379'
```

Deploy with Helm:

```bash
helm upgrade --install event-driven-azure helm/order-service \
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

The Azure pipeline builds and pushes both service images, lints the chart, then deploys the chart to AKS with an atomic Helm upgrade.
