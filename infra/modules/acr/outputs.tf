output "login_server" {
  value       = azurerm_container_registry.acr.login_server
  description = "ACR login server URL"
  sensitive   = false
}

output "id" {
  value       = azurerm_container_registry.acr.id
  description = "Azure Container Registry resource ID"
}

output "registry_name" {
  value       = azurerm_container_registry.acr.name
  description = "Name of the container registry"
}