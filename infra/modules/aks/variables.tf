variable "name" {
  type        = string
  description = "Name of the AKS cluster"

  validation {
    condition     = length(var.name) >= 1 && length(var.name) <= 63 && can(regex("^[a-zA-Z0-9-]+$", var.name))
    error_message = "AKS cluster name must be 1-63 characters, alphanumeric and hyphens only."
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

variable "subnet_id" {
  type        = string
  description = "Subnet ID for the AKS cluster"
}

variable "acr_id" {
  type        = string
  description = "Azure Container Registry ID for cluster pull access"
  default     = ""
}

variable "key_vault_id" {
  type        = string
  description = "Key Vault ID for secret management"
  default     = ""
}

variable "private_cluster_enabled" {
  type        = bool
  description = "Whether the AKS API server should be private and reachable only through the VNet/private DNS path"
  default     = true
}

variable "private_cluster_public_fqdn_enabled" {
  type        = bool
  description = "Whether a public FQDN should be created for a private AKS cluster"
  default     = false
}

variable "authorized_ip_ranges" {
  type        = list(string)
  description = "Public IP CIDR ranges allowed to access the AKS API server when private_cluster_enabled is false"
  default     = []

  validation {
    condition     = alltrue([for ip in var.authorized_ip_ranges : can(cidrhost(ip, 0))])
    error_message = "All entries must be valid CIDR blocks."
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to AKS cluster"
  default     = {}
}
