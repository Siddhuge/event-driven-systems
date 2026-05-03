output "public_ip_address" {
  value       = try(azurerm_public_ip.jumpbox[0].ip_address, null)
  description = "Public IP address of the jumpbox"
}

output "private_ip_address" {
  value       = try(azurerm_network_interface.jumpbox[0].private_ip_address, null)
  description = "Private IP address of the jumpbox"
}

output "ssh_command" {
  value       = var.enabled ? "ssh ${var.admin_username}@${azurerm_public_ip.jumpbox[0].ip_address}" : null
  description = "SSH command for the jumpbox"
}

output "principal_id" {
  value       = try(azurerm_linux_virtual_machine.jumpbox[0].identity[0].principal_id, null)
  description = "Managed identity principal ID of the jumpbox VM"
}
