# Quick Reference Card

**Event-Driven Azure Platform** | Quick commands for developers and operators

## 🚀 Deployment

### Deploy to Dev (via Pipeline)
```bash
git push origin main  # Triggers pipeline automatically
```

### Manual Helm Deployment
```bash
# Development
helm upgrade --install event-driven-azure ./app/helm/order-service \
  --namespace event-driven \
  --values app/helm/order-service/values-dev.yaml \
  --set-string global.imageTag=dev

# Production  
helm upgrade --install event-driven-azure ./app/helm/order-service \
  --namespace event-driven \
  --values app/helm/order-service/values-prod.yaml \
  --set-string global.imageTag=v1.0.0 \
  --set workloadIdentity.enabled=true
```

### Rollback
```bash
helm rollback event-driven-azure -n event-driven
```

## 📊 Monitoring

### Health Status
```bash
# All pods
kubectl get pods -n event-driven

# Detailed status
kubectl describe pod <pod-name> -n event-driven
kubectl logs <pod-name> -n event-driven

# Resource usage
kubectl top pods -n event-driven
```

### Service Health
```bash
# Port forward to test
kubectl port-forward svc/order-service 3000:3000 -n event-driven

# Test API
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"items":["item1"]}'

# Check metrics
curl http://localhost:3000/metrics
```

## 🔧 Scaling

### Manual Scale
```bash
# Scale deployment
kubectl scale deployment event-driven-azure-order --replicas=5 -n event-driven

# Watch HPA
kubectl get hpa -n event-driven
kubectl describe hpa <hpa-name> -n event-driven
```

### Auto-Scaling Update
```bash
# Edit HPA
kubectl edit hpa event-driven-azure-order -n event-driven

# Or patch
kubectl patch hpa event-driven-azure-order -n event-driven \
  -p '{"spec":{"maxReplicas":15}}'
```

## 🔐 Secrets

### View Secrets
```bash
# List secrets
kubectl get secrets -n event-driven

# Show secret value (decoded)
kubectl get secret event-driven-azure-runtime -n event-driven \
  -o jsonpath='{.data.REDIS_URL}' | base64 -d
```

### Update Secrets
```bash
KV_NAME=$(az keyvault list -g event-driven-dev-rg --query '[0].name' -o tsv)

# Create/update secret
az keyvault secret set --vault-name "$KV_NAME" \
  --name "jwt-secret" --value "$(openssl rand -base64 32)"

# Restart pods to pick up new secret
kubectl rollout restart deployment -n event-driven
```

## 📝 Logs

### Stream Logs
```bash
# Single pod
kubectl logs -f <pod-name> -n event-driven

# All pods in deployment
kubectl logs -f deployment/order-service -n event-driven --all-containers=true

# Last 100 lines
kubectl logs --tail=100 <pod-name> -n event-driven

# Previous pod (if crashed)
kubectl logs <pod-name> -n event-driven --previous
```

## 🐛 Troubleshooting

### Pod Issues
```bash
# Why pod won't start
kubectl describe pod <pod-name> -n event-driven

# Check image
kubectl get pod <pod-name> -n event-driven -o jsonpath='{.spec.containers[0].image}'

# Pull logs before crash
kubectl logs <pod-name> -n event-driven --previous
```

### Connectivity
```bash
# Test DNS
kubectl run debug --rm -it --image=busybox -- nslookup kafka

# Test service
kubectl run debug --rm -it --image=busybox -- \
  wget -O- http://order-service:3000/healthz

# Check endpoints
kubectl get endpoints -n event-driven
```

### Performance
```bash
# Top nodes
kubectl top nodes

# Top pods
kubectl top pods -n event-driven --sort-by=memory

# HPA status
kubectl get hpa -n event-driven -o wide
```

## 🔄 Updates

### Rolling Update
```bash
# Set new image
kubectl set image deployment/order-service \
  order-service=event-driven-acr.azurecr.io/order-service:v1.1.0 \
  -n event-driven --record

# Watch rollout
kubectl rollout status deployment/order-service -n event-driven

# Undo if needed
kubectl rollout undo deployment/order-service -n event-driven
```

