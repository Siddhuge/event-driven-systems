variable "name" {
  type        = string
  description = "Name of the Azure Container Registry (must be globally unique, alphanumeric only)"

  validation {
    condition     = length(var.name) >= 5 && length(var.name) <= 50 && can(regex("^[a-z0-9]+$", var.name))
    error_message = "ACR name must be 5-50 lowercase alphanumeric characters."
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
  description = "Subnet ID for private endpoint (optional)"
  default     = ""
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to ACR"
  default     = {}
}