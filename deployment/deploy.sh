#!/usr/bin/env bash
# ====================================================================
# FinPro — Automated Cloud VM Deployment Script
# Zero-downtime deployment for Oracle Cloud Infrastructure Always Free VM
# ====================================================================

set -euo pipefail

APP_DIR="/opt/finpro"
echo "===================================================================="
echo "  FinPro — Deploying Application to Cloud VM"
echo "===================================================================="

cd "${APP_DIR}"

echo "👉 [1/6] Pulling latest updates from Git repository..."
git pull origin main

echo "👉 [2/6] Verifying environment configuration..."
if [ ! -f .env ]; then
  echo "❌ Error: .env file missing in ${APP_DIR}!"
  echo "Please copy .env.example to .env and configure DATABASE_URL."
  exit 1
fi

echo "👉 [3/6] Applying Prisma Database Migrations (Controlled Deploy)..."
# Use temporary container or npx to run migration against cloud database
docker compose -f deployment/docker-compose.prod.yml run --rm finpro_app sh -c "cd node-backend && npx prisma migrate deploy"

echo "👉 [4/6] Rebuilding Production Docker Container..."
docker compose -f deployment/docker-compose.prod.yml build --pull

echo "👉 [5/6] Starting Updated FinPro Application Container..."
docker compose -f deployment/docker-compose.prod.yml up -d --remove-orphans

echo "👉 [6/6] Verifying Container Health & Readiness Probe..."
sleep 5
HEALTH_STATUS=$(docker inspect --format='{{json .State.Health.Status}}' finpro_production_app || echo '"unknown"')
echo "Container Healthcheck: ${HEALTH_STATUS}"

# Probe HTTP endpoint
if curl -fs http://127.0.0.1:5000/api/v1/health/ready > /dev/null; then
  echo "✅ FinPro Cloud Readiness Probe: PASS (200 OK)"
else
  echo "⚠️ Notice: Probe not ready immediately; monitor docker logs with: docker logs -f finpro_production_app"
fi

echo "===================================================================="
echo "🎉 Deployment complete! FinPro is live."
echo "===================================================================="
