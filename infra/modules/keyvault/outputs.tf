output "id" {
  value       = azurerm_key_vault.kv.id
  description = "Key Vault resource ID"
}

output "vault_uri" {
  value       = azurerm_key_vault.kv.vault_uri
  description = "Key Vault URI for accessing secrets and keys"
  sensitive   = false
}

output "name" {
  value       = azurerm_key_vault.kv.name
  description = "Name of the Key Vault"
}

output "secret_ids" {
  value       = { for name, secret in azurerm_key_vault_secret.secrets : name => secret.id }
  description = "IDs of secrets created in Key Vault"
  sensitive   = true
}

output "secret_names" {
  value       = keys(azurerm_key_vault_secret.secrets)
  description = "Names of secrets created in Key Vault"
}
