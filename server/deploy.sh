#!/bin/bash
# =============================================================================
# SEO Blog SaaS — Full Deploy Script for DigitalOcean Droplet
# Safe to run alongside zerofrictionhire.com — uses port 3001, own DB
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Requirements: Git repo must be at https://github.com/HammadShahzad/seo-blog-saas
# =============================================================================

set -e  # Exit on any error

APP_DIR="/var/www/seo-blog-saas"
APP_PORT=3001
DB_NAME="seo_blog_saas"
DB_USER="seo_blog_user"
GITHUB_REPO="https://github.com/HammadShahzad/seo-blog-saas.git"
LOG_DIR="/var/log/pm2"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ─── 1. SYSTEM PACKAGES ──────────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -qq

# Install Node.js 20 LTS if not present
if ! command -v node &>/dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]]; then
    log "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
log "Node: $(node -v) | NPM: $(npm -v)"

# Install PM2 globally if not present
if ! command -v pm2 &>/dev/null; then
    log "Installing PM2..."
    npm install -g pm2
fi

# Install Nginx if not present
if ! command -v nginx &>/dev/null; then
    log "Installing Nginx..."
    apt-get install -y nginx
fi

# Install Certbot for SSL
if ! command -v certbot &>/dev/null; then
    log "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
fi

# ─── 2. POSTGRESQL DATABASE ──────────────────────────────────────────────────
log "Setting up PostgreSQL database..."
if ! command -v psql &>/dev/null; then
    log "Installing PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
fi

# Create DB and user if they don't exist (won't affect existing DBs)
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || {
    log "Creating database: ${DB_NAME}"
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};"
}

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1 || {
    log "Creating DB user: ${DB_USER}"
    DB_PASSWORD=$(openssl rand -hex 16)
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
    echo "DB_PASSWORD=${DB_PASSWORD}" >> /root/.seo-blog-saas-secrets
    log "DB password saved to /root/.seo-blog-saas-secrets"
}

# ─── 3. CLONE / UPDATE REPO ──────────────────────────────────────────────────
mkdir -p $LOG_DIR

if [ -d "$APP_DIR/.git" ]; then
    log "Updating existing repo..."
    cd $APP_DIR
    git pull origin main
else
    log "Cloning repo to $APP_DIR..."
    git clone $GITHUB_REPO $APP_DIR
    cd $APP_DIR
fi

# ─── 4. ENVIRONMENT FILE ─────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
    log "Creating .env file..."
    
    # Read DB password from secrets file
    DB_PASSWORD=$(grep DB_PASSWORD /root/.seo-blog-saas-secrets 2>/dev/null | cut -d= -f2 || echo "changeme")
    NEXTAUTH_SECRET=$(openssl rand -hex 32)
    CRON_SECRET=$(openssl rand -hex 20)

    cat > "$APP_DIR/.env" << EOF
# Database
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"

# Auth
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="https://YOUR_DOMAIN"

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# AI Services — paste your keys here after deploy or set via: nano /var/www/seo-blog-saas/.env
GOOGLE_AI_API_KEY=""
PERPLEXITY_API_KEY=""

# Backblaze B2 Storage
B2_ACCOUNT_ID=""
B2_APPLICATION_KEY=""
B2_BUCKET_NAME=""
B2_ENDPOINT=""

# Stripe
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""

# Cron (used by system crontab)
CRON_SECRET="${CRON_SECRET}"

# App
PORT=3001
EOF
    warn "⚠  Edit $APP_DIR/.env and set NEXTAUTH_URL to your real domain!"
    echo "CRON_SECRET=${CRON_SECRET}" >> /root/.seo-blog-saas-secrets
fi

# ─── 5. INSTALL DEPS & BUILD ──────────────────────────────────────────────────
cd $APP_DIR
log "Installing Node dependencies..."
npm ci --legacy-peer-deps

log "Running Prisma migrations..."
npx prisma migrate deploy

log "Building Next.js app..."
npm run build

# ─── 6. PM2 PROCESS ──────────────────────────────────────────────────────────
log "Starting/reloading app with PM2 on port $APP_PORT..."
pm2 describe seo-blog-saas > /dev/null 2>&1 && \
    pm2 reload seo-blog-saas || \
    pm2 start ecosystem.config.js --env production

pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true

# ─── 7. NGINX CONFIG ──────────────────────────────────────────────────────────
log "Setting up Nginx..."
cp $APP_DIR/server/nginx.conf /etc/nginx/sites-available/seo-blog-saas

# Only create symlink if it doesn't exist
[ -L /etc/nginx/sites-enabled/seo-blog-saas ] || \
    ln -s /etc/nginx/sites-available/seo-blog-saas /etc/nginx/sites-enabled/seo-blog-saas

nginx -t && systemctl reload nginx

# ─── 8. SYSTEM CRON (runs every hour) ────────────────────────────────────────
log "Setting up system cron for auto-generation..."
CRON_SECRET_VAL=$(grep CRON_SECRET $APP_DIR/.env | cut -d'"' -f2)

# Write cron job — won't duplicate if already exists
CRON_JOB="0 * * * * curl -s -X POST http://127.0.0.1:3001/api/cron/generate -H 'Authorization: Bearer ${CRON_SECRET_VAL}' -H 'Content-Type: application/json' >> /var/log/pm2/seo-blog-saas-cron.log 2>&1"

(crontab -l 2>/dev/null | grep -v "seo-blog-saas-cron\|/api/cron/generate"; echo "$CRON_JOB") | crontab -

log "Cron installed — runs every hour at :00"

# ─── DONE ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ SEO Blog SaaS deployed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  App running on:   http://127.0.0.1:$APP_PORT"
echo "  PM2 status:       pm2 status"
echo "  App logs:         pm2 logs seo-blog-saas"
echo "  Cron logs:        tail -f /var/log/pm2/seo-blog-saas-cron.log"
echo ""
echo "  ⚠ Next steps:"
echo "  1. Edit $APP_DIR/.env → set NEXTAUTH_URL to your domain"
echo "  2. Edit /etc/nginx/sites-available/seo-blog-saas → set YOUR_DOMAIN"
echo "  3. Run: certbot --nginx -d YOUR_DOMAIN (free SSL)"
echo "  4. Run: pm2 reload seo-blog-saas (after .env changes)"
echo ""
echo "  zerofrictionhire.com is untouched ✓"
echo ""
