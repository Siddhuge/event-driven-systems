output "cluster_id" {
  value       = azurerm_kubernetes_cluster.aks.id
  description = "AKS cluster resource ID"
}

output "cluster_name" {
  value       = azurerm_kubernetes_cluster.aks.name
  description = "AKS cluster name"
}

output "kube_admin_config" {
  value       = azurerm_kubernetes_cluster.aks.kube_admin_config_raw
  description = "Kubeconfig for admin access"
  sensitive   = true
}

output "kubelet_identity" {
  value       = try(azurerm_kubernetes_cluster.aks.kubelet_identity[0].client_id, "")
  description = "Kubelet managed identity client ID"
}
