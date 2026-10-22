output "ip" {
  value = google_compute_address.overworked.address
}

output "ssh" {
  description = "Host argument for scripts/deploy.mjs."
  value       = "${var.ssh_user}@${google_compute_address.overworked.address}"
}
