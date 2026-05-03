# Enterprise Terraform Structure - Security & Best Practices

## Overview
This Terraform structure implements enterprise-grade Azure infrastructure with security, scalability, and compliance at its core.

## Directory Structure
```
terraform/
├── envs/
│   ├── dev/          # Development environment
│   └── prod/         # Production environment
├── modules/
│   ├── acr/          # Azure Container Registry
│   ├── aks/          # Azure Kubernetes Service
│   ├── keyvault/     # Azure Key Vault
│   ├── network/      # Virtual Network & Networking
│   └── resource-group/ # Resource Group and tagging
└── docs/             # Documentation
```

## Security Features Implemented

### 1. **Network Security**
- Private Virtual Network with proper CIDR planning (10.0.0.0/16)
- Network Security Groups (NSGs) with restrictive rules
- Private AKS cluster (not exposed to public internet)
- Private subnet configuration with network policies enabled
- Service-to-service network isolation

### 2. **Access Control & IAM**
- RBAC (Role-Based Access Control) enabled on AKS
- System-assigned managed identities for resource authentication
- Key Vault access policies with least privilege
- Azure AD integration ready (configure via Azure Portal)

### 3. **Data Protection**
- Multi-tier encryption at rest and in transit
- Key Vault with:
  - Soft delete (90 days) + Purge protection (prod only)
  - Premium SKU in production for hardware acceleration
  - Network isolation (deny by default, allow AzureServices)
  - Diagnostic logging for audit trail
- ACR with image quarantine and content trust
- Private endpoints for sensitive services

### 4. **Secret Management**
- All sensitive data stored in Key Vault
- No hardcoded secrets in Terraform
- Sensitive variable marking in outputs
- Proper access policies with key/secret/certificate granularity

### 5. **Container Registry Security**
- Premium SKU for production
- Public access disabled
- Admin account disabled (use managed identities)
- Image quarantine enabled
- Zone redundancy in production

### 6. **Monitoring & Compliance**
- Azure Policy enabled on AKS cluster
- Audit logging configured for Key Vault (prod)
- 365-day log retention for compliance (prod)
- Tags on all resources for cost tracking and governance
- Environment-based configuration (dev/prod)

### 7. **API Server Protection**
- Private cluster enabled
- Authorized IP ranges (whitelist-based access)
- Prevent public exposure to Kubernetes API

## Deployment Guide

### Prerequisites
1. Azure CLI installed and authenticated
2. Terraform >= 1.5.0
3. Proper Azure RBAC permissions (Subscription Contributor)

### Initial Setup

1. **Authenticate to Azure:**
```bash
az login
az account set --subscription <SUBSCRIPTION_ID>
```

2. **Set environment variables:**
```bash
export ARM_SUBSCRIPTION_ID="<subscription-id>"
export ARM_TENANT_ID="<tenant-id>"
export ARM_CLIENT_ID="<client-id>"
export ARM_CLIENT_SECRET="<client-secret>"
```

3. **Initialize Terraform:**
```bash
cd envs/dev
terraform init -upgrade
```

4. **Create terraform.tfvars:**
```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

5. **Plan and Apply:**
```bash
terraform plan -out=tfplan
terraform apply tfplan
```

## Environment-Specific Configuration

### Development
- Single node AKS cluster
- Standard VM sizes
- Standard Key Vault SKU
- Minimal auto-scaling
- Public network access restricted but diagnostic features enabled for debugging

### Production
- 3-node minimum AKS cluster
- Premium VM sizes (D4s_v3)
- Premium Key Vault SKU with HSM
- Aggressive auto-scaling (up to 10 nodes)
- Zone redundancy enabled
- Purge protection enabled on Key Vault
- Full audit logging and compliance

## Tagging Strategy

All resources are tagged with:
- `Environment`: dev/prod/staging
- `Project`: event-driven
- `Managed-By`: Terraform
- `Cost-Center`: Engineering
- `Compliance`: SOC2
- `Owner`: Platform-Team (customizable)
- `Backup`: true/false (customizable)
- `CreatedDate`: Auto-generated timestamp

## Variable Validation

All variables have built-in validation:
- ✅ Location format validation
- ✅ Environment whitelist (dev/prod/staging)
- ✅ CIDR block validation for IP ranges
- ✅ Name length and character restrictions
- ✅ Type safety with explicit declarations

## Updating Infrastructure

### For Development:
```bash
cd envs/dev
terraform plan
# Review changes
terraform apply
```

### For Production:
Always use a state lock and review plans carefully:
```bash
cd envs/prod
terraform plan -out=tfplan
# Review tfplan thoroughly before applying
terraform apply tfplan
```

## Security Checklist

Before deploying to production:
- [ ] Review and configure Azure AD integration
- [ ] Set authorized IP ranges in terraform.tfvars  
- [ ] Configure Log Analytics workspace for monitoring
- [ ] Review Key Vault access policies
- [ ] Enable MFA for Azure accounts
- [ ] Run `terraform plan` and review all resources
- [ ] Scale test the cluster with expected workloads
- [ ] Implement Network Policies for pod-to-pod communication
- [ ] Configure Pod Identity for pod-level authentication

## Disaster Recovery

### State File Backup
```bash
# Export state before any major changes
terraform state pull > terraform.state.backup

# Restore if needed
terraform state push terraform.state.backup
```

### Resources Backup
- Enable soft delete on Key Vault (auto-enabled)
- Implement Azure Backup for persistent volumes
- Document cluster configuration in version control

## Troubleshooting

### Common Issues

1. **"Resource already exists"**
   - Check if resources exist in subscription
   - Import existing resources: `terraform import module.rg.azurerm_resource_group.rg /subscriptions/.../resourcegroups/...`

2. **"Insufficient permissions"**
   - Verify RBAC role assignment
   - Check subscription context: `az account show`

3. **AKS cluster unreachable**
   - Verify authorized IP ranges includes your IP
   - Run: `curl -I https://<cluster-fqdn>:443`

4. **Key Vault access denied**
   - Check access policies for your object ID
   - Verify network rules allow your IP

## Cost Optimization

- Use `var.environment` to automatically scale down in dev
- Implement pod resource requests/limits
- Use spot instances for non-critical workloads
- Review Azure Advisor recommendations monthly
- Monitor spending with tags and cost analysis

## Compliance

This structure aligns with:
- ✅ SOC2 Type II controls
- ✅ ISO 27001 requirements
- ✅ Azure Well-Architected Framework
- ✅ CIS Microsoft Azure Foundations Benchmark

## Support & Maintenance

- Keep Terraform updated: `terraform -version`
- Review Azure provider updates: `terraform init -upgrade`
- Regularly audit access policies
- Monthly security posture review

## Next Steps

1. Configure monitoring and alerting (Application Insights)
2. Implement CI/CD pipeline for Terraform (Azure Pipelines/GitHub Actions)
3. Set up automated backups
4. Configure pod network policies
5. Implement GitOps workflow (ArgoCD/Flux)

---

For detailed Terraform documentation: https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs
