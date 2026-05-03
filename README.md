# Event-Driven Azure - Enterprise-Grade Microservices Platform

A production-ready, event-driven microservices platform deployed on Azure Kubernetes Service with Kafka, RabbitMQ, and Redis.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Ingress (HTTPS)                           │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│  Order Service (HPA: 3-10 replicas)                         │
│  - REST API for order placement                             │
│  - Rate limiting (Redis)                                    │
│  - Swagger documentation                                    │
│  - Traces: OpenTelemetry                                    │
│  - Metrics: Prometheus                                      │
└─────────────────────────────────────────────────────────────┘
              ↓ (Kafka)
┌──────────────┬──────────────┬──────────────────────────┐
│  Inventory   │              │  Retry Worker            │
│  Service     │   (Kafka)    │  (RabbitMQ)              │
│  (HPA)       │              │  (HPA)                   │
└──────────────┴──────────────┴──────────────────────────┘
              ↕ (RabbitMQ DLQ)
       ┌─────────────┐
       │  Redis      │
       │  (Cache)    │
       └─────────────┘

Observability:
- Prometheus metrics
- OpenTelemetry traces
- Structured logging (JSON)
- Azure Monitor integration
```

## ✨ Features

### Application Features
- **Event-driven architecture**: Kafka for async order processing
- **High availability**: Multi-replica deployments with Pod Disruption Budgets
- **Rate limiting**: Redis-backed distributed rate limiter
- **API documentation**: Swagger UI
- **Health checks**: `/healthz` (liveness), `/readyz` (readiness)
- **Metrics**: Prometheus `/metrics` endpoint
- **Tracing**: Distributed tracing via OpenTelemetry
- **Idempotency**: Supports retry logic with dead-letter queue

### Infrastructure Features  
- **Kubernetes**: AKS with RBAC, network policies, pod security
- **Networking**: Private VNet, private AKS cluster, NSGs
- **Security**:
  - Azure Key Vault for secrets
  - Workload Identity (production)
  - Pod Security Standards
  - Network policies (zero-trust)
  - RBAC and audit logging
- **Scalability**: HPA based on CPU/memory metrics
- **Disaster Recovery**: Atomic Helm deployments with automatic rollback
- **Monitoring**: Azure Monitor integration and alerts
- **Compliance**: SOC2, audit trails, secret rotation

### DevOps Features
- **CI/CD**: Azure Pipelines with security gates
- **Security gates**:
  - Pre-build: Trivy config/secret scanning
  - Source: Dependency vulnerability scanning  
  - Post-build: Container image scanning
  - Manual approval before deployment
- **Semantic versioning**: Git-based image tagging
- **Infrastructure as Code**: Terraform with enterprise patterns
- **Helm charts**: Production-grade templating
- **Testing**: Unit tests, coverage thresholds, integration tests

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Initial setup & deployment procedures |
| [RUNBOOKS.md](./RUNBOOKS.md) | Operational procedures & incident response |
| [SECURITY_OPERATIONS.md](./SECURITY_OPERATIONS.md) | Security procedures & compliance |
| [infra/README.md](./infra/README.md) | Infrastructure architecture |
| [infra/SECURITY_CHECKLIST.md](./infra/SECURITY_CHECKLIST.md) | Infrastructure security |
| [app/README.md](./app/README.md) | Application setup & testing |

## 🚀 Quick Start

### Prerequisites
- Azure CLI v2.50+
- Terraform >= 1.5.0
- kubectl >= 1.28
- Helm >= 3.12
- Docker (for local testing)

### 1. Deploy Infrastructure

```bash
cd infra/envs/dev

# Initialize Terraform
terraform init -upgrade

# Plan and review changes
terraform plan -out=tfplan

# Apply infrastructure
terraform apply tfplan

# Get outputs
terraform output -json > /tmp/outputs.json
```

### 2. Configure Kubernetes

```bash
# Get kubeconfig
az aks get-credentials \
  --resource-group "event-driven-dev-rg" \
  --name "event-driven-dev-aks" \
  --overwrite-existing

# Verify cluster
kubectl cluster-info
kubectl get nodes
```

### 3. Setup Secrets

```bash
KV_NAME=$(terraform output -raw key_vault_name)

# Store secrets (NEVER in git!)
az keyvault secret set --vault-name "$KV_NAME" \
  --name "rabbitmq-url" --value "amqp://rabbitmq:5672"
az keyvault secret set --vault-name "$KV_NAME" \
  --name "redis-url" --value "redis://redis:6379"
az keyvault secret set --vault-name "$KV_NAME" \
  --name "jwt-secret" --value "$(openssl rand -base64 32)"
```

### 4. Deploy Application

**Option A: Azure Pipelines** (Recommended)
```bash
git push origin main
# Pipeline triggers automatically
# Watch at: https://dev.azure.com/your-org/your-project/_build
```

**Option B: Manual Helm Deployment**
```bash
helm upgrade --install event-driven-azure ./app/helm/order-service \
  --namespace event-driven \
  --values app/helm/order-service/values-dev.yaml \
  --set-string global.imageTag=latest \
  --set secrets.create=false
```

### 5. Verify Deployment

```bash
# Check pods
kubectl get pods -n event-driven

# Port-forward to test
kubectl port-forward svc/order-service 3000:3000 -n event-driven

# Test API
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"items":["item1"]}'

