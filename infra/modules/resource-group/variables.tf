variable "name" {
  type        = string
  description = "Name of the resource group"

  validation {
    condition     = length(var.name) <= 90 && can(regex("^[a-zA-Z0-9._()-]+$", var.name))
    error_message = "Resource group name must be 1-90 characters and contain only alphanumeric, dot, underscore, hyphen, and parentheses."
  }
}

variable "location" {
  type        = string
  description = "Azure region for the resource group"

  validation {
    condition     = can(regex("^[a-zA-Z\\s]+$", var.location))
    error_message = "Location must be a valid Azure region name."
  }
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
  description = "Tags to apply to the resource group"
  default     = {}
}