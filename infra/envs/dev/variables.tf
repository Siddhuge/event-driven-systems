variable "location" {
  type        = string
  description = "Azure region for resource deployment"
  default     = "Central India"

  validation {
    condition     = can(regex("^[a-zA-Z\\s]+$", var.location))
    error_message = "Location must be a valid Azure region name."
  }
}

variable "environment" {
  type        = string
  description = "Environment name (dev, prod, staging)"
  default     = "dev"

  validation {
    condition     = contains(["dev", "prod", "staging"], var.environment)
    error_message = "Environment must be dev, prod, or staging."
  }
}

variable "project_name" {
  type        = string
  description = "Project name for resource naming and tagging"
  default     = "event-driven"

  validation {
    condition     = length(var.project_name) <= 20 && can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must be lowercase alphanumeric with hyphens, max 20 chars."
  }
}

variable "created_date" {
  type        = string
  description = "Stable creation date tag value applied to Terraform-managed resources"
  default     = "2026-04-29"

  validation {
    condition     = can(regex("^\\d{4}-\\d{2}-\\d{2}$", var.created_date))
    error_message = "Created date must use YYYY-MM-DD format."
  }
}

variable "tags" {
  type        = map(string)
  description = "Common tags to apply to all resources"
  default = {
    "Managed-By"  = "Terraform",
    "Cost-Center" = "Engineering",
    "Compliance"  = "SOC2"
  }
}

variable "aks_authorized_ips" {
  type        = list(string)
  description = "Public IP CIDR ranges allowed to access the dev AKS API server only when private access is disabled"
  default     = ["106.213.87.215/32"]

  validation {
    condition     = alltrue([for ip in var.aks_authorized_ips : can(cidrhost(ip, 0))])
    error_message = "All entries must be valid CIDR blocks."
  }
}

variable "aks_private_cluster_enabled" {
  type        = bool
  description = "Whether the dev AKS API server should be private"
  default     = true
}

variable "aks_private_cluster_public_fqdn_enabled" {
  type        = bool
  description = "Whether a public DNS name should resolve to the private AKS API endpoint. Network access still requires VPN/peering/private routing."
  default     = true
}

variable "aks_admin_group_object_ids" {
  type        = list(string)
  description = "Azure AD group object IDs granted cluster admin access"
  default     = ["bc40bcb6-2e7e-42d2-9608-832ed4692f92"]
}

variable "jumpbox_enabled" {
  type        = bool
  description = "Whether to create a dev jumpbox in the AKS VNet"
  default     = false
}

variable "jumpbox_admin_username" {
  type        = string
  description = "Admin username for the jumpbox VM"
  default     = "azureuser"
}

variable "jumpbox_admin_ssh_public_key" {
  type        = string
  description = "SSH public key allowed to log in to the jumpbox. Set via pipeline variable or local tfvars — never commit a real key."
  default     = ""
  validation {
    condition     = var.jumpbox_admin_ssh_public_key == "" || can(regex("^ssh-rsa ", var.jumpbox_admin_ssh_public_key))
    error_message = "jumpbox_admin_ssh_public_key must start with ssh-rsa."
  }
}

variable "jumpbox_allowed_ssh_cidrs" {
  type        = list(string)
  description = "CIDR ranges allowed to SSH to the jumpbox"
  default     = ["106.213.87.215/32"]

  validation {
    condition     = alltrue([for cidr in var.jumpbox_allowed_ssh_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All jumpbox SSH source ranges must be valid CIDR blocks."
  }
}

variable "jumpbox_vm_size" {
  type        = string
  description = "Azure VM size for the jumpbox"
  default     = "Standard_B2s"
}

variable "key_vault_public_network_access_enabled" {
  type        = bool
  description = "Whether public network access is enabled for dev Key Vault. Keep enabled when Azure Pipelines must create secrets during first launch."
  default     = true
}

variable "key_vault_network_acls_default_action" {
  type        = string
  description = "Default firewall action for dev Key Vault"
  default     = "Allow"

  validation {
    condition     = contains(["Allow", "Deny"], var.key_vault_network_acls_default_action)
    error_message = "Key Vault network ACL default action must be Allow or Deny."
  }
}

variable "key_vault_network_acls_bypass" {
  type        = string
  description = "Traffic bypass setting for dev Key Vault network ACLs"
  default     = "AzureServices"

  validation {
    condition     = contains(["AzureServices", "None"], var.key_vault_network_acls_bypass)
    error_message = "Key Vault network ACL bypass must be AzureServices or None."
  }
}

variable "log_analytics_retention_days" {
  type        = number
  description = "Number of days to retain logs in the dev Log Analytics workspace"
  default     = 30

  validation {
    condition     = var.log_analytics_retention_days >= 30 && var.log_analytics_retention_days <= 730
    error_message = "Retention must be between 30 and 730 days."
  }
}

variable "log_analytics_daily_quota_gb" {
  type        = number
  description = "Daily ingestion cap in GB for the dev workspace. Keeps dev costs bounded."
  default     = 1
}

variable "key_vault_secrets" {
  type = map(object({
    value           = string
    content_type    = optional(string)
    expiration_date = optional(string)
    not_before_date = optional(string)
    tags            = optional(map(string), {})
  }))
  description = "Secrets to create in dev Key Vault"
  default     = {}
  sensitive   = true
}
