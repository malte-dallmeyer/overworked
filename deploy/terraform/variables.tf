variable "gcp_project" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Free Tier regions: us-west1, us-central1, us-east1."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "domain" {
  description = "Full domain name, e.g. overworked.example.com."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Zone ID of the domain, shown on its overview page in the Cloudflare dashboard."
  type        = string
}

variable "cloudflare_api_token" {
  description = "Token with Zone > DNS > Edit for this zone only. Null: CLOUDFLARE_API_TOKEN."
  type        = string
  default     = null
  sensitive   = true
}

variable "ssh_user" {
  description = "User created on the VM for SSH and deployments."
  type        = string
  default     = "overworked"
}

variable "ci_ssh_public_key_file" {
  description = "Key GitHub Actions deploys with (no passphrase, only for this); null: none."
  type        = string
  default     = null
}

variable "ssh_public_key_file" {
  description = "Public half of a key used only for this server, see deploy/README.md."
  type        = string
  default     = "~/.ssh/overworked.pub"
}
