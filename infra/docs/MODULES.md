# Module Documentation

## Resource-Group Module

**Purpose:** Creates and manages Azure Resource Groups with proper tagging

**Security Features:**
- Requires explicit environment validation
- Automatic tagging for governance
- Prevents deletion if resources exist (prod)

**Inputs:**
- `name` (string, required): Resource group name (1-90 chars, alphanumeric, dots, hyphens, underscores, parentheses)
- `location` (string, required): Azure region
- `environment` (string, required): One of dev/prod/staging
- `tags` (map(string), optional): Custom tags to apply

**Outputs:**
- `name`: Resource group name
- `id`: Resource group ID
- `location`: Resource group location

**Example:**
```hcl
module "rg" {
  source      = "../../modules/resource-group"
  name        = "my-project-dev-rg"
  location    = "East US"
  environment = "dev"
  tags = {
    Owner = "platform-team"
  }
}
```

---

## Network Module

**Purpose:** Creates secure Virtual Networks with NSGs and subnet policies

**Security Features:**
- Automatic NSG with default deny policy
- Private endpoint network policies enabled
- DNS configuration for production
- Subnet isolation with enforce_private_link policies

**Inputs:**
- `name` (string, required): Virtual network name
- `location` (string, required): Azure region
- `rg_name` (string, required): Resource group name
- `environment` (string, required): Environment (dev/prod/staging)
- `tags` (map(string), optional): Tags to apply

**Outputs:**
- `subnet_id`: AKS subnet ID
- `vnet_id`: Virtual network ID
- `vnet_name`: Virtual network name

**Network Design:**
- VNet CIDR: 10.0.0.0/16
- AKS Subnet: 10.0.1.0/24 (up to 251 pods)
- Future subnets can use: 10.0.2.0/24, 10.0.3.0/24, etc.

---

## ACR Module

**Purpose:** Creates and manages Azure Container Registry with security hardening

**Security Features:**
- Premium SKU for enterprise features
- Public access disabled
- Admin access disabled
- Image quarantine enabled
- Zone redundancy in production
- Compliance with artifact integrity policies

**Inputs:**
- `name` (string, required): Container registry name (5-50 lowercase alphanumeric)
- `rg_name` (string, required): Resource group name
- `location` (string, required): Azure region
- `environment` (string, required): Environment (dev/prod/staging)
- `subnet_id` (string, optional): Subnet for private endpoint
- `tags` (map(string), optional): Tags

**Outputs:**
- `login_server`: ACR login server URL
- `id`: ACR resource ID
- `registry_name`: Registry name

**Usage in AKS:**
```bash
az acr login --name <registry-name>
docker tag myapp:latest <login-server>/myapp:v1.0
docker push <login-server>/myapp:v1.0
```

---

## Key Vault Module

**Purpose:** Creates secure Key Vault for secret management with compliance features

**Security Features:**
- Network isolation (deny by default)
- Soft delete (90 days) + Purge protection (prod only)
- Premium SKU in production
- Audit logging with 365-day retention (prod)
- Granular access policies for keys/secrets/certificates
- RBAC-ready for managed identities

**Inputs:**
- `name` (string, required): Key Vault name (3-24 alphanumeric and hyphens)
- `rg_name` (string, required): Resource group name
- `location` (string, required): Azure region
- `environment` (string, required): Environment (dev/prod/staging)
- `tenant_id` (string, required, sensitive): Azure Tenant ID
- `object_id` (string, required, sensitive): Principal object ID
- `tags` (map(string), optional): Tags

**Outputs:**
- `id`: Key Vault ID
- `vault_uri`: URI for accessing secrets
- `name`: Key Vault name

**Adding Secrets:**
```bash
az keyvault secret set --vault-name <kv-name> --name "db-password" --value "<password>"
az keyvault secret show --vault-name <kv-name> --name "db-password"
```

---

## AKS Module

**Purpose:** Creates enterprise-grade Kubernetes cluster with security hardening

**Security Features:**
- Private cluster (not exposed to internet)
- Private API server with IP-based authorization
- Azure Network Policy for pod isolation
- RBAC enabled by default
- Azure Policy integration for compliance
- System-assigned managed identity
- Network plugin: Azure CNI
- Auto-scaling configured

**Inputs:**
- `name` (string, required): Cluster name (1-63 alphanumeric and hyphens)
- `rg_name` (string, required): Resource group name
- `location` (string, required): Azure region
- `environment` (string, required): Environment (dev/prod/staging)
- `subnet_id` (string, required): AKS subnet ID
- `acr_id` (string, optional): ACR ID for image pull
- `key_vault_id` (string, optional): Key Vault ID for secrets
- `authorized_ip_ranges` (list(string), optional): CIDR blocks allowed to access API
- `tags` (map(string), optional): Tags

