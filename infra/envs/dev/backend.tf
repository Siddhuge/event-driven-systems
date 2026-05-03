terraform {
  backend "azurerm" {
    resource_group_name  = "Optum-POC"
    storage_account_name = "optumaiapp"
    container_name       = "tfstate"
    key                  = "dev.tfstate"
  }
}