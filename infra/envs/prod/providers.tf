provider "azurerm" {
  features {
    # Key Vault protection settings
    key_vault {
      purge_soft_delete_on_destroy      = false # Don't auto-purge, allow 90-day recovery
      recover_soft_deleted_key_vaults   = true
      recover_soft_deleted_certificates = true
      recover_soft_deleted_secrets      = true
    }

    # Virtual machine protection
    virtual_machine {
      delete_os_disk_on_deletion = false # Prevent accidental OS disk deletion
      graceful_shutdown          = true
    }

    # Resource Group protection
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }

  skip_provider_registration = false
}
