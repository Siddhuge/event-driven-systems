output "resource_group_name" {
  value       = module.rg.name
  description = "Name of the resource group"
}

output "resource_group_id" {
  value       = module.rg.id
  description = "ID of the resource group"
}

output "acr_login_server" {
  value       = module.acr.login_server
  description = "ACR login server URL"
  sensitive   = false
}

output "acr_id" {
  value       = module.acr.id
  description = "Azure Container Registry ID"
  sensitive   = false
}

output "aks_cluster_name" {
  value       = module.aks.cluster_name
  description = "AKS cluster name"
}

output "aks_cluster_id" {
  value       = module.aks.cluster_id
  description = "AKS cluster ID"
}

output "key_vault_id" {
  value       = module.kv.id
  description = "Key Vault resource ID"
  sensitive   = false
}

output "key_vault_uri" {
  value       = module.kv.vault_uri
  description = "Key Vault URI for accessing secrets"
  sensitive   = false
}

output "key_vault_secret_names" {
  value       = module.kv.secret_names
  description = "Names of secrets created in Key Vault"
}

output "vnet_id" {
  value       = module.network.vnet_id
  description = "Virtual Network ID"
}

output "jumpbox_public_ip" {
  value       = module.jumpbox.public_ip_address
  description = "Public IP address of the dev jumpbox"
}

output "jumpbox_ssh_command" {
  value       = module.jumpbox.ssh_command
  description = "SSH command for the dev jumpbox"
}

output "environment" {
  value       = var.environment
  description = "Deployment environment"
}
