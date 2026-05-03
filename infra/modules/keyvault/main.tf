data "azurerm_client_config" "current" {}

locals {
  secret_names = toset(nonsensitive(keys(var.secrets)))
  secret_tags = {
    for name, secret in var.secrets :
    name => merge(var.tags, secret.tags)
  }
}

resource "azurerm_key_vault" "kv" {
  name                = var.name
  location            = var.location
  resource_group_name = var.rg_name
  tenant_id           = var.tenant_id
  sku_name            = var.environment == "prod" ? "premium" : "standard"

  # Security and compliance
  enabled_for_deployment          = true
  enabled_for_disk_encryption     = true
  enabled_for_template_deployment = true

  purge_protection_enabled   = var.environment == "prod" ? true : false
  soft_delete_retention_days = 90

  # Network security
  public_network_access_enabled = var.public_network_access_enabled
  network_acls {
    default_action = var.network_acls_default_action
    bypass         = var.network_acls_bypass
  }

  # Logging and audit
  access_policy {
    tenant_id = var.tenant_id
    object_id = var.object_id

    key_permissions = [
      "Create", "Delete", "Get", "List", "Restore", "Recover",
      "Update", "WrapKey", "UnwrapKey", "Sign", "Verify"
    ]

    secret_permissions = [
      "Set", "Get", "Delete", "List", "Recover", "Restore"
    ]

    certificate_permissions = [
      "Create", "Delete", "Get", "List", "Recover", "Restore",
      "Update", "Import"
    ]
  }

  tags = var.tags
}

resource "azurerm_key_vault_secret" "secrets" {
  for_each = local.secret_names

  name            = each.value
  value           = var.secrets[each.value].value
  key_vault_id    = azurerm_key_vault.kv.id
  content_type    = var.secrets[each.value].content_type
  expiration_date = var.secrets[each.value].expiration_date
  not_before_date = var.secrets[each.value].not_before_date
  tags            = local.secret_tags[each.value]

  depends_on = [
    azurerm_key_vault.kv
  ]
}
