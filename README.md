# Event-Driven Azure — Microservices on AKS

Event-driven microservices platform on Azure Kubernetes Service. Orders flow through Kafka to an inventory service; failed messages retry via RabbitMQ DLQ. Rate limiting uses Redis.

## Architecture

```
Ingress (HTTPS / TLS)
        │
        ▼
Order Service  ──Kafka──►  Inventory Service
 (HPA 3-10)                  (HPA 2-8)
        │                        │
        │                   RabbitMQ DLQ
        │                        │
        └────────────────►  Retry Worker
                                 │
                             Redis (rate-limit cache)
```

**Observability**: Prometheus metrics · OpenTelemetry traces · Pino structured logs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20.11-alpine |
| Messaging | Kafka · RabbitMQ |
| Cache | Redis |
| Container orchestration | AKS (Kubernetes 1.34) |
| Container registry | Azure Container Registry |
| Secrets | Azure Key Vault + CSI driver |
| Identity | Workload Identity (OIDC) |
| IaC | Terraform 1.5+ |
| CI/CD | Azure Pipelines |
| Packaging | Helm 3.12+ |

## Repository Layout

```
event-driven-azure/
├── app/
│   ├── services/
│   │   ├── order-service/        # Express REST API, Kafka producer
│   │   └── inventory-service/    # Kafka consumer + RabbitMQ retry worker
│   ├── helm/order-service/       # Helm chart (values, templates)
│   ├── docker/docker-compose.yml # Full local stack
│   └── load-tests/               # k6 smoke / load / stress scripts
├── infra/
│   ├── modules/                  # Terraform modules (aks, acr, keyvault, network, jumpbox)
│   ├── envs/
│   │   ├── dev/                  # Dev tfvars + backend
│   │   └── prod/                 # Prod tfvars + backend
│   ├── azure-pipelines.yml       # Infra CI/CD (plan → approve → apply)
│   └── KEYVAULT_INTEGRATION.md   # First-boot secrets mechanism
├── app/azure-pipelines-app.yml   # App CI/CD (test → scan → build → approve → deploy)
└── RUNBOOKS.md                   # Day-2 operations & incident response
```

## Documentation

| Document | Purpose |
|----------|---------|
| [RUNBOOKS.md](./RUNBOOKS.md) | Operations, scaling, incident response |
| [SECURITY_OPERATIONS.md](./SECURITY_OPERATIONS.md) | Secrets, RBAC, Workload Identity, vulnerability management |
| [infra/KEYVAULT_INTEGRATION.md](./infra/KEYVAULT_INTEGRATION.md) | Key Vault + pipeline first-boot mechanism |
| [app/README.md](./app/README.md) | Local development with Docker Compose |

---

## Quick Start

### Prerequisites

```bash
az --version        # 2.50+
terraform -version  # 1.5+
helm version        # 3.12+
kubectl version     # 1.28+
```

### 1. Deploy Infrastructure

```bash
cd infra/envs/dev
terraform init -upgrade
terraform plan -out=tfplan
terraform apply tfplan
terraform output -json
```

### 2. Configure kubectl

```bash
az aks get-credentials \
  --resource-group "event-driven-dev-rg" \
  --name "event-driven-dev-aks" \
  --overwrite-existing

kubectl cluster-info
kubectl get nodes
```

### 3. Populate Key Vault Secrets

```bash
KV=$(terraform -chdir=infra/envs/dev output -raw key_vault_uri | awk -F/ '{print $3}' | cut -d. -f1)

az keyvault secret set --vault-name "$KV" --name "rabbitmq-url" \
  --value "amqp://rabbitmq.event-driven.svc.cluster.local:5672"
az keyvault secret set --vault-name "$KV" --name "redis-url" \
  --value "redis://redis.event-driven.svc.cluster.local:6379"
az keyvault secret set --vault-name "$KV" --name "jwt-secret" \
  --value "$(openssl rand -hex 32)"
```

### 4. Azure DevOps Setup (one-time)

**Service connections** (Project Settings → Service Connections):
- `IAC-Conn` — Azure Resource Manager, federated credential (OIDC)
- `ACR-Connection` — Docker Registry → Azure Container Registry

**Variable group** named `event-driven-azure-dev`:

| Variable | Example value |
|----------|--------------|
| `acrName` | `eventdrivendevacr` |
| `azureResourceGroup` | `event-driven-dev-rg` |
| `aksClusterName` | `event-driven-dev-aks` |
| `keyVaultName` | `event-driven-dev-kv` |
| `kafkaBroker` | `kafka.event-driven.svc.cluster.local:29092` |
| `approvalNotifyUsers` | `your-email@company.com` |

**Environments** (Pipelines → Environments): create `dev` and `prod`; add approval checks to `prod`.

**Register pipelines**:
- Infra pipeline → `infra/azure-pipelines.yml`
- App pipeline → `app/azure-pipelines-app.yml`

### 5. Deploy Application

```bash
git push origin main   # triggers app pipeline automatically
```

Or manually with Helm:

```bash
helm upgrade --install event-driven-azure ./app/helm/order-service \
  --namespace event-driven --create-namespace \
  --values app/helm/order-service/values-dev.yaml \
  --set-string global.imageRegistry=<ACR>.azurecr.io \
  --set-string global.imageTag=latest \
  --set-string config.kafkaBroker=kafka:29092 \
  --set secrets.create=false \
  --set-string secrets.existingSecret=event-driven-azure-runtime \
  --atomic --timeout 10m
```

### 6. Verify

```bash
kubectl get pods -n event-driven
kubectl get hpa  -n event-driven

# Port-forward and smoke test
kubectl port-forward svc/event-driven-azure-order 3000:3000 -n event-driven &
curl -s http://localhost:3000/healthz
curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"items":["item1"]}'
```

---

## CI/CD Pipeline Summary

### App pipeline (`app/azure-pipelines-app.yml`)

```
Test (Jest + coverage)
  → Pre-build scan (Trivy config/secrets + npm audit)
    → Build & push images (semantic tag: <sha>-<build>)
      → Image scan (Trivy SARIF)
        → Manual approval (24h window)
          → Deploy (Helm atomic upgrade, auto-rollback on failure)
            → Rollout verification
```

### Infra pipeline (`infra/azure-pipelines.yml`)

```
Checkov IaC scan
  → DEV plan (drift detection)
    → DEV apply
      → Manual approval gate
        → PROD plan (fails on any drift)
          → PROD apply
```

---

## Security Posture

| Control | Status |
|---------|--------|
| Secrets in Azure Key Vault | Enabled |
| Workload Identity (OIDC) | Enabled in prod values |
| Private AKS cluster | Enabled |
| Pod security (non-root, read-only FS) | Enforced |
| Network policies (zero-trust) | Enforced |
| Container image scanning (Trivy) | Pre-build + post-build |
| Helm atomic deploy + rollback | Enabled |
| Pod Disruption Budgets | Configured |
| HPA (CPU + memory) | Configured |

See [SECURITY_OPERATIONS.md](./SECURITY_OPERATIONS.md) for procedures.

---

## Local Development

```bash
# Start full local stack
docker compose -f app/docker/docker-compose.yml up --build

# Services:
#   Order API       → http://localhost:3000
#   RabbitMQ UI     → http://localhost:15672  (guest/guest)
#   Kafka           → localhost:9092
#   Redis           → localhost:6379

# Run tests
npm test --prefix app/services/order-service
npm test --prefix app/services/inventory-service

# Build images
docker build -t order-service:dev     app/services/order-service
docker build -t inventory-service:dev app/services/inventory-service
```

See [app/README.md](./app/README.md) for details.
