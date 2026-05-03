resource "azurerm_container_registry" "acr" {
  name                = var.name
  resource_group_name = var.rg_name
  location            = var.location
  sku                 = "Premium"
  admin_enabled       = false

  # Security settings
  public_network_access_enabled = false # Disable public access
  quarantine_policy_enabled     = true  # Enable image quarantine
  zone_redundancy_enabled       = var.environment == "prod" ? true : false

  # Encryption and audit
  data_endpoint_enabled = true

  anonymous_pull_enabled = false

  tags = var.tags

  depends_on = []
}

# Enable trust and security scanning in prod
resource "azurerm_container_registry_scope_map" "enterprise" {
  count                   = var.environment == "prod" ? 1 : 0
  name                    = "enterprise-scope"
  container_registry_name = azurerm_container_registry.acr.name
  resource_group_name     = var.rg_name
  actions = [
    "repositories/read",
    "repositories/write",
  ]
}