# View API docs
open http://localhost:3000/api-docs
```

## 🔐 Security Best Practices

### ✅ Do's
- Store all sensitive data in Azure Key Vault
- Use Workload Identity for AKS authentication (production)
- Enable network policies for pod-to-pod security
- Scan images and dependencies for vulnerabilities
- Rotate secrets quarterly minimum
- Enable audit logging for compliance
- Use least-privilege RBAC roles
- Run containers as non-root user

### ❌ Don'ts
- Never commit secrets to git
- Never use hardcoded credentials in code/configs
- Don't expose cluster API publicly (keep private)
- Don't skip security scanning in CI/CD pipeline
- Don't use overly permissive network policies
- Don't run containers as root
- Don't ignore security advisories and patches

## 📊 Monitoring & Observability

### Logs
- Structured JSON logging via Pino
- Streamed to Azure Monitor/Application Insights
- Query: `kubectl logs -f deployment/<name> -n event-driven`

### Metrics  
- Prometheus format at `/metrics`
- Scraped by Azure Monitor
- Key metrics: `orders_total`, `kafka_messages`, `http_requests_duration`

### Traces
- OpenTelemetry instrumentation
- Exported to OTEL collector
- Query distributed traces across services

### Health Checks
- `/healthz`: Basic liveness check
- `/readyz`: Full readiness (dependencies up)
- Used by Kubernetes probes for auto-healing

## 🔄 Deployment Strategy

### Development
- Single replica, minimal resources
- Network policies disabled for debugging
- Tracing disabled (reduce overhead)
- Manual approval not required

### Production
- Multi-replica with HPA
- High-availability configuration
- Workload Identity for secure auth
- Key Vault CSI driver for secrets
- All security policies enforced
- Manual approval required
- Automatic rollback on failure

## 📈 Scaling

### Horizontal Scaling (Add Replicas)
Automatic via Kubernetes HPA:
```yaml
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

### Vertical Scaling (Increase Resources)
Update resource requests/limits and redeploy:
```yaml
resources:
  requests:
    cpu: 300m
    memory: 384Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

## 🐛 Troubleshooting

### Pod Won't Start
```bash
kubectl describe pod <pod> -n event-driven
kubectl logs <pod> -n event-driven --previous
```

### No Connectivity Between Pods
```bash
# Check network policies
kubectl get networkpolicies -n event-driven

# Test DNS
kubectl run debug --rm -it --image=busybox -- nslookup kafka
```

### Out of Memory
```bash
# Check memory usage
kubectl top pods -n event-driven --sort-by=memory

# Increase limits
kubectl set resources deployment <name> --limits=memory=1Gi -n event-driven
```

See [RUNBOOKS.md](./RUNBOOKS.md) for more troubleshooting.

## 🛠️ Development

### Local Testing
```bash
# Run services locally with Docker Compose
cd app
docker compose -f docker/docker-compose.yml up --build

# Services available at:
# - Order API: http://localhost:3000
# - RabbitMQ: http://localhost:15672 (guest/guest)
# - Kafka: localhost:9092
```

### Code Quality
```bash
# Run tests
npm test --prefix app/services/order-service
npm test --prefix app/services/inventory-service

# Linting
npm run lint --prefix app/services/order-service

# Coverage thresholds enforced:
# - Order Service: 70% coverage
# - Inventory Service: 65% coverage
```

### Build Docker Images Locally
```bash
docker build -t order-service:dev app/services/order-service
docker build -t inventory-service:dev app/services/inventory-service
```

## 📋 Compliance

This platform supports:
- **SOC2**: Audit logging, access controls, encryption
- **ISO 27001**: Information security management
- **HIPAA** (with additional configuration)
- **PCI-DSS** (with additional configuration)
- **GDPR**: Data retention policies, encryption

See [SECURITY_OPERATIONS.md](./SECURITY_OPERATIONS.md) for audit procedures.

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Make changes and test locally
3. Run security checks: `trivy fs .`
4. Commit: `git commit -m "feat: description"`
5. Push: `git push origin feature/name`
6. Create pull request
7. Pipeline runs security gates + tests
8. Team reviews and approves
9. Merge triggers deployment

## 📞 Support

For issues:
- **Security incidents**: security@company.com
- **Infrastructure**: Contact platform-team
- **Application bugs**: File GitHub issue
- **Deployment help**: See docs or contact DevOps team

## 📜 License

[Add appropriate license: MIT, Apache 2.0, proprietary, etc.]

## Changelog

### v1.1.0 (2026-05-03) - Enterprise Hardening
- ✅ Enterprise-grade security improvements
  - Removed hardcoded secrets from terraform.tfvars
  - Added Key Vault CSI driver integration
  - Configured Workload Identity for AKS
  - Implemented network policies
  
- ✅ Pipeline improvements
  - Semantic versioning for container images
  - Enhanced approval gates
  - Automatic rollback on failure
  - Trivy vulnerability scanning
  
- ✅ Helm chart enhancements
  - Production-grade values (HPA, pod disruption budgets)
  - Development-optimized values
  - Full Workload Identity support
  
- ✅ Documentation
  - Deployment guide with step-by-step procedures
  - Operations runbooks for common tasks
  - Security operations procedures
  
- ✅ Container improvements
  - Multi-stage Dockerfile builds
  - Pinned Node.js version (20.11-alpine)
  - dumb-init for signal handling
  - Enhanced health checks

### v1.0.0 (2026-04-29) - Initial Release
- Core microservices (Order, Inventory, Retry Worker)
- Kafka, RabbitMQ, Redis integration
- Basic Kubernetes deployment
- Azure Pipelines CI/CD
- Terraform infrastructure

---

**Last Updated**: May 3, 2026  
**Maintained By**: Platform Engineering Team  
**Status**: Production Ready ✅
