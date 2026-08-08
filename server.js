// server.js — Express entry point for Naija Dimes Hub
require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const config = require("./src/config");
const db = require("./src/db");
const { logActivity } = require("./src/lib/audit");

// routes (will create next)
const publicRoutes = require("./src/routes/public");
const adminRoutes = require("./src/routes/admin");

// Multer setup for payment screenshot uploads
const upload = multer({
  dest: config.uploadsDir,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: config.maxUploadMB * 1024 * 1024 // in bytes
  }
});

const app = express();

app.set("trust proxy", config.trustProxy ? 1 : false);
app.set("view engine", "ejs");
app.set("views", config.viewsDir);

// ── security ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "cdn.jsdelivr.net", "images.unsplash.com"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── body parsers ──
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── static assets ──
app.use(express.static(config.publicDir, { maxAge: "1d" }));

// ── session ──
app.use(session({
  secret: config.sessionSecret,
  name: "ndh.sid",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.isProd && config.trustProxy,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  },
}));

// ── CSRF double-submit cookie ──
app.use((req, res, next) => {
  const token = req.session.csrf || require("crypto").randomBytes(32).toString("hex");
  req.session.csrf = token;
  res.cookie("csrf_token", token, { httpOnly: true, sameSite: "lax", secure: config.isProd && config.trustProxy });
  res.locals.csrfToken = token;
  next();
});

// ── CSRF validation for mutating methods ──
function csrfGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const cookie = req.cookies?.csrf_token || req.session?.csrf;
  const header = req.headers["x-csrf-token"] || req.body._csrf;
  if (!cookie || !header || cookie !== header) {
    return res.status(403).render("error", { message: "Invalid CSRF token", status: 403 });
  }
  next();
}
app.use(csrfGuard);

// ── rate limiters ──
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rate.login,
  message: { error: "Too many login attempts, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: config.rate.order,
  message: { error: "Too many order attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: config.rate.payment,
  message: { error: "Too many payment submissions" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── global locals ──
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.admin = req.session.admin || null;
  res.locals.config = config;
  res.locals.formatNaira = (k) => {
    if (!k) return "�₦0";
    return "�₦" + (k / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// ── routes ──
app.use("/login", loginLimiter);
app.use("/register", loginLimiter);
app.use("/buy", orderLimiter);
app.use("/payment", paymentLimiter); // Note: this is for the payment upload route

app.use("/", publicRoutes);
app.use("/admin", adminRoutes);

// ── 404 ──
app.use((req, res) => res.status(404).render("error", { message: "Page not found", status: 404 }));

// ── error handler ──
app.use((err, req, res, next) => {
  console.error("[server] error:", err);
  res.status(err.status || 500).render("error", {
    message: err.message || "Internal server error",
    status: err.status || 500,
  });
});

// ── start ──
app.listen(config.port, () => {
  console.log(`[server] Naija Dimes Hub running on http://localhost:${config.port}`);
  if (config.maintenanceMode) console.log("[server] �� ⚠ MAINTENANCE MODE ENABLED");
});

module.exports = app;