**Outputs:**
- `cluster_id`: Cluster resource ID
- `cluster_name`: Cluster name
- `kube_admin_config`: Kubeconfig (sensitive)
- `kubelet_identity`: Kubelet managed identity client ID

**Accessing Cluster:**
```bash
az aks get-credentials --resource-group <rg-name> --name <cluster-name>
kubectl get nodes
kubectl get pods -A
```

**Scaling:**
```bash
# Manual scale
az aks scale --resource-group <rg-name> --name <cluster-name> --node-count 5

# Auto-scale (already enabled)
# Automatically scales between min_count and max_count based on demand
```

---

## Tagging Strategy

All resources are tagged with:

| Tag | Purpose | Example |
|-----|---------|---------|
| Environment | Distinguish dev/prod | dev, prod, staging |
| Project | Resource group | event-driven |
| Managed-By | Infrastructure source | Terraform |
| Cost-Center | Billing and allocation | Engineering |
| Compliance | Regulatory framework | SOC2 |
| Owner | Responsible team | platform-team |
| Backup | Backup requirements | true/false |
| CreatedDate | Timestamp for tracking | auto-generated |

Tags enable:
- Cost analysis and allocation
- Compliance reporting
- Resource lifecycle management
- Automated operations (backups, updates)
- Access control policies

---

## Encryption Strategy

### At Rest
- **Key Vault**: Keys/secrets encrypted with HSM (Premium SKU, prod only)
- **ACR**: Container images encrypted with managed keys
- **AKS**: etcd and persistent volumes encrypted via Azure
- **Managed Disks**: Encrypted with service/customer-managed keys (configurable)

### In Transit
- **TLS 1.2+**: All API calls and communications
- **Pod-to-Pod**: Network Policies enforce encryption requirements
- **Ingress**: TLS termination at load balancer

---

## RBAC & Access Control

### Service Principals & Identities
```bash
# List service principals
az ad sp list --display-name myapp

# Grant permissions
az role assignment create --assignee <object-id> --role "Key Vault Secrets User" --scope <key-vault-id>
```

### Kubernetes RBAC
```bash
# View cluster-admin binding
kubectl get clusterrolebinding cluster-admin -o yaml

# Create custom role
kubectl create role pod-reader --verb=get,list --resource=pods
kubectl create rolebinding read-pods --clusterrole=pod-reader --serviceaccount=default:my-sa
```

---

## Networking Policy

**Default:**
- AKS subnet: 10.0.1.0/24
- Service CIDR: 10.0.0.0/16
- Docker Bridge: 172.17.0.1/16
- DNS: Azure-provided (8.8.8.8 in prod)

**Network Policies (to implement):**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
# Allow specific traffic after setting deny-all
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api
spec:
  podSelector:
    matchLabels:
      tier: api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: web
```

---

## Monitoring & Logging

No Log Analytics configured by default. To enable:

1. **Create Log Analytics Workspace:**
```bash
az monitor log-analytics workspace create \
  --resource-group mygroup \
  --workspace-name myworkspace
```

2. **Update Key Vault diagnostic settings:**
```bash
# Get workspace ID
WORKSPACE_ID=$(az monitor log-analytics workspace show -g mygroup -n myworkspace --query id -o tsv)

# Set diagnostic settings
az monitor diagnostic-settings create \
  --resource <kv-id> \
  --name kv-audit-logs \
  --workspace $WORKSPACE_ID \
  --logs '[{"category": "AuditEvent", "enabled": true}]'
```

3. **Monitor Queries:**
```kusto
AuditEvent
| where TimeGenerated > ago(7d)
| summarize by OperationName, ResultType
```

---

## Disaster Recovery

### State File Backup
```bash
# Backup current state
terraform state pull > terraform.state.backup

# Test restore (in emergency)
terraform state push terraform.state.backup
```

### Cluster Recovery
1. AKS backups are managed by Azure (node OS disks)
2. Persistent data: Implement Azure Backup
3. Application data: Use Key Vault for critical secrets
4. Helm releases: Store in Git, redeploy via GitOps

---

## Cost Optimization

1. **Dev Environment:**
   - Single node (auto-scales to 3 max)
   - Standard D2 VMs
   - Standard Key Vault SKU
   - Minimal monitoring

2. **Production:**
   - 3 nodes minimum (HA)
   - Premium D4 VMs
   - Premium Key Vault SKU
   - Full monitoring and logging

3. **Recommendations:**
   - Spot instances for non-critical workloads
   - Reserved instances for base capacity
   - Close unused resources
   - Review monthly via Azure Cost Management

---

## Troubleshooting

### Module Not Found
```bash
terraform init -upgrade
```

### State Lock
```bash
# Force unlock (emergency only)
terraform force-unlock <lock-id>
```

### Plan Shows Unchanged 
```bash
terraform refresh
terraform plan
```

---

**Last Updated:** 2024  
**Owner:** Platform Team
