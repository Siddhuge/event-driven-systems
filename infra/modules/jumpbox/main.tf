resource "azurerm_public_ip" "jumpbox" {
  count = var.enabled ? 1 : 0

  name                = "${var.name}-pip"
  location            = var.location
  resource_group_name = var.rg_name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

resource "azurerm_network_security_group" "jumpbox" {
  count = var.enabled ? 1 : 0

  name                = "${var.name}-nsg"
  location            = var.location
  resource_group_name = var.rg_name
  tags                = var.tags

  lifecycle {
    precondition {
      condition     = length(var.allowed_ssh_cidrs) > 0
      error_message = "allowed_ssh_cidrs must contain at least one CIDR when the jumpbox is enabled."
    }
  }
}

resource "azurerm_network_security_rule" "ssh" {
  count = var.enabled ? 1 : 0

  name                        = "AllowSSHFromTrustedIPs"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "22"
  source_address_prefixes     = var.allowed_ssh_cidrs
  destination_address_prefix  = "*"
  resource_group_name         = var.rg_name
  network_security_group_name = azurerm_network_security_group.jumpbox[0].name
}

resource "azurerm_network_interface" "jumpbox" {
  count = var.enabled ? 1 : 0

  name                = "${var.name}-nic"
  location            = var.location
  resource_group_name = var.rg_name
  tags                = var.tags

  ip_configuration {
    name                          = "primary"
    subnet_id                     = var.subnet_id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.jumpbox[0].id
  }
}

resource "azurerm_network_interface_security_group_association" "jumpbox" {
  count = var.enabled ? 1 : 0

  network_interface_id      = azurerm_network_interface.jumpbox[0].id
  network_security_group_id = azurerm_network_security_group.jumpbox[0].id
}

resource "azurerm_linux_virtual_machine" "jumpbox" {
  count = var.enabled ? 1 : 0

  name                  = var.name
  location              = var.location
  resource_group_name   = var.rg_name
  size                  = var.vm_size
  admin_username        = var.admin_username
  network_interface_ids = [azurerm_network_interface.jumpbox[0].id]
  tags                  = var.tags

  disable_password_authentication = true

  identity {
    type = "SystemAssigned"
  }

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.admin_ssh_public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }

  custom_data = base64encode(templatefile("${path.module}/cloud-init.yaml", {
    resource_group_name = var.rg_name
    aks_cluster_name    = var.aks_cluster_name
  }))

  lifecycle {
    precondition {
      condition     = can(regex("^ssh-rsa ", var.admin_ssh_public_key))
      error_message = "admin_ssh_public_key must be provided and must start with ssh-rsa when the jumpbox is enabled."
    }
  }
}

resource "azurerm_role_assignment" "aks_user" {
  count = var.enabled ? 1 : 0

  scope                = var.aks_cluster_id
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  principal_id         = azurerm_linux_virtual_machine.jumpbox[0].identity[0].principal_id
}
