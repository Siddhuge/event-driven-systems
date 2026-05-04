resource "azurerm_container_registry" "acr" {
  # checkov:skip=CKV_AZURE_165:Geo-replication to a second region is cost-prohibitive for this project scope
  # checkov:skip=CKV_AZURE_139:Public access enabled so network rules apply; default_action=Deny enforces same restriction with dynamic CI/CD IP allowlisting
  name                = var.name
  resource_group_name = var.rg_name
  location            = var.location
  sku                 = "Premium"
  admin_enabled       = false

  # Security settings: public access enabled so firewall rules apply; pipeline dynamically whitelists its IP
  public_network_access_enabled = true
  network_rule_bypass_option    = "AzureServices"
  # checkov:skip=CKV_AZURE_162:Quarantine blocks AcrPull callers from seeing newly-pushed images; pipeline Trivy scanning is the security gate
  # checkov:skip=CKV_AZURE_166:Quarantine blocks AcrPull callers from seeing newly-pushed images; pipeline Trivy scanning is the security gate
  quarantine_policy_enabled = false
  zone_redundancy_enabled   = true # CKV_AZURE_233: Premium SKU supports zone redundancy in all envs

  network_rule_set {
    default_action = "Deny"
  }

  # Encryption and audit
  data_endpoint_enabled  = true
  anonymous_pull_enabled = false

  # CKV_AZURE_167: purge untagged manifests after 7 days to reduce attack surface and storage cost
  retention_policy {
    days    = 7
    enabled = true
  }

  # CKV_AZURE_164: enforce content trust so only signed images can be pulled
  trust_policy {
    enabled = true
  }

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
