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
  default     = "prod"

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
  description = "Public IP CIDR ranges allowed to access the prod AKS API server when private access is disabled"
  default     = []

  validation {
    condition     = alltrue([for ip in var.aks_authorized_ips : can(cidrhost(ip, 0))])
    error_message = "All entries must be valid CIDR blocks."
  }
}

variable "aks_private_cluster_enabled" {
  type        = bool
  description = "Whether the prod AKS API server should be private"
  default     = true
}

variable "aks_private_cluster_public_fqdn_enabled" {
  type        = bool
  description = "Whether a public DNS name should resolve to the private AKS API endpoint. Network access still requires VPN/peering/private routing."
  default     = false
}

variable "key_vault_public_network_access_enabled" {
  type        = bool
  description = "Whether public network access is enabled for prod Key Vault"
  default     = false
}

variable "key_vault_network_acls_default_action" {
  type        = string
  description = "Default firewall action for prod Key Vault"
  default     = "Deny"

  validation {
    condition     = contains(["Allow", "Deny"], var.key_vault_network_acls_default_action)
    error_message = "Key Vault network ACL default action must be Allow or Deny."
  }
}

variable "key_vault_network_acls_bypass" {
  type        = string
  description = "Traffic bypass setting for prod Key Vault network ACLs"
  default     = "AzureServices"

  validation {
    condition     = contains(["AzureServices", "None"], var.key_vault_network_acls_bypass)
    error_message = "Key Vault network ACL bypass must be AzureServices or None."
  }
}

variable "key_vault_secrets" {
  type = map(object({
    value           = string
    content_type    = optional(string)
    expiration_date = optional(string)
    not_before_date = optional(string)
    tags            = optional(map(string), {})
  }))
  description = "Secrets to create in prod Key Vault"
  default     = {}
  sensitive   = true
}
