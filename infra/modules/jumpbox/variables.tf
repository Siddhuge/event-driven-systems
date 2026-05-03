variable "enabled" {
  type        = bool
  description = "Whether to create the jumpbox"
  default     = false
}

variable "name" {
  type        = string
  description = "Name of the jumpbox VM and related resources"

  validation {
    condition     = length(var.name) >= 1 && length(var.name) <= 64 && can(regex("^[a-zA-Z0-9._-]+$", var.name))
    error_message = "Jumpbox name must be 1-64 characters and contain only alphanumeric, dot, underscore, and hyphen."
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

variable "subnet_id" {
  type        = string
  description = "Subnet ID for the jumpbox NIC"
}

variable "admin_username" {
  type        = string
  description = "Admin username for the jumpbox VM"
  default     = "azureuser"
}

variable "admin_ssh_public_key" {
  type        = string
  description = "SSH public key allowed to log in to the jumpbox"
  default     = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCu3abmLfz289m8GAmK2n1Fl747gG6e1+CRgxWOVkevA5ihS8s4OAtyOomAdAcIvuRGNTTYZd0oyiCplausE4cCftZh3POcMGTkoT/BWRnsmpyrB19kzE1CoSwnBiVmxDpsj0gCFw5uL3HwDVRRlAABRZV9ooFsOx11x8ObCtg3DFKGxA70BZjYjlgqvdQKv59HgsQ/vIjZfA7goRg53iv443/YCdzyduvOkCJr7DJCELVsR4Go6ff6FRxHaQG6IGly58+DB6I/DkZGHHmqZONvj9NlGlDlUUW9kgHeFRG5qCs7G3bR+V69CEQ7uiZyroF6dBpTndNQ/XQErxfHvtwr.ssh"

  validation {
    condition     = var.admin_ssh_public_key == "" || can(regex("^ssh-rsa ", var.admin_ssh_public_key))
    error_message = "SSH public key must start with ssh-rsa."
  }
}

variable "allowed_ssh_cidrs" {
  type        = list(string)
  description = "CIDR ranges allowed to SSH to the jumpbox"
  default     = []

  validation {
    condition     = alltrue([for cidr in var.allowed_ssh_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All SSH source ranges must be valid CIDR blocks."
  }
}

variable "vm_size" {
  type        = string
  description = "Azure VM size for the jumpbox"
  default     = "Standard_B2s"
}

variable "aks_cluster_name" {
  type        = string
  description = "AKS cluster name used by cloud-init helper scripts"
}

variable "aks_cluster_id" {
  type        = string
  description = "AKS cluster resource ID used for jumpbox managed identity role assignment"
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to jumpbox resources"
  default     = {}
}
