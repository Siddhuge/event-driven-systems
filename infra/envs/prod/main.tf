locals {
  common_tags = merge(
    var.tags,
    {
      "Environment" = var.environment
      "Project"     = var.project_name
      "CreatedDate" = var.created_date
    }
  )
  naming_prefix = "${var.project_name}-${var.environment}"
}

module "rg" {
  source      = "../../modules/resource-group"
  name        = "${local.naming_prefix}-rg"
  location    = var.location
  tags        = local.common_tags
  environment = var.environment
}

module "network" {
  source      = "../../modules/network"
  name        = "${local.naming_prefix}-vnet"
  location    = var.location
  rg_name     = module.rg.name
  tags        = local.common_tags
  environment = var.environment
}

module "acr" {
  source      = "../../modules/acr"
  name        = "${replace(local.naming_prefix, "-", "")}acr"
  rg_name     = module.rg.name
  location    = var.location
  tags        = local.common_tags
  environment = var.environment
  subnet_id   = module.network.subnet_id
}

module "kv" {
  source                        = "../../modules/keyvault"
  name                          = "${local.naming_prefix}-kv"
  rg_name                       = module.rg.name
  location                      = var.location
  tags                          = local.common_tags
  environment                   = var.environment
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  object_id                     = data.azurerm_client_config.current.object_id
  public_network_access_enabled = var.key_vault_public_network_access_enabled
  network_acls_default_action   = var.key_vault_network_acls_default_action
  network_acls_bypass           = var.key_vault_network_acls_bypass
  secrets                       = var.key_vault_secrets
}

module "aks" {
  source                              = "../../modules/aks"
  name                                = "${local.naming_prefix}-aks"
  rg_name                             = module.rg.name
  location                            = var.location
  tags                                = local.common_tags
  environment                         = var.environment
  subnet_id                           = module.network.subnet_id
  acr_id                              = module.acr.id
  key_vault_id                        = module.kv.id
  authorized_ip_ranges                = var.aks_authorized_ips
  private_cluster_enabled             = var.aks_private_cluster_enabled
  private_cluster_public_fqdn_enabled = var.aks_private_cluster_public_fqdn_enabled

  depends_on = [module.network]
}

data "azurerm_client_config" "current" {}
