#!/bin/bash
# HotelMol — First-time server setup
# Run once on a fresh Ubuntu 22.04 VPS
set -e

echo "==> Installing Docker..."
apt-get update
apt-get install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "==> Installing Nginx + Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Cloning repo..."
cd /opt
git clone https://github.com/Gleb4442/roomie.app.git hotelmol
cd hotelmol

echo "==> Creating .env file..."
cat > .env << 'ENVEOF'
DB_PASSWORD=CHANGE_ME_strong_password
JWT_SECRET=CHANGE_ME_run_openssl_rand_base64_64
JWT_REFRESH_SECRET=CHANGE_ME_run_openssl_rand_base64_64
HOTELMOL_ADMIN_JWT_SECRET=CHANGE_ME_run_openssl_rand_base64_64
DASHBOARD_MANAGER_JWT_SECRET=CHANGE_ME_run_openssl_rand_base64_64
STAFF_JWT_SECRET=CHANGE_ME_run_openssl_rand_base64_64
HOTELMOL_ADMIN_USERNAME=admin
HOTELMOL_ADMIN_PASSWORD=CHANGE_ME_strong_password
ROOMIE_API_URL=https://roomie-api.hotelmol.com
APP_BASE_URL=https://app.hotelmol.com
ENVEOF

echo ""
echo "⚠️  IMPORTANT: Edit /opt/hotelmol/.env with real secrets before continuing!"
echo "   Use: nano /opt/hotelmol/.env"
echo ""
echo "==> After editing .env, run:"
echo "   cd /opt/hotelmol && docker compose up -d"
echo ""
echo "==> Then configure Nginx:"
echo "   cp deploy/nginx.conf /etc/nginx/sites-available/hotelmol"
echo "   ln -s /etc/nginx/sites-available/hotelmol /etc/nginx/sites-enabled/"
echo "   certbot --nginx -d api.hotelmol.com"
echo "   nginx -t && systemctl reload nginx"
