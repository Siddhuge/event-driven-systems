# Operations Runbook

Quick reference for common operational tasks and incident response procedures.

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Deployment Procedures](#deployment-procedures)
3. [Scaling & Performance](#scaling--performance)
4. [Incident Response](#incident-response)
5. [Backup & Recovery](#backup--recovery)

## Daily Operations

### Health Check

**Run every shift start**:

```bash
#!/bin/bash
set -e

NAMESPACE="event-driven"

echo "🔍 Health Check - $(date)"
echo ""

# Check AKS cluster
echo "▶ AKS Cluster Status:"
kubectl cluster-info
echo ""

# Check pod status
echo "▶ Pod Status:"
kubectl get pods -n $NAMESPACE -o wide
echo ""

# Check deployments
echo "▶ Deployment Status:"
kubectl get deployments -n $NAMESPACE -o wide
echo ""

# Check resource usage
echo "▶ Resource Usage:"
kubectl top pods -n $NAMESPACE --sort-by=memory 2>/dev/null || echo "Metrics server not available"
echo ""

# Check events
echo "▶ Recent Events (last 10):"
kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -10
echo ""

# Check service status
echo "▶ Service Status:"
kubectl get svc -n $NAMESPACE
echo ""

# Check HPA
echo "▶ Auto-scaling Status:"
kubectl get hpa -n $NAMESPACE
echo ""

echo "✅ Health check complete"
```

### Log Aggregation

**View logs from all pods**:

```bash
# Stream logs from order-service
kubectl logs -f deployment/event-driven-azure-order -n event-driven

# Stream logs from multiple deployments  
kubectl logs -f pods -l app.kubernetes.io/component=order-service -n event-driven

# View logs from previous crashed pod
kubectl logs <pod-name> -n event-driven --previous

# Search for errors
kubectl logs -n event-driven --tail=1000 | grep -i error
```

## Deployment Procedures

### Rolling Update

**Deploy new version to development**:

```bash
#!/bin/bash
set -e

IMAGE_TAG="${1:-prod}"
HELM_VALUES="${2:-values-dev.yaml}"

echo "🚀 Rolling update with tag: $IMAGE_TAG using $HELM_VALUES"

helm upgrade event-driven-azure ./helm/order-service \
  --namespace event-driven \
  --values helm/order-service/$HELM_VALUES \
  --set-string global.imageTag=$IMAGE_TAG \
  --wait \
  --timeout 10m

echo "⏳ Waiting for rollout..."
kubectl rollout status deployment -n event-driven --timeout=10m

echo "✅ Deployment successful"
```

### Canary Deployment

**Test new version on limited replicas**:

```bash
# Deploy to 1 replica with new image
kubectl set image deployment/event-driven-azure-order \
  order-service=event-driven-acr.azurecr.io/order-service:new-version \
  -n event-driven \
  --record

# Monitor metrics
kubectl logs -f deployment/event-driven-azure-order -n event-driven

# Increase replicas gradually
kubectl scale deployment event-driven-azure-order --replicas=2 -n event-driven
kubectl scale deployment event-driven-azure-order --replicas=3 -n event-driven

# Rollback if needed
kubectl rollout undo deployment/event-driven-azure-order -n event-driven
```

### Helm Rollback

**Revert to previous release**:

```bash
# List release history
helm history event-driven-azure -n event-driven

# Rollback to previous release
helm rollback event-driven-azure -n event-driven

# Rollback to specific revision
helm rollback event-driven-azure 3 -n event-driven

# Check status
helm status event-driven-azure -n event-driven
```

## Scaling & Performance

### Manual Scaling

```bash
# Scale order-service to 5 replicas
kubectl scale deployment event-driven-azure-order --replicas=5 -n event-driven

# Verify scaling
kubectl get pods -n event-driven -o wide

# Monitor metrics during scaling
watch 'kubectl top pods -n event-driven'
```

### Auto-Scaling Configuration

**Adjust HPA thresholds**:

```bash
# View current HPA config
kubectl get hpa -n event-driven -o yaml

# Edit HPA
kubectl edit hpa event-driven-azure-order -n event-driven

# Typical changes:
# - maxReplicas: increase for peak load
# - targetCPUUtilizationPercentage: adjust (70% is default)
# - targetMemoryUtilizationPercentage: add memory-based scaling

# Example HPA patch
kubectl patch hpa event-driven-azure-order -n event-driven -p \
  '{"spec":{"maxReplicas":15,"targetCPUUtilizationPercentage":75}}'
```

### Resource Limit Adjustment

```bash
# Check current resource usage patterns
kubectl top pods -n event-driven --containers

# Update resource requests/limits in values
vim helm/order-service/values.yaml

# Apply changes
helm upgrade event-driven-azure ./helm/order-service \
  --namespace event-driven \
  --values helm/order-service/values-dev.yaml
```

## Incident Response

### High CPU Usage

**Step 1: Identify affected pods**
```bash
kubectl top pods -n event-driven --sort-by=cpu
```

**Step 2: Check pod logs**
```bash
kubectl logs <pod-name> -n event-driven | grep -i error | head -20
```

**Step 3: Increase replicas temporarily**
```bash
kubectl scale deployment <deployment> --replicas=5 -n event-driven
```

**Step 4: Investigate root cause**
```bash
# Check if specific endpoint is causing issues
kubectl logs -n event-driven | grep -A5 "slow" | head -30

# Check metrics
kubectl get pods -n event-driven -o json | jq '.items[].spec.containers[].resources'
```

**Step 5: Resolution**
- Increase resource limits if consistently hitting limits
- Optimize code/queries if above issue
- Scale HPA min replicas if needed

### Out Of Memory

**Step 1: Identify memory leaks**
```bash
# Check memory-heavy pods
kubectl top pods -n event-driven --sort-by=memory

# Check memory trends
kubectl get hpa -n event-driven
```

**Step 2: Restart problematic pod**
```bash
kubectl delete pod <pod-name> -n event-driven
# Pod will auto-restart thanks to deployment controller
```

**Step 3: Increase memory limits**
```bash
kubectl set resources deployment <name> \
  --limits=memory=1Gi \
  -n event-driven
```

**Step 4: Trace memory leak**
```bash
# Enable heap dumps/profiling in application
# Attach debugger and identify memory consumer
# Apply permanent fix to code
```

### Pod Crashing Loop

```bash
# Check crash reason
kubectl describe pod <pod-name> -n event-driven

# View logs from previous instance
kubectl logs <pod-name> -n event-driven --previous

# Common causes and fixes:
# - Missing env vars: Check secrets/configmaps
# - Port already in use: Check for conflicts
# - Bad image: Verify image exists in ACR
# - OOM: Increase memory limits
# - Permission denied: Check RBAC
```

### Network/Connectivity Issue

```bash
# Test DNS
kubectl run debug --image=busybox --rm -it -- nslookup kafka.event-driven.svc.cluster.local

# Test connectivity
kubectl run debug --image=busybox --rm -it -- wget -O- http://order-service:3000/healthz

# Check network policies
kubectl get networkpolicies -n event-driven
kubectl describe np <policy-name> -n event-driven

# Check service endpoints
kubectl get endpoints -n event-driven

# Check ingress
kubectl get ingress -n event-driven
kubectl describe ingress <name> -n event-driven
```

### Database/Dependency Connection Failure

```bash
# Check if running Kafka, RabbitMQ, Redis
kubectl get pods -n event-driven -o wide

# Test connection from pod
kubectl run debug --image=busybox --rm -it -- \
  sh -c 'echo "Testing..." | nc -zv kafka 29092'

# Check connection strings in secrets
kubectl get secret event-driven-azure-runtime -n event-driven -o yaml

# Verify services are running
kubectl get svc -n event-driven
kubectl describe svc kafka -n event-driven
```

## Backup & Recovery

### Backup Key Data

```bash
# Backup Helm releases
helm get values event-driven-azure -n event-driven > backup-values.yaml
helm get hooks event-driven-azure -n event-driven > backup-hooks.yaml

# Backup Kubernetes resources
kubectl get deployment,statefulset,configmap,secret -n event-driven -o yaml > backup-k8s.yaml

# Backup PVCs (if using persistent storage)
kubectl get pvc -n event-driven -o yaml > backup-pvc.yaml
```

### Disaster Recovery

**Scenario: Complete cluster failure**

1. **Recreate infrastructure**:
   ```bash
   cd infra/envs/dev
   terraform apply
   ```

2. **Recreate secrets**:
   ```bash
   KV_NAME=$(terraform output -raw key_vault_name)
   # Secrets should be in Key Vault already
   ```

3. **Redeploy application**:
   ```bash
   kubectl create namespace event-driven
   helm install event-driven-azure ./helm/order-service \
     --namespace event-driven \
     --values helm/order-service/values-dev.yaml
   ```

**Scenario: Data loss in stateful service**

1. **Restore from backup**:
   ```bash
   # If using Azure Storage/Cosmos DB
   az backup job show --resource-group <rg> --vault-name <vault> --output table
   ```

2. **Point-in-time recovery** (if configured):
   ```bash
   # Application-specific restore process
   ```

---

## Useful Commands Reference

```bash
# Get resource usage across cluster
kubectl top nodes
kubectl top pods --all-namespaces

# Watch deployment rollout
watch kubectl rollout status deployment -n event-driven

# Port forward for local debugging
kubectl port-forward svc/order-service 3000:3000 -n event-driven

# Execute command in pod
kubectl exec -it <pod> -n event-driven -- /bin/sh

# Get pod IP address
kubectl get pods -n event-driven -o jsonpath='{.items[0].status.podIP}'

# Check RBAC permissions
kubectl auth can-i get pods --as=system:serviceaccount:event-driven:default

# Export deployed YAML
kubectl get deployment <name> -n event-driven -o yaml > deployment.yaml

# Apply kustomization
kubectl apply -k helm/order-service

# Dry-run deployment
kubectl apply -f deployment.yaml --dry-run=client
```

---

For additional help, see:
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Initial setup
- [SECURITY_CHECKLIST.md](./infra/SECURITY_CHECKLIST.md) - Security procedures
- [infra/docs/DEPLOYMENT.md](./infra/docs/DEPLOYMENT.md) - Infrastructure details
