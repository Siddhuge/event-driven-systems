# Security Operations Guide

Enterprise-grade security procedures and incident response for the event-driven platform.

## Table of Contents

1. [Secret Management](#secret-management)
2. [Access Control](#access-control)
3. [Network Security](#network-security)
4. [Vulnerability Management](#vulnerability-management)
5. [Compliance & Audit](#compliance--audit)
6. [Incident Response](#incident-response)

## Secret Management

### Secret Lifecycle

**1. Create Secrets**:

```bash
# NEVER commit secrets to git!
# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_PASSWORD=$(openssl rand -base64 16)

# Store in Key Vault (not in tfvars or values files)
KV_NAME=$(terraform output -raw key_vault_name)
az keyvault secret set --vault-name "$KV_NAME" --name "jwt-secret" --value "$JWT_SECRET"
az keyvault secret set --vault-name "$KV_NAME" --name "admin-password" --value "$ADMIN_PASSWORD"

echo "✅ Secrets stored in Key Vault: $KV_NAME"
```

**2. Rotate Secrets**:

```bash
# Before rotation, notify teams
# Gradual rollout to prevent service disruption

# Update in Key Vault
NEW_JWT_SECRET=$(openssl rand -base64 32)
az keyvault secret set --vault-name "$KV_NAME" --name "jwt-secret" --value "$NEW_JWT_SECRET"

# Restart pods to pick up new secret
kubectl rollout restart deployment -n event-driven

# Verify all pods started with new secret
kubectl logs -n event-driven | grep "secret updated" || echo "Verify in logs"
```

**3. Audit Secret Access**:

```bash
# Enable Key Vault logging (production)
az monitor diagnostic-settings create \
  --name "keyvault-audit" \
  --resource "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/event-driven-prod-rg/providers/Microsoft.KeyVault/vaults/event-driven-prod-kv" \
  --logs '[{"category":"AuditEvent","enabled":true}]' \
  --workspace "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/event-driven-prod-rg/providers/Microsoft.OperationalInsights/workspaces/event-driven-logs"

# Query audit logs
az monitor log-analytics query \
  --workspace "event-driven-logs" \
  --analytics-query 'AuditEvent | where ResourceType == "Microsoft.KeyVault" | order by TimeGenerated desc'
```

### Secret Management Best Practices

- ✅ Store secrets **only** in Azure Key Vault
- ✅ Use **Key Vault CSI driver** for pod secret injection (production)
- ✅ Use **Workload Identity** instead of secrets (production)
- ✅ **Rotate** secrets quarterly minimum
- ✅ **Audit** all Key Vault access
- ✅ Use **service-specific** secrets (not monolithic)
- ✅ **Expire** secrets after 90 days (enforce in Key Vault)
- ❌ Never commit secrets to git
- ❌ Never pass secrets as environment variables in Helm charts
- ❌ Never log/print secrets

## Access Control

### RBAC Configuration

**AKS Cluster RBAC**:

```bash
# Enable RBAC (already enabled by Terraform)
kubectl auth reconcile -f - <<EOF
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: readonly
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list"]
---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: readonly-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: readonly
subjects:
- kind: Group
  name: "readonly-team@company.com"
  apiGroup: rbac.authorization.k8s.io
EOF

# Verify RBAC
kubectl get clusterroles | grep -i event-driven
kubectl get clusterrolebindings | grep -i event-driven
```

**Azure RBAC (Control Plane)**:

```bash
# Grant AKS admin role
az role assignment create \
  --assignee-object-id $(az ad user show --id user@company.com --query objectId -o tsv) \
  --assignee-principal-type User \
  --role "Azure Kubernetes Service Cluster Admin Role" \
  --scope /subscriptions/$(az account show --query id -o tsv)/resourceGroups/event-driven-dev-rg/providers/Microsoft.ContainerService/managedClusters/event-driven-dev-aks

# Grant Read-Only role
az role assignment create \
  --assignee-object-id $(az ad group show --group "developers" --query objectId -o tsv) \
  --assignee-principal-type Group \
  --role "Azure Kubernetes Service Cluster User Role" \
  --scope /subscriptions/$(az account show --query id -o tsv)/resourceGroups/event-driven-dev-rg
```

### Workload Identity Setup (Production)

**Enable Workload Identity on AKS**:

```bash
# Already enabled by Terraform, but verify:
az aks show -g event-driven-prod-rg -n event-driven-prod-aks \
  --query "oidcIssuerProfile"

# Create Azure AD Application
APP_ID=$(az ad app create --display-name "event-driven-prod-wi" \
  --query appId -o tsv)

# Create service principal
SP_OBJECT_ID=$(az ad sp create --id $APP_ID --query objectId -o tsv)

# Create federated credential
OIDC_ISSUER=$(az aks show -g event-driven-prod-rg -n event-driven-prod-aks \
  --query "oidcIssuerProfile.issuerUrl" -o tsv)

az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "kubernetes-workload-identity",
    "issuer": "'$OIDC_ISSUER'",
    "subject": "system:serviceaccount:event-driven:default",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Grant Key Vault access
KV_ID=$(az keyvault show -g event-driven-prod-rg -n event-driven-prod-kv --query id -o tsv)
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --role "Key Vault Secrets User" \
  --scope $KV_ID

echo "✅ Workload Identity configured: $APP_ID"
```

## Network Security

### Network Policy Enforcement

**View current policies**:

```bash
kubectl get networkpolicies -n event-driven
kubectl describe np <policy-name> -n event-driven
```

**Example: Deny all ingress, allow specific**:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: event-driven-default-deny
  namespace: event-driven
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: order-service-ingress
  namespace: event-driven
spec:
  podSelector:
    matchLabels:
      app: order-service
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: event-driven
    ports:
    - protocol: TCP
      port: 3000
```

**Apply policies**:

```bash
kubectl apply -f network-policies.yaml
# Verify
kubectl get networkpolicies -A
```

### Azure NSG Rules

**Restrict API server access**:

```bash
# Already configured by Terraform, but verify:
az network nsg rule list \
  --resource-group event-driven-prod-rg \
  --nsg-name event-driven-prod-vnet-aks-nsg \
  --output table
```

## Vulnerability Management

### Container Image Scanning

**Manual scanning**:

```bash
# Install Trivy
brew install trivy  # macOS
# or
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh

# Scan image
trivy image event-driven-acr.azurecr.io/order-service:latest

# Scan with fail on high severity
trivy image --severity HIGH,CRITICAL --exit-code 1 \
  event-driven-acr.azurecr.io/order-service:latest

# Generate SBOM (Software Bill of Materials)
trivy image --format cyclonedx -o sbom.json \
  event-driven-acr.azurecr.io/order-service:latest
```

**Automated scanning** (in pipeline):
```bash
# Already configured in azure-pipelines-app.yml
# Fails build on HIGH/CRITICAL vulnerabilities
```

### Dependency Vulnerability Scanning

```bash
# Scan npm dependencies
npm audit --omit=dev

# Fix vulnerabilities
npm audit fix --omit=dev

# Check for outdated packages
npm outdated

# Generate SBOM for dependencies
npm ls --depth=0 > dependencies.txt
```

### Patch Management

**Update base images**:

```bash
# Check for updates
docker pull node:20.11-alpine

# Update Dockerfile
vim Dockerfile  # Change node:20.11-alpine to latest patch

# Test locally
docker build -t order-service:test .

# Commit and push
git add Dockerfile
git commit -m "chore: update Node.js to latest patch"
git push origin main

# Pipeline automatically builds and scans new image
```

## Compliance & Audit

### Enable Audit Logging

```bash
# Azure Monitor diagnostic settings (already configured by Terraform)
# Verify:
az monitor diagnostic-settings list \
  --resource /subscriptions/$(az account show --query id -o tsv)/resourceGroups/event-driven-prod-rg/providers/Microsoft.KeyVault/vaults/event-driven-prod-kv
```

### Query Audit Logs

```bash
# Key Vault access audit
az monitor log-analytics query \
  --workspace "event-driven-logs" \
  --analytics-query 'AuditEvent | where ResourceType == "Microsoft.KeyVault" | project TimeGenerated, Caller, OperationName, ResultSignature | order by TimeGenerated desc'

# AKS API server audit (if enabled)
kubectl logs -n kube-system -l component=kube-apiserver | grep audit
```

### Compliance Reporting

```bash
# Generate compliance report
#!/bin/bash
echo "=== Event-Driven Azure Compliance Report ==="
date

echo ""
echo "=== Pod Security Policy ==="
kubectl get psp -A 2>/dev/null || echo "PSP not enabled (expected, use Pod Security Standards)"

kubectl get pods -n event-driven -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext}{"\n"}{end}'

echo ""
echo "=== Network Policies ==="
kubectl get networkpolicies -n event-driven

echo ""
echo "=== RBAC Bindings ==="
kubectl get rolebindings,clusterrolebindings -A | grep event-driven

echo ""
echo "=== Secret Access ==="
echo "Consult Azure Monitor logs for Key Vault access audit"

echo ""
echo "=== Image Scan Results ==="
az acr repository list --name event-driven-acr | while read repo; do
  echo "Repository: $repo"
  az acr scan --registry event-driven-acr --repository "$repo" 2>/dev/null || echo "Scan not available"
done
```

## Incident Response

### Security Incident Procedure

1. **Detect**: Monitor alerts, logs, or external notification
2. **Respond**: Immediate containment
3. **Investigate**: Determine scope and impact
4. **Remediate**: Fix vulnerability/breach
5. **Document**: Post-incident review

### Example: Compromised Container

```bash
# 1. ISOLATE
# Remove pod from service immediately
kubectl delete pod <compromised-pod> -n event-driven

# 2. GATHER EVIDENCE
# Capture pod logs before deletion
kubectl logs <pod> -n event-driven > evidence-pod-logs.txt

# 3. INVESTIGATE  
# Check container image for tampering
trivy image event-driven-acr.azurecr.io/order-service:compromised-tag

# 4. REMEDIATE
# Rebuild image from source
docker build -t order-service:fixed .
docker push event-driven-acr.azurecr.io/order-service:fixed

# 5. DEPLOY FIX
kubectl set image deployment/order-service \
  order-service=event-driven-acr.azurecr.io/order-service:fixed \
  -n event-driven

# 6. DOCUMENT
# File incident report with timeline
```

### Example: Exposed Secret

```bash
# 1. REVOKE immediately
az keyvault secret delete --vault-name event-driven-prod-kv --name jwt-secret
az keyvault secret purge --vault-name event-driven-prod-kv --name jwt-secret

# 2. ROTATE secret
NEW_SECRET=$(openssl rand -base64 32)
az keyvault secret set --vault-name event-driven-prod-kv --name jwt-secret --value "$NEW_SECRET"

# 3. RESTART pods to pick up new secret
kubectl rollout restart deployment -n event-driven

# 4. AUDIT
# Review who had access to the secret in logs
az monitor log-analytics query \
  --workspace event-driven-logs \
  --analytics-query 'AuditEvent | where SecretName == "jwt-secret"'

# 5. PREVENT: Enable RBAC, audit logging, secret rotation
```

---

## Security Checklist

### Monthly
- [ ] Review access logs
- [ ] Check for outdated packages
- [ ] Verify backup integrity
- [ ] Run security scan on codebase

### Quarterly  
- [ ] Rotate all secrets
- [ ] Patch base images
- [ ] Update cluster version
- [ ] Review RBAC permissions

### Annually
- [ ] Full security assessment
- [ ] Penetration testing
- [ ] Compliance audit
- [ ] Disaster recovery drill

---

For security incidents, contact: **security@company.com**
