# Deployment Steps

## Prerequisites

```bash
az login
az account set --subscription <YOUR_SUBSCRIPTION_ID>
az extension add --name aks-preview
```

---

## Step 1 — Azure DevOps Setup (one-time)

1. Create service connection named **`IAC-Conn`** (Azure Resource Manager, federated credential / OIDC) under **Project Settings → Service Connections**
2. Create service connection named **`ACR-Connection`** (Docker Registry → Azure Container Registry)
3. Create variable group named **`event-driven-azure-dev`** with these variables:

   | Variable | Example |
   |----------|---------|
   | `acrName` | `eventdrivendevacr` |
   | `azureResourceGroup` | `event-driven-dev-rg` |
   | `aksClusterName` | `event-driven-dev-aks` |
   | `kafkaBroker` | `kafka.event-driven.svc.cluster.local:29092` |
   | `keyVaultName` | `event-driven-dev-kv` |

4. Create environments named **`dev`** and **`prod`** under **Pipelines → Environments** (add approvals to `prod`)

---

## Step 2 — Terraform Remote State Storage

```bash
az group create -n Optum-POC -l "Central India"
az storage account create -n optumaiapp -g Optum-POC --sku Standard_LRS
az storage container create -n tfstate --account-name optumaiapp
```

---

## Step 3 — Register Infrastructure Pipeline

In Azure DevOps → **Pipelines → New Pipeline** → point to `infra/azure-pipelines.yml`

Pipeline stages: **Security Scan → DEV Plan → DEV Apply → Manual Approval → PROD Plan → PROD Apply**

---

## Step 4 — Populate Key Vault Secrets (after infra deploy)

```bash
KV=event-driven-dev-kv

az keyvault secret set --vault-name $KV --name rabbitmq-url \
  --value "amqp://user:pass@<host>:5672"

az keyvault secret set --vault-name $KV --name redis-url \
  --value "redis://<host>:6379"

az keyvault secret set --vault-name $KV --name jwt-secret \
  --value "$(openssl rand -hex 32)"
```

---

## Step 5 — Register App Pipeline

In Azure DevOps → **Pipelines → New Pipeline** → point to `app/azure-pipelines-app.yml`

Pipeline stages: **Tests → Security Scan → Build & Push → Image Scan → Manual Approval → Deploy to AKS**

---

## Step 6 — Verify Deployment

```bash
az aks get-credentials -g event-driven-dev-rg -n event-driven-dev-aks

kubectl get pods -n event-driven
kubectl get hpa  -n event-driven
```
