# Azure Key Vault Secrets With Terraform

This repo creates Azure Key Vault secrets with Terraform during environment launch.
That avoids the first-deployment problem where Azure Pipelines tries to read secrets
from a Key Vault that Terraform has not created yet.

## How It Works

The `modules/keyvault` module accepts a `secrets` map and creates one
`azurerm_key_vault_secret` per entry:

```hcl
key_vault_secrets = {
  jumpbox-ssh-public-key = {
    value        = "ssh-rsa AAAA..."
    content_type = "text/plain"
  }
  jumpbox-allowed-ssh-cidr = {
    value        = "203.0.113.45/32"
    content_type = "text/plain"
  }
}
```

Secret values should come from local ignored `terraform.tfvars`, `TF_VAR_key_vault_secrets`,
or Azure DevOps secret variables. Do not commit real secret values.

## Azure Pipelines

The pipeline writes a temporary `pipeline.auto.tfvars` file in the Terraform working
directory. For dev, set these variables in Azure DevOps:

```text
jumpboxEnabledDev=true
jumpboxSshPublicKeyDev=<your RSA public key>
jumpboxAllowedSshCidrDev=<your public IP>/32
```

Mark `jumpboxSshPublicKeyDev` and any future secret values as secret variables in
Azure DevOps. Terraform then creates these Key Vault secrets:

```text
jumpbox-ssh-public-key
jumpbox-allowed-ssh-cidr
```

## Network Access Note

Terraform creates Key Vault secrets through the Key Vault data plane. The machine
running Terraform must be able to reach the vault.

For dev, this repo defaults to:

```hcl
key_vault_public_network_access_enabled = true
key_vault_network_acls_default_action   = "Allow"
```

That makes first launch work from Microsoft-hosted Azure DevOps agents. For tighter
security, run Terraform from a private self-hosted agent or lock the Key Vault down
after initial creation.

Prod defaults remain locked down:

```hcl
key_vault_public_network_access_enabled = false
key_vault_network_acls_default_action   = "Deny"
```

If prod secrets must be created from a hosted pipeline agent, temporarily override
those values or use a self-hosted agent with private network access.

## Verify Secrets

```bash
az keyvault secret list \
  --vault-name event-driven-dev-kv \
  --query "[].name"
```

Expected dev secrets when jumpbox values are supplied:

```text
jumpbox-ssh-public-key
jumpbox-allowed-ssh-cidr
```
