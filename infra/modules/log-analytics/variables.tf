variable "name" {
  type        = string
  description = "Name of the Log Analytics workspace"

  validation {
    condition     = length(var.name) >= 4 && length(var.name) <= 63 && can(regex("^[a-zA-Z0-9-]+$", var.name))
    error_message = "Workspace name must be 4-63 characters, alphanumeric and hyphens only."
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

variable "sku" {
  type        = string
  description = "SKU of the Log Analytics workspace"
  default     = "PerGB2018"

  validation {
    condition     = contains(["Free", "PerGB2018", "CapacityReservation"], var.sku)
    error_message = "SKU must be Free, PerGB2018, or CapacityReservation."
  }
}

variable "retention_in_days" {
  type        = number
  description = "Number of days to retain log data (30-730)"
  default     = 30

  validation {
    condition     = var.retention_in_days >= 30 && var.retention_in_days <= 730
    error_message = "Retention must be between 30 and 730 days."
  }
}

variable "daily_quota_gb" {
  type        = number
  description = "Daily ingestion cap in GB. Set to -1 for unlimited (prod). Use a positive value to cap dev costs."
  default     = -1

  validation {
    condition     = var.daily_quota_gb == -1 || var.daily_quota_gb > 0
    error_message = "daily_quota_gb must be -1 (unlimited) or a positive number."
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to the workspace"
  default     = {}
}
