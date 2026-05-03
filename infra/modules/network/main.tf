# Virtual Network with proper CIDR planning
resource "azurerm_virtual_network" "vnet" {
  name                = var.name
  address_space       = ["10.0.0.0/16"]
  location            = var.location
  resource_group_name = var.rg_name
  dns_servers         = var.environment == "prod" ? ["8.8.8.8", "8.8.4.4"] : []
  tags                = var.tags
}

# AKS Subnet
resource "azurerm_subnet" "aks" {
  name                 = "aks-subnet"
  resource_group_name  = var.rg_name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]

  private_endpoint_network_policies             = "Disabled"
  private_link_service_network_policies_enabled = false
}

# Jumpbox Subnet
resource "azurerm_subnet" "jumpbox" {
  name                 = "jumpbox-subnet"
  resource_group_name  = var.rg_name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.2.0/24"]
}

# Network Security Group for AKS
resource "azurerm_network_security_group" "aks_nsg" {
  name                = "${var.name}-aks-nsg"
  location            = var.location
  resource_group_name = var.rg_name
  tags                = var.tags
}

# Allow ingress on required ports
resource "azurerm_network_security_rule" "allow_https" {
  name                        = "AllowHTTPS"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "443"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = var.rg_name
  network_security_group_name = azurerm_network_security_group.aks_nsg.name
}

# Associate NSG with subnet
resource "azurerm_subnet_network_security_group_association" "aks" {
  subnet_id                 = azurerm_subnet.aks.id
  network_security_group_id = azurerm_network_security_group.aks_nsg.id
}

# Route Table for AKS Subnet
resource "azurerm_route_table" "aks" {
  name                          = "${var.name}-aks-rt"
  location                      = var.location
  resource_group_name           = var.rg_name
  disable_bgp_route_propagation = false
  tags                          = var.tags
}

# Associate Route Table with AKS Subnet
resource "azurerm_subnet_route_table_association" "aks" {
  subnet_id      = azurerm_subnet.aks.id
  route_table_id = azurerm_route_table.aks.id
}
