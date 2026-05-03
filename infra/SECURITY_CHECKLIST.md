# SECURITY CHECKLIST FOR PRODUCTION DEPLOYMENT

## Pre-Deployment Security Review

### Network & Access Control
- [ ] Authorized IP ranges configured for AKS API server
- [ ] Network Security Groups properly configured  
- [ ] Private cluster enabled (by default in prod)
- [ ] VNet has proper CIDR planning (no overlaps with on-prem)
- [ ] Network policies enforced for pod isolation

### IAM & Authentication
- [ ] Azure AD integration configured for AKS
- [ ] Service principals created with minimal permissions
- [ ] Managed identities assigned to cluster
- [ ] RBAC roles reviewed and least-privilege applied
- [ ] Admin kubeconfig restricted and monitored

### Data Security
- [ ] Key Vault soft delete & purge protection enabled
- [ ] Encryption enabled for all PII/sensitive data
- [ ] Database encryption at rest and in transit
- [ ] Key Vault network rules properly configured
- [ ] TLS 1.2+ enforced everywhere

### Container Security
- [ ] Image scanning enabled in ACR
- [ ] Private registry without public access
- [ ] Image pull secrets configured in Kubernetes
- [ ] Container registry access audited
- [ ] Only signed images allowed (if using image signature verification)

### Monitoring & Logging
- [ ] Azure Monitor/Log Analytics configured
- [ ] Key Vault audit logging enabled (365 days retention)
- [ ] Application Insights for app-level monitoring
- [ ] Alerts configured for critical events
- [ ] Logs encrypted and access controlled

### Backup & Disaster Recovery
- [ ] State file backed up securely
- [ ] Cluster backup strategy documented
- [ ] Key Vault recovery procedure tested  
- [ ] RTO/RPO defined and documented
- [ ] Restore procedures tested in dev environment

### Compliance
- [ ] Tags applied to all resources
- [ ] Cost budgets and alerts set
- [ ] Compliance policy assessment completed
- [ ] SOC2/ISO27001 requirements reviewed
- [ ] Audit trail accessible and protected

### Infrastructure
- [ ] Load balancer for HA configured
- [ ] Zone redundancy enabled (prod)
- [ ] Database backups configured
- [ ] Network timeouts and retries tuned
- [ ] Resource quotas appropriate for workload

### Documentation
- [ ] Runbooks written for common operations
- [ ] Incident response plan documented
- [ ] Access procedures documented
- [ ] Change management process defined
- [ ] DRP (Disaster Recovery Plan) written

### Cost Management
- [ ] Budget alerts configured
- [ ] Auto-scaling policies tested
- [ ] Reserved instances considered
- [ ] Spot instances evaluated for appropriate workloads
- [ ] Monthly cost reviews scheduled

## Deployment Steps

```bash
# 1. Validate configuration
cd envs/prod
terraform validate
terraform fmt -check -recursive ../

# 2. Plan deployment
terraform plan -out=tfplan

# 3. Code review
cat tfplan | grep -E "^(module|resource)" | head -20
# Review all planned resource creation/modification

# 4. Apply with state locking
terraform apply tfplan

# 5. Post-deployment validation
az aks get-credentials --resource-group event-driven-prod-rg --name event-driven-prod-aks
kubectl get nodes
kubectl get pods -A

# 6. Verify security settings
az keyvault show --name event-driven-prod-kv --query "properties.networkAcls"
az container registry show --resource-group event-driven-prod-rg --name eventdrivenproducr
```

## Ongoing Security Tasks

### Weekly
- Review access logs and alerts
- Check resource health in Azure Portal
- Verify backup success

### Monthly  
- Review IAM permissions and remove unnecessary access
- Analyze cost and adjust resources if needed
- Review security patches and OS updates

### Quarterly
- Penetration testing / security audit
- Disaster recovery drill
- Compliance certification review

### Annually
- Full security assessment
- Architecture review
- SOC2/compliance audit

## Emergency Contacts

```
Platform Team Lead: [Name]
DBA Owner: [Name]
Security Officer: [Name]
On-Call Rotation: [Link to on-call schedule]
```

## Useful Commands

```bash
# Get kubeconfig
az aks get-credentials --resource-group event-driven-prod-rg --name event-driven-prod-aks --admin

# Check Key Vault access
az keyvault secret list --vault-name event-driven-prod-kv

# View cluster logs
az aks show-credentials --resource-group event-driven-prod-rg --name event-driven-prod-aks

# Scale cluster
kubectl scale deployment app-name --replicas=3 -n prod

# Check resource usage
kubectl top nodes
kubectl top pods -A
```

---
Last Updated: [Date]
Reviewed By: [Name]
