# Event-Driven Azure Deployment Guide

This guide provides enterprise-grade deployment procedures for the event-driven microservices application on Azure.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Deployment](#infrastructure-deployment)
3. [Application Deployment](#application-deployment)
4. [First-Time Setup](#first-time-setup)
5. [Verification and Testing](#verification-and-testing)
6. [Security Checklist](#security-checklist)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools
- Azure CLI v2.50+
- Terraform >= 1.5.0
- Helm >= 3.12
- kubectl >= 1.28
- Git
- jq (for JSON parsing)

### Required Azure Permissions
- **Subscription**: Contributor role (for initial setup)
- **After setup**: Use least-privilege Custom RBAC roles

### Environment Variables
```bash
export ARM_SUBSCRIPTION_ID="<your-subscription-id>"
export ARM_TENANT_ID="<your-tenant-id>"
export AZURE_DEVOPS_PAT="<your-ado-personal-access-token>"  # For pipelines
```

## Infrastructure Deployment

### Step 1: Plan Infrastructure (Dev Environment)

```bash
cd infra/envs/dev

# Initialize Terraform
terraform init -upgrade

# Plan changes (inspect before applying)
terraform plan -out=tfplan

# Review the plan output for:
# - Resource names and locations
# - Security settings
# - Network configuration
```

### Step 2: Deploy Infrastructure

```bash
# Apply the Terraform changes
terraform apply tfplan

# Save outputs
terraform output -json > ../../../infra-outputs.json

# Extract and document key values:
# - AKS cluster name
# - Container Registry URL
# - Key Vault name
# - Resource group name
```

### Step 3: Configure kubectl Access

```bash
# Get AKS credentials
az aks get-credentials \
  --resource-group "event-driven-dev-rg" \
  --name "event-driven-dev-aks" \
  --overwrite-existing

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### Step 4: Initialize Key Vault with Secrets

**⚠️ IMPORTANT: Never commit secrets to git**

```bash
KV_NAME=$(terraform output -raw key_vault_name)
RABBITMQ_URL="amqp://rabbitmq.event-driven.svc.cluster.local:5672"
REDIS_URL="redis://redis.event-driven.svc.cluster.local:6379"
JWT_SECRET=$(openssl rand -base64 32)

# Store secrets in Key Vault
az keyvault secret set --vault-name "$KV_NAME" --name "rabbitmq-url" --value "$RABBITMQ_URL"
az keyvault secret set --vault-name "$KV_NAME" --name "redis-url" --value "$REDIS_URL"
az keyvault secret set --vault-name "$KV_NAME" --name "jwt-secret" --value "$JWT_SECRET"

# For production, also store:
az keyvault secret set --vault-name "$KV_NAME" --name "jumpbox-ssh-public-key" --value "ssh-rsa ..."
az keyvault secret set --vault-name "$KV_NAME" --name "jumpbox-allowed-ssh-cidr" --value "YOUR.IP/32"

echo "✅ Secrets stored in Key Vault: $KV_NAME"
```

## Application Deployment

### Step 1: Configure Azure Pipelines

1. **Create Variable Group in Azure DevOps**:
   ```
   Name: event-driven-azure-dev
   Variables:
   - acrName: <your-acr-name>
   - azureResourceGroup: event-driven-dev-rg
   - aksClusterName: event-driven-dev-aks
   - keyVaultName: event-driven-dev-kv
   - kafkaBroker: kafka.event-driven.svc.cluster.local:29092
   - approvalNotifyUsers: your-email@company.com
   ```

2. **Create Service Connection**:
   - Name: `IAC-Conn`
   - Type: Azure Resource Manager
   - Scope: Subscription level
   - Authentication: Service Principal (managed identity)

3. **Create Environments**:
   - Go to Pipelines > Environments
   - Create `dev`, `staging`, `prod` environments
   - Add approval checks for staging and prod

### Step 2: Deploy via Azure Pipelines

The pipeline automatically:
1. Runs unit tests and coverage checks
2. Scans source code for vulnerabilities
3. Builds and pushes container images (with semantic versioning)
4. Scans images for vulnerabilities
5. Waits for manual approval
6. Deploys to AKS using Helm (with automatic rollback)
7. Verifies deployment health

**Trigger deployment**:
```bash
git push origin main
```

### Step 3: Manual Application Deployment (Local Development)

**For local development without Azure Pipelines**:

```bash
# 1. Build images locally
docker build -t event-driven-acr.azurecr.io/order-service:dev services/order-service
docker build -t event-driven-acr.azurecr.io/inventory-service:dev services/inventory-service

# 2. Push to ACR
az acr login --name event-driven-acr
docker push event-driven-acr.azurecr.io/order-service:dev
docker push event-driven-acr.azurecr.io/inventory-service:dev

# 3. Create namespace and secrets
kubectl create namespace event-driven

export JWT_SECRET=$(openssl rand -base64 32)
kubectl create secret generic event-driven-azure-runtime \
  --namespace event-driven \
  --from-literal=RABBITMQ_URL="amqp://rabbitmq:5672" \
  --from-literal=REDIS_URL="redis://redis:6379" \
  --from-literal=JWT_SECRET="$JWT_SECRET"

# 4. Deploy with Helm
helm repo add myrepo file://./helm
helm upgrade --install event-driven-azure ./helm/order-service \
  --namespace event-driven \
  --values helm/order-service/values-dev.yaml \
  --set-string global.imageRegistry=event-driven-acr.azurecr.io \
  --set-string global.imageTag=dev \
  --set-string config.kafkaBroker=kafka.event-driven.svc.cluster.local:29092 \
  --set secrets.create=false \
  --set-string secrets.existingSecret=event-driven-azure-runtime

# 5. Verify deployment
kubectl rollout status deployment -n event-driven --timeout=5m
```

## First-Time Setup

### Setup Checklist

- [ ] Infrastructure deployed (Terraform)
- [ ] Key Vault populated with secrets
- [ ] ACR configured with container images
- [ ] AKS cluster networking configured
- [ ] Azure Pipelines variable groups created
- [ ] Azure Pipelines service connections configured
- [ ] Helm charts deployed successfully
- [ ] Network policies applied
- [ ] Monitoring/OTEL configured
- [ ] Firewall rules updated (if applicable)
- [ ] DNS records configured (for ingress)

### Setup Troubleshooting

**AKS API Server Not Accessible**:
```bash
# If private cluster: Use jumpbox
# If public cluster: Check authorized IP ranges
terraform output aks_api_server_endpoint
```

**Key Vault Access Denied**:
```bash
# Verify access policies
az keyvault show --name <kv-name> --query "properties.accessPolicies"

# Grant access if needed
az keyvault set-policy --name <kv-name> --upn <your-email> \
  --secret-permissions get list set
```

## Verification and Testing

### Health Checks

```bash
# Check pod status
kubectl get pods -n event-driven
kubectl describe pod <pod-name> -n event-driven

# Check readiness
kubectl exec -it <pod-name> -n event-driven -- curl -s http://localhost:8080/readyz | jq .

# Check logs
kubectl logs <pod-name> -n event-driven
kubectl logs <pod-name> -n event-driven --previous  # For crashed pods
```

### Integration Tests

```bash
# Port forward to order-service
kubectl port-forward svc/event-driven-azure-order 3000:3000 -n event-driven

# Send test order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"items":["item1","item2"]}'

# Check metrics
curl http://localhost:3000/metrics | grep orders

# Check API documentation
open http://localhost:3000/api-docs
```

### Smoke Tests

```bash
# Run provided load tests
cd app/load-tests
npm install

# Basic smoke test
npm run smoke

# Production-like load test (use carefully!)
npm run load -- --duration 30s
```

## Security Checklist

### Secret Management
- [ ] No hardcoded secrets in code or configs
- [ ] All secrets stored in Azure Key Vault
- [ ] SSHKey Vault CSI driver enabled (production)
- [ ] Audit logging enabled for Key Vault access

### Network Security
- [ ] Network policies enforced
- [ ] Private AKS cluster enabled
- [ ] Authorized IP ranges configured
- [ ] NSGs applied to subnets
- [ ] Ingress TLS enabled

### Container Security
- [ ] Images scanned for vulnerabilities (Trivy)
- [ ] Base images patched and updated
- [ ] Container registries private (ACR)
- [ ] Pod Security Policies enforced
- [ ] Non-root user enforced

### Access Control
- [ ] RBAC enabled on AKS
- [ ] Azure Workload Identity enabled (production)
- [ ] Service principals have least-privilege
- [ ] Multi-factor authentication enabled for admins
- [ ] Audit logs retained for compliance

### Monitoring & Logging
- [ ] Azure Monitor enabled
- [ ] Alert rules configured for anomalies
- [ ] Logs retained for compliance period
- [ ] Diagnostic settings enabled

## Troubleshooting

### Pod Fails to Start

```bash
# 1. Check pod events
kubectl describe pod <pod-name> -n event-driven

# 2. Check image pull
kubectl get events -n event-driven | grep -i pull

# 3. Verify secrets exist
kubectl get secrets -n event-driven

# 4. Check resource limits
kubectl top pods -n event-driven
```

### Deployment Fails

```bash
# 1. Check Helm release status
helm status event-driven-azure -n event-driven

# 2. Get deployment description
kubectl describe deployment <deployment-name> -n event-driven

# 3. Rollback if needed
helm rollback event-driven-azure -n event-driven

# 4. Check previous release history
helm history event-driven-azure -n event-driven
```

### Connectivity Issues

```bash
# Test DNS resolution
kubectl run debug --image=busybox --rm -it -- nslookup kafka.event-driven.svc.cluster.local

# Test pod-to-pod connectivity
kubectl run debug --image=busybox --rm -it -- wget -O- http://order-service:3000/healthz

# Check network policies
kubectl get networkpolicies -n event-driven
kubectl describe np <policy-name> -n event-driven
```

### Performance Issues

```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n event-driven

# Check HPA status
kubectl get hpa -n event-driven
kubectl describe hpa <hpa-name> -n event-driven

# Check metrics
kubectl top pods --containers -n event-driven
```

---

## Next Steps

- Review [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)
- Consult [Runbooks](./RUNBOOKS.md) for operational procedures
- Check [Infrastructure Documentation](./infra/README.md)
