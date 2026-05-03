output "subnet_id" {
  value       = azurerm_subnet.aks.id
  description = "ID of the AKS subnet"
}

output "jumpbox_subnet_id" {
  value       = azurerm_subnet.jumpbox.id
  description = "ID of the jumpbox subnet"
}

output "vnet_id" {
  value       = azurerm_virtual_network.vnet.id
  description = "ID of the virtual network"
}

output "vnet_name" {
  value       = azurerm_virtual_network.vnet.name
  description = "Name of the virtual network"
}
