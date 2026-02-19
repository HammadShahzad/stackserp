#!/bin/bash
# =============================================================================
# SEO Blog SaaS — Fast Update Script
# Pulls latest code from GitHub, rebuilds, and reloads PM2
# Safe: does NOT touch zerofrictionhire.com, Nginx, or the DB
# =============================================================================

set -e
APP_DIR="/var/www/seo-blog-saas"
GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}[UPDATE]${NC} $1"; }

cd $APP_DIR

log "Pulling latest from GitHub..."
git pull origin main

log "Installing any new dependencies..."
npm ci --legacy-peer-deps

log "Running any new migrations..."
npx prisma migrate deploy

log "Rebuilding Next.js..."
npm run build

log "Reloading PM2 (zero-downtime)..."
pm2 reload seo-blog-saas

log "Done! App updated at $(date)"
pm2 status seo-blog-saas
