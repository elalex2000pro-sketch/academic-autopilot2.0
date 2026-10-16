#!/usr/bin/env bash
# Preparacion inicial de una VM Ubuntu (Google Cloud e2-micro Always Free).
# Instala Docker, crea 2 GB de swap (la VM solo tiene 1 GB de RAM) y deja
# el sistema listo para el primer despliegue.
#
# Uso: bash deploy/gcp-vm-setup.sh
set -euo pipefail

echo "==> Creando swap de 2 GB (ayuda en la e2-micro de 1 GB de RAM)..."
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo "    swap activada."
else
  echo "    ya existia swap."
fi

echo "==> Instalando Docker (si no esta)..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "    Docker instalado. Cierra la sesion SSH y vuelve a entrar para"
  echo "    usar Docker sin 'sudo' (o ejecuta: newgrp docker)."
else
  echo "    Docker ya estaba instalado."
fi

echo
echo "==> Hecho. Recuerda abrir los puertos 80 y 443 en el firewall de la VCN"
echo "    (panel de Google Cloud: VPC network -> Firewall)."
