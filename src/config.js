// ── Central configuration ──────────────────────────────────────────────
const path = require("path");

function loadEnv() {
  try {
    require("dotenv").config?.({ path: path.join(__dirname, "..", ".env") });
  } catch (_) { /* dotenv optional */ }
}
loadEnv();

const bool = (v, d = false) => (v === undefined || v === null || v === "" ? d : ["1", "true", "yes", "on"].includes(String(v).toLowerCase()));
const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

const config = {
  env: process.env.NODE_ENV || "production",
  isProd: (process.env.NODE_ENV || "production") === "production",
  port: int(process.env.PORT, 3000),
  sessionSecret: process.env.SESSION_SECRET || "insecure-dev-secret-change-me",
  appUrl: process.env.APP_URL || "",
  trustProxy: bool(process.env.TRUST_PROXY, true),
  maintenanceMode: bool(process.env.MAINTENANCE_MODE, false),

  admin: {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "NaijaDimes2026!",
    email: process.env.ADMIN_EMAIL || "admin@naijadimeshub.com",
  },

  rate: {
    login: int(process.env.RATE_LOGIN, 20),
    order: int(process.env.RATE_ORDER, 15),
    payment: int(process.env.RATE_PAYMENT, 10),
    contact: int(process.env.RATE_CONTACT, 5),
  },

  maxUploadMB: int(process.env.MAX_UPLOAD_MB, 5),

  // paths
  root: path.join(__dirname, ".."),
  dataDir: path.join(__dirname, "..", "data"),
  dbFile: path.join(__dirname, "..", "data", "naijadimes.db"),
  uploadsDir: path.join(__dirname, "..", "data", "uploads"),
  publicDir: path.join(__dirname, "..", "public"),
  viewsDir: path.join(__dirname, "..", "views"),
};

module.exports = config;
