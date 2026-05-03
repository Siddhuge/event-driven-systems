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

module "jumpbox" {
  source = "../../modules/jumpbox"

  enabled              = var.jumpbox_enabled
  name                 = "${local.naming_prefix}-jumpbox"
  rg_name              = module.rg.name
  location             = var.location
  subnet_id            = module.network.jumpbox_subnet_id
  admin_username       = var.jumpbox_admin_username
  admin_ssh_public_key = var.jumpbox_admin_ssh_public_key
  allowed_ssh_cidrs    = var.jumpbox_allowed_ssh_cidrs
  vm_size              = var.jumpbox_vm_size
  aks_cluster_name     = module.aks.cluster_name
  aks_cluster_id       = module.aks.cluster_id
  tags                 = local.common_tags

  depends_on = [module.aks]
}

# Grant jumpbox managed identity Reader role at subscription level for Azure CLI auth
resource "azurerm_role_assignment" "jumpbox_reader" {
  count = var.jumpbox_enabled ? 1 : 0

  scope                = "/subscriptions/${data.azurerm_client_config.current.subscription_id}"
  role_definition_name = "Reader"
  principal_id         = module.jumpbox.principal_id
}

# Grant jumpbox managed identity AKS admin role for cluster access
resource "azurerm_role_assignment" "jumpbox_aks_admin" {
  count = var.jumpbox_enabled ? 1 : 0

  scope                = module.aks.cluster_id
  role_definition_name = "Azure Kubernetes Service Cluster Admin Role"
  principal_id         = module.jumpbox.principal_id
}

data "azurerm_client_config" "current" {}
