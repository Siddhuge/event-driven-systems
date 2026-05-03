# Quick Start: Key Vault + Pipeline Integration

## 1. Store Your SSH Key in Key Vault

```bash
# Get your SSH public key
cat ~/.ssh/id_rsa.pub

# Add to Key Vault
az keyvault secret set \
  --vault-name event-driven-dev-kv \
  --name jumpbox-ssh-public-key \
  --value "ssh-rsa AAAA... (paste your full key)"
```

## 2. Store Your IP/CIDR for SSH Access

```bash
# Find your public IP
curl -s https://checkip.amazonaws.com

# Add to Key Vault (replace with your IP)
az keyvault secret set \
  --vault-name event-driven-dev-kv \
  --name jumpbox-allowed-ssh-cidr \
  --value "203.0.113.45/32"
```

## 3. Verify Secrets Are Set

```bash
az keyvault secret list --vault-name event-driven-dev-kv --query "[].name"
```

Output should show:
```
jumpbox-allowed-ssh-cidr
jumpbox-ssh-public-key
```

## 4. Grant Service Principal Access

```bash
# Get your service principal object ID (ask your Azure admin)
# Format: 00000000-0000-0000-0000-000000000000

# Grant access
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id "<SERVICE_PRINCIPAL_ID>" \
  --scope "/subscriptions/5972c422-e2f7-41f9-ab8e-7ce76db35969/resourceGroups/event-driven-dev-rg/providers/Microsoft.KeyVault/vaults/event-driven-dev-kv"
```

## 5. Update Pipeline Variables

In Azure DevOps > Pipelines > Edit > Variables:

```
azureServiceConnection = IAC-Conn
terraformVersion = 1.5.7
keyVaultName = event-driven-dev-kv
jumpboxEnabledDev = true
jumpboxEnabledProd = false
```

## 6. Run the Pipeline

Push to main branch and the pipeline will:
1. ✅ Fetch secrets from Key Vault
2. ✅ Generate terraform vars securely
3. ✅ Plan and apply infrastructure
4. ✅ Never expose secrets in logs

## Helpful Commands

```bash
# View all secrets in Key Vault
az keyvault secret list --vault-name event-driven-dev-kv

# Get a specific secret value
az keyvault secret show --vault-name event-driven-dev-kv --name jumpbox-ssh-public-key --query value -o tsv

# Update a secret
az keyvault secret set --vault-name event-driven-dev-kv --name <name> --value <new-value>

# Check who has access to Key Vault
az keyvault show --name event-driven-dev-kv --query properties.accessPolicies

# Check service principal permissions
az role assignment list --scope "/subscriptions/.../providers/Microsoft.KeyVault/vaults/event-driven-dev-kv"
```

## Troubleshooting

**"Access denied to Key Vault"**
- Verify service principal has "Key Vault Secrets User" role
- Check Key Vault network rules aren't blocking access
- Wait 1-2 minutes after granting role

**Secrets not working in pipeline**
- Check secret names match (case-sensitive)
- Verify service principal ID is correct
- Review pipeline execution logs

**Need to regenerate SSH key?**
```bash
# Generate new key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa

# Update Key Vault
az keyvault secret set --vault-name event-driven-dev-kv \
  --name jumpbox-ssh-public-key --value "$(cat ~/.ssh/id_rsa.pub)"
```
