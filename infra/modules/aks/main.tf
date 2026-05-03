resource "azurerm_kubernetes_cluster" "aks" {
  name                = var.name
  location            = var.location
  resource_group_name = var.rg_name
  dns_prefix          = replace(var.name, "-", "")
  kubernetes_version  = "1.34"

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
    temporary_name_for_rotation = "tmp1" # Must be 1-12 lowercase alphanumeric chars only
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
    outbound_type     = "userDefinedRouting"
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

  # Enable OIDC issuer (required for Workload Identity)
  oidc_issuer_enabled = true

  # OMS agent for monitoring (optional, requires log_analytics_workspace_id)
  # Uncomment and set log_analytics_workspace_id to enable
  # oms_agent {
  #   log_analytics_workspace_id = var.log_analytics_workspace_id
  # }

  # Cluster tagging
  tags = var.tags

  depends_on = []
}
