provider "azurerm" {
  features {
    # Key Vault protection settings
    key_vault {
      purge_soft_delete_on_destroy      = false # Don't auto-purge, allow recovery
      recover_soft_deleted_key_vaults   = true
      recover_soft_deleted_certificates = true
      recover_soft_deleted_secrets      = true
    }

    # Virtual machine protection
    virtual_machine {
      delete_os_disk_on_deletion = false
      graceful_shutdown          = false # Fast shutdown for dev
    }
  }

  skip_provider_registration = false
}
