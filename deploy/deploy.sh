#!/bin/bash
# HotelMol Backend — deploy script
# Run on server: bash deploy/deploy.sh
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "==> [1/5] Pulling latest code..."
git pull origin main

echo "==> [2/5] Building Docker image..."
docker compose build --no-cache backend

echo "==> [3/5] Stopping old container..."
docker compose stop backend

echo "==> [4/5] Starting new container (migrations auto-run)..."
docker compose up -d backend

echo "==> [5/5] Health check..."
sleep 5
STATUS=$(docker compose ps backend --format json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('State','?'))" 2>/dev/null || echo "unknown")
if docker compose ps backend | grep -q "Up"; then
  echo "✅  Backend is UP"
else
  echo "❌  Backend failed to start. Logs:"
  docker compose logs --tail=50 backend
  exit 1
fi

echo ""
echo "✅  Deploy complete!"
echo "   Logs: docker compose logs -f backend"
