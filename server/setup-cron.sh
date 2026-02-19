#!/bin/bash
# =============================================================================
# SEO Blog SaaS — Cron Setup Script
# Installs system crontab jobs for auto-generation
# The cron calls the local API directly (no Vercel, no external dependency)
# =============================================================================

APP_DIR="/var/www/seo-blog-saas"
APP_PORT=3001

# Read CRON_SECRET from .env
CRON_SECRET=$(grep '^CRON_SECRET' $APP_DIR/.env | cut -d'"' -f2)

if [ -z "$CRON_SECRET" ]; then
    echo "ERROR: CRON_SECRET not found in $APP_DIR/.env"
    exit 1
fi

BASE_URL="http://127.0.0.1:${APP_PORT}"
AUTH_HEADER="Authorization: Bearer ${CRON_SECRET}"

# ─── CRON JOBS ────────────────────────────────────────────────────────────────
# Job 1: Auto-generate blog posts — every hour
CRON_GENERATE="0 * * * * curl -s -X POST '${BASE_URL}/api/cron/generate' -H '${AUTH_HEADER}' -H 'Content-Type: application/json' >> /var/log/pm2/seo-blog-saas-cron.log 2>&1 # seo-blog-saas-generate"

# Job 2: Daily health check log at midnight
CRON_HEALTH="0 0 * * * curl -s '${BASE_URL}/api/health' >> /var/log/pm2/seo-blog-saas-health.log 2>&1 # seo-blog-saas-health"

# Install crons — remove old versions first to avoid duplicates
(
  crontab -l 2>/dev/null | grep -v "seo-blog-saas"
  echo "$CRON_GENERATE"
  echo "$CRON_HEALTH"
) | crontab -

echo ""
echo "✓ Cron jobs installed:"
echo ""
crontab -l | grep "seo-blog-saas"
echo ""
echo "To view cron logs:"
echo "  tail -f /var/log/pm2/seo-blog-saas-cron.log"
echo ""
echo "To trigger generation manually right now:"
echo "  curl -X POST http://127.0.0.1:${APP_PORT}/api/cron/generate -H 'Authorization: Bearer ${CRON_SECRET}'"