### Helm Upgrade
```bash
helm repo update
helm upgrade event-driven-azure ./app/helm/order-service \
  -n event-driven \
  --values app/helm/order-service/values-dev.yaml

# Check status
helm status event-driven-azure -n event-driven
helm history event-driven-azure -n event-driven
```

## 📦 Container Management

### Build Locally
```bash
cd app/services/order-service
docker build -t order-service:dev .
```

### Push to ACR
```bash
az acr login --name event-driven-acr
docker tag order-service:dev event-driven-acr.azurecr.io/order-service:dev
docker push event-driven-acr.azurecr.io/order-service:dev
```

### Scan Image
```bash
trivy image event-driven-acr.azurecr.io/order-service:dev
trivy image --severity HIGH,CRITICAL --exit-code 1 \
  event-driven-acr.azurecr.io/order-service:dev
```

## 🔐 Access Control

### Get Credentials
```bash
az aks get-credentials \
  --resource-group event-driven-dev-rg \
  --name event-driven-dev-aks \
  --overwrite-existing
```

### Check Permissions
```bash
# Can I get pods?
kubectl auth can-i get pods -n event-driven

# As specific user
kubectl auth can-i get pods --as=user@company.com

# Check RBAC bindings
kubectl get rolebindings -n event-driven
```

## 🌐 Networking

### Port Forward
```bash
# Order service
kubectl port-forward svc/order-service 3000:3000 -n event-driven

# Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n monitoring

# Grafana
kubectl port-forward svc/grafana 3000:3000 -n monitoring
```

### DNS Check
```bash
# Query service DNS
kubectl run debug --rm -it --image=busybox -- \
  nslookup order-service.event-driven.svc.cluster.local
```

## 🎯 Useful Aliases

Add to `.bashrc` or `.zshrc`:

```bash
alias k='kubectl'
alias kgp='kubectl get pods'
alias kdp='kubectl delete pod'
alias kl='kubectl logs -f'
alias kex='kubectl exec -it'
alias kd='kubectl describe'
alias kwn='kubectl config set-context --current --namespace'

# Get pod in namespace
kpod() { kubectl get pod -n "$1" | grep "$2"; }

# Tail logs from deployment
ktail() { kubectl logs -f deployment/"$1" -n "$2"; }

# Port forward service
kpf() { kubectl port-forward svc/"$1" "$2":"$3" -n "$4"; }
```

Usage:
```bash
k get pods -n event-driven
ktail order-service event-driven
kpf order-service 3000 3000 event-driven
```

## 📖 Documentation Links

| Topic | Link |
|-------|------|
| Full Deployment Guide | [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) |
| Operations Runbook | [RUNBOOKS.md](./RUNBOOKS.md) |
| Security Guide | [SECURITY_OPERATIONS.md](./SECURITY_OPERATIONS.md) |
| Architecture | [README.md](./README.md) |
| Infrastructure | [infra/README.md](./infra/README.md) |
| Upgrade Summary | [ENTERPRISE_UPGRADE_SUMMARY.md](./ENTERPRISE_UPGRADE_SUMMARY.md) |

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| Pod won't start | `kubectl describe pod <name> -n event-driven` |
| No metrics | Check Prometheus scrape config, check `/metrics` endpoint |
| Can't access API | Check ingress: `kubectl get ingress -n event-driven` |
| Out of memory | `kubectl top pods --sort-by=memory`, increase limits |
| High CPU | Check logs for errors, scale up replicas |
| Secrets missing | `kubectl get secrets -n event-driven`, check Key Vault |

## 🚨 Emergency Commands

```bash
# Get all resources in namespace
kubectl get all -n event-driven

# Export deployment YAML
kubectl get deployment <name> -n event-driven -o yaml > backup.yaml

# Emergency scale up
kubectl scale deployment <name> --replicas=10 -n event-driven

# Force delete stuck pod
kubectl delete pod <name> -n event-driven --grace-period=0 --force

# Restart all pods in deployment
kubectl rollout restart deployment <name> -n event-driven

# Emergency drain node
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
```

---

**Last Updated**: May 3, 2026  
**Document**: QUICK_REFERENCE.md
