// PM2 Ecosystem Config
// StackSerp runs on port 3001
// Uses Next.js standalone output
// Auto-loads .env from project root since standalone mode doesn't load it

const fs = require("fs");
const path = require("path");

function loadEnvFile(envPath) {
  try {
    const content = fs.readFileSync(envPath, "utf8");
    const env = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (val) env[key] = val;
    }
    return env;
  } catch {
    return {};
  }
}

const dotenv = loadEnvFile(path.join("/var/www/stackserp", ".env"));

module.exports = {
  apps: [
    {
      name: "stackserp",
      script: "server.js",
      cwd: "/var/www/stackserp",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        HOSTNAME: "0.0.0.0",
        ...dotenv,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
        HOSTNAME: "0.0.0.0",
        ...dotenv,
      },
      error_file: "/var/log/pm2/stackserp-error.log",
      out_file: "/var/log/pm2/stackserp-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "seo-worker",
      script: "worker.js",
      cwd: "/var/www/stackserp",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        ...dotenv,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
        ...dotenv,
      },
      error_file: "/var/log/pm2/seo-worker-error.log",
      out_file: "/var/log/pm2/seo-worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
