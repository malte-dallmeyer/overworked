# One e2-micro VM (Google Cloud Free Tier) with Docker, a static IP, a firewall rule for
# HTTP/HTTPS and the DNS record at Cloudflare. State stays local (terraform.tfstate, not committed).

terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.gcp_project
  region  = var.region
  zone    = var.zone
}

# Without cloudflare_api_token, the provider reads CLOUDFLARE_API_TOKEN from the environment.
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "google_project_service" "compute" {
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_compute_address" "overworked" {
  name       = "overworked"
  depends_on = [google_project_service.compute]
}

resource "google_compute_firewall" "web" {
  name          = "overworked-web"
  network       = "default"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["overworked"]

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  depends_on = [google_project_service.compute]
}

resource "google_compute_instance" "overworked" {
  name         = "overworked"
  machine_type = "e2-micro"
  tags         = ["overworked"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      # Free Tier: up to 30 GB standard persistent disk.
      size = 30
      type = "pd-standard"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.overworked.address
    }
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${trimspace(file(pathexpand(var.ssh_public_key_file)))}"
  }
  metadata_startup_script = templatefile("${path.module}/startup.sh", { ssh_user = var.ssh_user })

  # Free Tier VMs must not be preemptible/spot.
  scheduling {
    preemptible       = false
    automatic_restart = true
  }
}

resource "cloudflare_dns_record" "overworked" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "A"
  content = google_compute_address.overworked.address
  ttl     = 1 # automatic
  # DNS only: Caddy gets the certificate itself, and the proxy would buffer live updates (SSE).
  proxied = false
}
