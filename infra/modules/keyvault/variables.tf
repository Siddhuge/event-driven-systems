variable "name" {
  type        = string
  description = "Name of the Key Vault (must be globally unique, 3-24 alphanumeric and hyphens)"

  validation {
    condition     = length(var.name) >= 3 && length(var.name) <= 24 && can(regex("^[a-zA-Z0-9-]+$", var.name))
    error_message = "Key Vault name must be 3-24 characters, alphanumeric and hyphens only."
  }
}

variable "rg_name" {
  type        = string
  description = "Name of the resource group"
}

variable "location" {
  type        = string
  description = "Azure region"
}

variable "environment" {
  type        = string
  description = "Environment name (dev, prod, staging)"

  validation {
    condition     = contains(["dev", "prod", "staging"], var.environment)
    error_message = "Environment must be dev, prod, or staging."
  }
}

variable "tenant_id" {
  type        = string
  description = "Azure Tenant ID"
  sensitive   = true
}

variable "object_id" {
  type        = string
  description = "Object ID of the principal (user or service principal)"
  sensitive   = true
}

variable "public_network_access_enabled" {
  type        = bool
  description = "Whether public network access is enabled for Key Vault. Terraform runners must be able to reach the data plane to create secrets."
  default     = true
}

variable "network_acls_default_action" {
  type        = string
  description = "Default Key Vault firewall action"
  default     = "Allow"

  validation {
    condition     = contains(["Allow", "Deny"], var.network_acls_default_action)
    error_message = "Network ACL default action must be Allow or Deny."
  }
}

variable "network_acls_bypass" {
  type        = string
  description = "Traffic bypass setting for Key Vault network ACLs"
  default     = "AzureServices"

  validation {
    condition     = contains(["AzureServices", "None"], var.network_acls_bypass)
    error_message = "Network ACL bypass must be AzureServices or None."
  }
}

variable "secrets" {
  type = map(object({
    value           = string
    content_type    = optional(string)
    expiration_date = optional(string)
    not_before_date = optional(string)
    tags            = optional(map(string), {})
  }))
  description = "Secrets to create in Key Vault. Values should be supplied through tfvars, pipeline secret variables, or TF_VAR_key_vault_secrets."
  default     = {}
  sensitive   = true
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to Key Vault"
  default     = {}
}
