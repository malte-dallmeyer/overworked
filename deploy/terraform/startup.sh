#!/bin/sh
# Runs as root on every boot; idempotent.
set -eu

# 1 GB RAM is tight while pulling images: add 1 GB swap.
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon -a

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# The SSH user may be created only after the first boot (by the guest agent).
until id ${ssh_user} >/dev/null 2>&1; do sleep 5; done
usermod -aG docker ${ssh_user}
install -d -o ${ssh_user} -g ${ssh_user} /home/${ssh_user}/overworked
