#!/usr/bin/env bash
# Seed runtime secrets into an Azure Key Vault.
# Idempotent: re-running overwrites rabbitmq-url and redis-url (safe to update),
# but only creates jwt-secret if it does not already exist (rotation would break live sessions).
#
# Required:
#   KEYVAULT_NAME       - name of the target Key Vault
#   RABBITMQ_URL        - amqp:// connection string
#   REDIS_URL           - redis:// connection string
#
# Optional:
#   NAMESPACE           - Kubernetes namespace (default: event-driven)
set -euo pipefail

: "${KEYVAULT_NAME:?KEYVAULT_NAME is required}"
: "${RABBITMQ_URL:?RABBITMQ_URL is required}"
: "${REDIS_URL:?REDIS_URL is required}"

echo "🔑 Seeding Key Vault: $KEYVAULT_NAME"

az keyvault secret set \
  --vault-name "$KEYVAULT_NAME" \
  --name rabbitmq-url \
  --value "$RABBITMQ_URL" \
  --output none
echo "  ✅ rabbitmq-url set"

az keyvault secret set \
  --vault-name "$KEYVAULT_NAME" \
  --name redis-url \
  --value "$REDIS_URL" \
  --output none
echo "  ✅ redis-url set"

# Only create jwt-secret if it doesn't exist — never overwrite
if az keyvault secret show --vault-name "$KEYVAULT_NAME" --name jwt-secret --query name -o tsv &>/dev/null; then
  echo "  ✅ jwt-secret already exists — skipped"
else
  JWT_SECRET=$(openssl rand -hex 32)
  az keyvault secret set \
    --vault-name "$KEYVAULT_NAME" \
    --name jwt-secret \
    --value "$JWT_SECRET" \
    --output none
  echo "  ✅ jwt-secret created"
fi

echo "✅ Key Vault secrets ready"
