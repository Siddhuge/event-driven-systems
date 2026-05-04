data "azurerm_client_config" "current" {}

resource "azurerm_kubernetes_cluster" "aks" {
  # checkov:skip=CKV_AZURE_117:Disk Encryption Set requires a separate CMK key-vault/key resource outside this module scope
  # checkov:skip=CKV_AZURE_226:Standard_DS2_v2 (dev node size) has only 14 GB temp storage, which is insufficient for ephemeral OS disks
  # checkov:skip=CKV_AZURE_232:Single node pool design; a dedicated user node pool for workloads is out of scope for this bootstrap module
  # checkov:skip=CKV_AZURE_170:Prod enforces Standard SLA tier via sku_tier; Free tier is intentional for dev to control costs
  # checkov:skip=CKV_AZURE_227:EncryptionAtHost requires Microsoft.Compute/EncryptionAtHost feature registration at subscription level
  name                = var.name
  location            = var.location
  resource_group_name = var.rg_name
  dns_prefix          = replace(var.name, "-", "")
  kubernetes_version  = "1.34"

  # CKV_AZURE_170: prod uses paid Standard SLA tier; dev uses Free to control costs
  sku_tier = var.environment == "prod" ? "Standard" : "Free"

  # CKV_AZURE_171: patch-channel keeps nodes on the latest patch release automatically
  automatic_channel_upgrade = "patch"

  # CKV_AZURE_141: disable local admin account; cluster access is via Azure AD RBAC only
  local_account_disabled = true

  # Security: Keep the API private by default; optional public FQDN still resolves to a private endpoint.
  private_cluster_enabled             = var.private_cluster_enabled
  private_cluster_public_fqdn_enabled = var.private_cluster_public_fqdn_enabled

  default_node_pool {
    name                = "system"
    node_count          = var.environment == "prod" ? 3 : 1
    vm_size             = var.environment == "prod" ? "Standard_D4s_v3" : "Standard_DS2_v2"
    vnet_subnet_id      = var.subnet_id
    max_pods            = 110
    enable_auto_scaling = true
    min_count           = var.environment == "prod" ? 3 : 1
    max_count           = var.environment == "prod" ? 10 : 3

    # Security settings
    os_disk_size_gb             = 50
    os_disk_type                = "Managed"
    enable_host_encryption      = var.enable_host_encryption
    temporary_name_for_rotation = "tmp1"
  }

  # CKV_AZURE_141 prerequisite: Azure AD RBAC must be enabled when local accounts are disabled
  azure_active_directory_role_based_access_control {
    managed                = true  # required in azurerm ~> 3.x to enable admin_group_object_ids; deprecated but not removed until 4.x
    tenant_id              = data.azurerm_client_config.current.tenant_id
    admin_group_object_ids = var.admin_group_object_ids
    azure_rbac_enabled     = true
  }

  # Identity and Access
  identity {
    type = "SystemAssigned"
  }

  # Network security
  network_profile {
    network_plugin    = "azure" # CNI for Azure native networking
    network_policy    = "azure" # Enforces NSG-based policies
    service_cidr      = "10.2.0.0/16"
    dns_service_ip    = "10.2.0.10"
    load_balancer_sku = "standard"
    # prod: route egress through Azure Firewall/NVA via UDR; dev/staging: use managed load balancer
    outbound_type = var.environment == "prod" ? "userDefinedRouting" : "loadBalancer"
  }

  dynamic "api_server_access_profile" {
    for_each = var.private_cluster_enabled || length(var.authorized_ip_ranges) == 0 ? [] : [1]

    content {
      authorized_ip_ranges = var.authorized_ip_ranges
    }
  }

  # RBAC and Azure AD integration
  role_based_access_control_enabled = true

  # Azure Policy for compliance
  azure_policy_enabled = true

  # Enable OIDC issuer + Workload Identity (required for pod-level Azure auth without secrets)
  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  # CKV_AZURE_172: Secrets Store CSI driver with automatic secret rotation
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "2m"
  }

  dynamic "oms_agent" {
    for_each = var.log_analytics_workspace_id != "" ? [1] : []
    content {
      log_analytics_workspace_id = var.log_analytics_workspace_id
    }
  }

  # Cluster tagging
  tags = var.tags

  depends_on = []
}
