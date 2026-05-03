output "workspace_id" {
  value       = azurerm_log_analytics_workspace.this.id
  description = "Resource ID of the Log Analytics workspace (used by AKS OMS agent)"
}

output "workspace_customer_id" {
  value       = azurerm_log_analytics_workspace.this.workspace_id
  description = "Workspace GUID (customer ID) used for direct API queries"
}

output "workspace_key" {
  value       = azurerm_log_analytics_workspace.this.primary_shared_key
  description = "Primary shared key for the workspace"
  sensitive   = true
}

output "name" {
  value       = azurerm_log_analytics_workspace.this.name
  description = "Name of the Log Analytics workspace"
}
