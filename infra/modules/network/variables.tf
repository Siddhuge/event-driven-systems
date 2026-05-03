variable "name" {
  type        = string
  description = "Name of the virtual network"

  validation {
    condition     = length(var.name) <= 64 && can(regex("^[a-zA-Z0-9._-]+$", var.name))
    error_message = "Virtual network name must be 2-64 characters and contain only alphanumeric, dot, underscore, and hyphen."
  }
}

variable "location" {
  type        = string
  description = "Azure region for the virtual network"
}

variable "rg_name" {
  type        = string
  description = "Name of the resource group"
}

variable "environment" {
  type        = string
  description = "Environment name (dev, prod, staging)"

  validation {
    condition     = contains(["dev", "prod", "staging"], var.environment)
    error_message = "Environment must be dev, prod, or staging."
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to the virtual network"
  default     = {}
}