// src/routes/public.js — client‑facing pages
const express = require("express");
const router = express.Router();
const path = require("path");
const { generateOrderCode } = require("../lib/orderId");
const { formatNaira, formatNairaShort, koboToNaira, toKobo, parseNaira } = require("../lib/money");
const { STATES, LABELS } = require("../lib/orderMachine");
const { auditFrom } = require("../lib/audit");
const config = require("../config");
const db = require("../db");

// ── middleware: load packages & settings for all pages ──
router.use((req, res, next) => {
  const packages = db.all("SELECT * FROM diamond_packages WHERE active = 1 ORDER BY sort_order, dimes");
  const announcement = db.get("SELECT * FROM announcements WHERE published = 1 AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY id DESC LIMIT 1");
  const site = {};
  db.all("SELECT key, value FROM site_settings").forEach((row) => { site[row.key] = row.value; });
  res.locals.packages = packages;
  res.locals.announcement = announcement;
  res.locals.site = site;
  let hero = {};
  try { hero = JSON.parse(db.get("SELECT value FROM homepage_sections WHERE key = 'hero'")?.value || "{}"); } catch (_) {}
  let annBar = {};
  try { annBar = JSON.parse(db.get("SELECT value FROM homepage_sections WHERE key = 'announcement_bar'")?.value || "{}"); } catch (_) {}
  res.locals.hero = hero;
  res.locals.annBar = annBar;
  res.locals.testimonials = db.all("SELECT * FROM testimonials WHERE active = 1 ORDER BY created_at DESC LIMIT 6");
  res.locals.banners = db.all("SELECT * FROM banners WHERE active = 1 AND (start_at IS NULL OR start_at <= datetime('now')) AND (end_at IS NULL OR end_at >= datetime('now')) ORDER BY sort_order");
  res.locals.LABELS = LABELS;
  res.locals.formatNaira = formatNaira;
  res.locals.formatNairaShort = formatNairaShort;
  res.locals.koboToNaira = koboToNaira;
  res.locals.toKobo = toKobo;
  res.locals.parseNaira = parseNaira;
  next();
});

// ── HOME ──
router.get("/", (req, res) => {
  res.render("index");
});

// ── PACKAGES PAGE (alias) ──
router.get("/packages", (req, res) => {
  res.render("packages");
});

// ── BUY FLOW ──
router.get("/buy", (req, res) => {
  res.render("buy-step1", { step: 1, package: null, error: null });
});

// step 1: package selected via POST (simulate wizard)
router.post("/buy", (req, res) => {
  const packageId = parseInt(req.body.package_id);
  if (!packageId) {
    return res.render("buy-step1", { step: 1, package: null, error: "Please select a package" });
  }
  const pkg = db.get("SELECT * FROM diamond_packages WHERE id = ?", [packageId]);
  if (!pkg) {
    return res.render("buy-step1", { step: 1, package: null, error: "Invalid package" });
  }
  res.render("buy-step2", { step: 2, package: pkg, error: null, uid: "", nick: "" });
});

// step 2: UID + nickname
router.post("/buy/uid", (req, res) => {
  const packageId = parseInt(req.body.package_id);
  const uid = (req.body.uid || "").trim();
  const nick = (req.body.nick || "").trim();
  const pkg = db.get("SELECT * FROM diamond_packages WHERE id = ?", [packageId]);
  if (!pkg) {
    return res.redirect("/buy");
  }
  if (!/^\d{5,12}$/.test(uid)) {
    return res.render("buy-step2", { step: 2, package: pkg, error: "UID must be 5‑12 digits", uid, nick });
  }
  res.render("buy-step3", { step: 3, package: pkg, uid, nick, error: null, name: "", whatsapp: "", email: "", note: "" });
});

// step 3: customer info
router.post("/buy/info", (req, res) => {
  const packageId = parseInt(req.body.package_id);
  const uid = (req.body.uid || "").trim();
  const nick = (req.body.nick || "").trim();
  const name = (req.body.name || "").trim();
  const whatsapp = (req.body.whatsapp || "").trim();
  const email = (req.body.email || "").trim();
  const note = (req.body.note || "").trim();
  const pkg = db.get("SELECT * FROM diamond_packages WHERE id = ?", [packageId]);
  if (!pkg) {
    return res.redirect("/buy");
  }
  // basic validation
  if (!name || name.length < 2) {
    return res.render("buy-step3", { step: 3, package: pkg, uid, nick, error: "Please enter your full name", name, whatsapp, email, note });
  }
  if (!/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(whatsapp)) {
    return res.render("buy-step3", { step: 3, package: pkg, uid, nick, error: "Enter a valid WhatsApp number", name, whatsapp, email, note });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.render("buy-step3", { step: 3, package: pkg, uid, nick, error: "Enter a valid email address", name, whatsapp, email, note });
  }
  // create order
  const orderCode = generateOrderCode(db);
  const amountKobo = pkg.price_kobo; // no discount yet; promo codes later
  const ins = db.run(
    `INSERT INTO orders (order_code, package_id, dimes, amount_kobo, base_kobo, customer_name, whatsapp, email, freefire_uid, freefire_nick, note, status, ip_address)
     VALUES (?,?,?,?,?,?,?,?,?,?,?, 'PENDING_PAYMENT', ?)`,
    orderCode,
    pkg.id,
    pkg.dimes,
    amountKobo,
    pkg.price_kobo,
    name,
    whatsapp,
    email || null,
    uid,
    nick,
    note,
    req.ip || req.socket?.remoteAddress || ""
  );
  const orderId = ins.lastInsertRowid;
  const paymentSettings = db.get("SELECT * FROM payment_settings WHERE id = 1") || {};
  res.render("buy-step4", {
    step: 4,
    paymentSettings,
    order: {
      id: orderId,
      code: orderCode,
      dimes: pkg.dimes,
      amount: amountKobo,
      uid,
      name,
      whatsapp,
      email: email || "-",
      note: note || "-",
    },
  });
});

// ── TRACK ORDER ──
router.get("/track", (req, res) => {
  res.render("track", { order: null, error: null });
});

router.post("/track", (req, res) => {
  const code = (req.body.order_code || "").trim().toUpperCase();
  if (!/^NDH-\d{8}-[A-Z0-9]{4}$/.test(code)) {
    return res.render("track", { order: null, error: "Invalid order ID format" });
  }
  const order = db.get("SELECT o.*, p.dimes as package_dimes, p.price_kobo as package_price FROM orders o JOIN diamond_packages p ON o.package_id = p.id WHERE o.order_code = ?", [code]);
  if (!order) {
    return res.render("track", { order: null, error: "Order not found" });
  }
  const payment = db.get("SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1", [order.id]);
  res.render("track", { order, payment, error: null });
});

// ── FAQ ──
router.get("/faq", (req, res) => {
  const faqJSON = db.get("SELECT faq_json FROM support_settings WHERE id = 1")?.faq_json || "[]";
  let faq = [];
  try { faq = JSON.parse(faqJSON); } catch (_) { faq = []; }
  res.render("faq", { faq });
});

// ── SUPPORT ──
router.get("/support", (req, res) => {
  const whatsapp = db.get("SELECT whatsapp FROM support_settings WHERE id = 1")?.whatsapp || "";
  const telegram = db.get("SELECT telegram FROM support_settings WHERE id = 1")?.telegram || "";
  const email = db.get("SELECT email FROM support_settings WHERE id = 1")?.email || "";
  res.render("support", { whatsapp, telegram, email });
});

// ── static: robots.txt ──
router.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send("User-agent: *\nDisallow:/admin/\n");
});

module.exports = router;