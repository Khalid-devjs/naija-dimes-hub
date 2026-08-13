// src/routes/admin.js — admin dashboard (login + management)
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { formatNaira, toKobo } = require("../lib/money");
const { STATES, LABELS } = require("../lib/orderMachine");
const { auditFrom } = require("../lib/audit");
const config = require("../config");
const db = require("../db");
const { GAMES, getGame, badgeLabel } = require("../games");

// ── login ──
router.get("/login", (req, res) => {
  res.render("admin/login", { error: null });
});

router.post("/login", (req, res) => {
  const username = (req.body.username || "").trim();
  const password = req.body.password || "";
  if (!username || !password) {
    return res.render("admin/login", { error: "Username and password required" });
  }
  const admin = db.get("SELECT * FROM admins WHERE username = ? AND active = 1", [username]);
  if (!admin) {
    auditFrom(req, "admin_login_failed", "admins", username, "username not found");
    return res.render("admin/login", { error: "Invalid credentials" });
  }
  if (!bcrypt.compareSync(password, admin.password_hash)) {
    auditFrom(req, "admin_login_failed", "admins", username, "wrong password");
    return res.render("admin/login", { error: "Invalid credentials" });
  }
  // success
  req.session.admin = { id: admin.id, username: admin.username, role: admin.role, full_name: admin.full_name };
  db.run("UPDATE admins SET last_login_at = datetime('now') WHERE id = ?", [admin.id]);
  auditFrom(req, "admin_login", "admins", admin.id, `role=${admin.role}`);
  res.redirect("/admin");
});

router.get("/logout", (req, res) => {
  auditFrom(req, "admin_logout", "admins", req.session?.admin?.id || "", "");
  req.session.admin = null;
  res.redirect("/admin/login");
});

// ── protect middleware ──
function requireAdmin(req, res, next) {
  if (!req.session?.admin) {
    return res.redirect("/admin/login");
  }
  res.locals.admin = req.session.admin;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.admin) return res.redirect("/admin/login");
    if (!roles.includes(req.session.admin.role)) {
      return res.status(403).render("admin/error", { message: "Insufficient permissions", admin: req.session.admin });
    }
    res.locals.admin = req.session.admin;
    next();
  };
}

router.use(requireAdmin);

// ── layout data middleware ──
router.use((req, res, next) => {
  res.locals.admin = req.session.admin;
  res.locals.reqPath = req.path;
  res.locals.query = req.query;
  res.locals.formatNaira = formatNaira;
  if (req.path === "/login" || req.path === "/logout") return next();
  next();
});

// ── DASHBOARD ──
router.get("/", (req, res) => {
  const totals = {
    orders: db.get("SELECT COUNT(*) c FROM orders").c || 0,
    pending: db.get("SELECT COUNT(*) c FROM orders WHERE status = 'PENDING_PAYMENT'").c || 0,
    under_review: db.get("SELECT COUNT(*) c FROM orders WHERE status = 'PAYMENT_UNDER_REVIEW'").c || 0,
    confirmed: db.get("SELECT COUNT(*) c FROM orders WHERE status = 'PAYMENT_CONFIRMED'").c || 0,
    processing: db.get("SELECT COUNT(*) c FROM orders WHERE status = 'PROCESSING'").c || 0,
    completed: db.get("SELECT COUNT(*) c FROM orders WHERE status = 'COMPLETED'").c || 0,
    rejected: db.get("SELECT COUNT(*) c FROM orders WHERE status = 'PAYMENT_REJECTED'").c || 0,
    cancelled: db.get("SELECT COUNT(*) c FROM orders WHERE status = 'CANCELLED'").c || 0,
    revenue: db.get("SELECT COALESCE(SUM(amount_kobo),0) c FROM orders WHERE status = 'COMPLETED'").c || 0,
    users: db.get("SELECT COUNT(*) c FROM users").c || 0,
    payments_today: db.get("SELECT COUNT(*) c FROM payments WHERE date(created_at) = date('now')").c || 0,
  };
  // weekly order trend (last 7 days)
  const trend = db.all(
    `SELECT date(created_at) d, COUNT(*) c, COALESCE(SUM(amount_kobo),0) r
     FROM orders WHERE date(created_at) >= date('now','-6 days')
     GROUP BY date(created_at) ORDER BY d`
  );
  res.render("admin/dashboard", { totals, trend });
});

// ── ORDERS ──
router.get("/orders", (req, res) => {
  let { q, status, pkg, date } = req.query;
  let sql = "SELECT o.*, p.dimes, p.price_kobo, (SELECT screenshot_path FROM payments WHERE order_id = o.id AND screenshot_path IS NOT NULL ORDER BY id DESC LIMIT 1) as receipt FROM orders o JOIN diamond_packages p ON o.package_id = p.id";
  const where = [];
  const params = [];
  if (q) { where.push("(o.order_code LIKE ? OR o.freefire_uid LIKE ? OR o.customer_name LIKE ? OR o.whatsapp LIKE ? OR o.email LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (status) { where.push("o.status = ?"); params.push(status); }
  if (date) { where.push("date(o.created_at) = ?"); params.push(date); }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY o.created_at DESC LIMIT 100";
  const orders = db.all(sql, params);
  res.render("admin/orders", { orders, query: req.query, LABELS });
});

router.get("/orders/:id", (req, res) => {
  const order = db.get(
    `SELECT o.*, p.dimes as package_dimes, p.price_kobo as package_price
     FROM orders o JOIN diamond_packages p ON o.package_id = p.id
     WHERE o.id = ?`,
    [req.params.id]
  );
  if (!order) return res.status(404).render("admin/error", { message: "Order not found" });
  const payment = db.get("SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1", [order.id]);
  res.render("admin/order-detail", { order, payment, LABELS });
});

// POST /admin/orders/:id/status → change status
router.post("/orders/:id/status", (req, res) => {
  const order = db.get("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!order) return res.status(404).send("Not found");
  const newStatus = req.body.status;
  // only admin can transition orders
  try {
    require("../lib/orderMachine").assertTransition(order.status, newStatus, "admin");
    db.run(
      "UPDATE orders SET status = ?, reject_reason = COALESCE(?, reject_reason), internal_notes = COALESCE(?, internal_notes), updated_at = datetime('now')" +
      (newStatus === "COMPLETED" ? ", completed_at = datetime('now')" : "") +
      " WHERE id = ?",
      newStatus,
      req.body.reject_reason || null,
      req.body.internal_notes || null,
      order.id
    );
    auditFrom(req, "order_status_changed", "orders", order.id, `${order.status} → ${newStatus}`);
    // notify customer
    if (order.user_id) {
      db.run(
        "INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)",
        order.user_id, "success", "Order Updated", `Your order ${order.order_code} is now ${LABELS[newStatus]}.`
      );
    }
    res.redirect(`/admin/orders/${order.id}?msg=status_updated`);
  } catch (e) {
    if (e.code === "ILLEGAL_TRANSITION") {
      res.status(400).render("admin/error", { message: "Illegal status transition" });
    } else {
      throw e;
    }
  }
});

// ── PAYMENTS ──
router.get("/payments", (req, res) => {
  const payments = db.all(
    `SELECT p.*, o.order_code, o.freefire_uid, o.customer_name
     FROM payments p JOIN orders o ON p.order_id = o.id
     ORDER BY p.created_at DESC LIMIT 100`
  );
  res.render("admin/payments", { payments });
});

router.get("/payments/:id", (req, res) => {
  const payment = db.get(
    `SELECT p.*, o.order_code, o.freefire_uid, o.freefire_nick, o.dimes, o.amount_kobo, o.base_kobo,
     o.customer_name, o.whatsapp, o.email, o.created_at as order_created
     FROM payments p JOIN orders o ON p.order_id = o.id
     WHERE p.id = ?`,
    [req.params.id]
  );
  if (!payment) return res.status(404).render("admin/error", { message: "Payment not found" });
  res.render("admin/payment-detail", { payment, formatNaira });
});

// approve / reject payment
router.post("/payments/:id/:action", (req, res) => {
  const payment = db.get("SELECT * FROM payments WHERE id = ?", [req.params.id]);
  const { action } = req.params;
  const { reject_reason } = req.body;
  if (!payment) return res.status(404).send("Not found");
  const order = db.get("SELECT * FROM orders WHERE id = ?", [payment.order_id]);
  if (!order) return res.status(404).send("Order not found");

  if (action === "approve") {
    // payment approved → order: PAYMENT_UNDER_REVIEW → PAYMENT_CONFIRMED → PROCESSING
    db.run("UPDATE payments SET status = 'APPROVED', admin_id = ?, reviewed_at = datetime('now') WHERE id = ?", req.session.admin.id, payment.id);
    db.run("UPDATE orders SET status = 'PAYMENT_CONFIRMED', updated_at = datetime('now') WHERE id = ?", order.id);
    db.run("UPDATE orders SET status = 'PROCESSING', updated_at = datetime('now') WHERE id = ? AND status = 'PAYMENT_CONFIRMED'", order.id); // immediately to processing since admin verifies
    auditFrom(req, "payment_approved", "payments", payment.id, `order=${order.order_code}`);
    db.run(
      "INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)",
      order.user_id || null,
      "success",
      "Payment Approved",
      `Your payment for order ${order.order_code} has been approved. We're now processing your diamonds.`
    );
    res.redirect(`/admin/payments/${payment.id}?msg=approved`);
  } else if (action === "reject") {
    db.run("UPDATE payments SET status = 'REJECTED', admin_id = ?, reject_reason = ?, reviewed_at = datetime('now') WHERE id = ?", req.session.admin.id, reject_reason || "", payment.id);
    db.run("UPDATE orders SET status = 'PAYMENT_REJECTED', reject_reason = ?, updated_at = datetime('now') WHERE id = ?", reject_reason || "", order.id);
    auditFrom(req, "payment_rejected", "payments", payment.id, `order=${order.order_code}, reason=${reject_reason || ""}`);
    db.run(
      "INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)",
      order.user_id || null,
      "danger",
      "Payment Rejected",
      `Your payment for order ${order.order_code} was rejected: ${reject_reason || "no reason given"}.`
    );
    res.redirect(`/admin/payments/${payment.id}?msg=rejected`);
  } else if (action === "moreinfo") {
    db.run("UPDATE payments SET status = 'MORE_INFO', admin_id = ?, reviewed_at = datetime('now') WHERE id = ?", req.session.admin.id, payment.id);
    db.run("UPDATE orders SET status = 'PAYMENT_UNDER_REVIEW', updated_at = datetime('now') WHERE id = ?", order.id); // back to review
    auditFrom(req, "payment_more_info_requested", "payments", payment.id, `order=${order.order_code}`);
    db.run(
      "INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)",
      order.user_id || null,
      "warning",
      "More Information Needed",
      `We need more information for your payment on order ${order.order_code}.`
    );
    res.redirect(`/admin/payments/${payment.id}?msg=moreinfo`);
  } else {
    res.status(400).send("Unknown action");
  }
});

// ── PACKAGES ──
router.get("/packages", (req, res) => {
  const packages = db.all("SELECT * FROM diamond_packages ORDER BY sort_order, dimes");
  res.render("admin/packages", { packages });
});

router.get("/packages/new", (req, res) => {
  res.render("admin/package-form", { pkg: null, action: "create" });
});

router.get("/packages/:id/edit", (req, res) => {
  const pkg = db.get("SELECT * FROM diamond_packages WHERE id = ?", [req.params.id]);
  if (!pkg) return res.status(404).send("Not found");
  res.render("admin/package-form", { pkg, action: "edit" });
});

router.post("/packages/save", requireRole("super_admin", "manager"), (req, res) => {
  const p = req.body;
  const priceKobo = toKobo(parseFloat(p.price));
  const oldKobo = p.old_price ? toKobo(parseFloat(p.old_price)) : null;
  const game = p.game || "freefire";
  if (p.id) {
    db.run(
      "UPDATE diamond_packages SET game=?, dimes=?, price_kobo=?, old_price_kobo=?, badge=?, active=?, featured=?, sort_order=?, updated_at=datetime('now') WHERE id=?",
      game, parseInt(p.dimes), priceKobo, oldKobo, p.badge || "", p.active ? 1 : 0, p.featured ? 1 : 0, parseInt(p.sort_order) || 0, p.id
    );
    auditFrom(req, "package_edited", "diamond_packages", p.id, `game=${game}, dimes=${p.dimes}, price=${priceKobo}`);
  } else {
    db.run(
      "INSERT INTO diamond_packages (game, dimes, price_kobo, old_price_kobo, badge, active, featured, sort_order) VALUES (?,?,?,?,?,?,?,?)",
      game, parseInt(p.dimes), priceKobo, oldKobo, p.badge || "", p.active ? 1 : 0, p.featured ? 1 : 0, parseInt(p.sort_order) || 0
    );
    auditFrom(req, "package_created", "diamond_packages", "", `game=${game}, dimes=${p.dimes}, price=${priceKobo}`);
  }
  res.redirect("/admin/packages");
});

router.post("/packages/:id/delete", requireRole("super_admin", "manager"), (req, res) => {
  db.run("DELETE FROM diamond_packages WHERE id = ?", [req.params.id]);
  auditFrom(req, "package_deleted", "diamond_packages", req.params.id, "");
  res.redirect("/admin/packages");
});

// ── PAYMENT SETTINGS ──
router.get("/settings/payment", (req, res) => {
  const settings = db.get("SELECT * FROM payment_settings WHERE id = 1") || {};
  res.render("admin/settings-payment", { settings });
});

router.post("/settings/payment", requireRole("super_admin", "manager"), (req, res) => {
  const s = req.body;
  db.run(
    `INSERT INTO payment_settings (id, bank_name, account_name, account_number, instructions, reference_note, min_payment_kobo, max_screenshot_mb, allowed_formats, screenshot_required)
     VALUES (1,?,?,?,?,?,?,?,?,1)
     ON CONFLICT(id) DO UPDATE SET
       bank_name=excluded.bank_name,
       account_name=excluded.account_name,
       account_number=excluded.account_number,
       instructions=excluded.instructions,
       reference_note=excluded.reference_note,
       min_payment_kobo=excluded.min_payment_kobo,
       max_screenshot_mb=excluded.max_screenshot_mb,
       allowed_formats=excluded.allowed_formats`,
    s.bank_name || "GTBank",
    s.account_name || "",
    s.account_number || "",
    s.instructions || "",
    s.reference_note || "",
    toKobo(parseFloat(s.min_payment) || 0),
    parseInt(s.max_screenshot_mb) || 5,
    s.allowed_formats || "jpg,jpeg,png,webp"
  );
  auditFrom(req, "payment_settings_updated", "payment_settings", 1, "bank details changed");
  res.redirect("/admin/settings/payment?msg=saved");
});

// ── CUSTOMERS ──
router.get("/customers", (req, res) => {
  const customers = db.all(
    `SELECT u.*, COUNT(o.id) as orders
     FROM users u LEFT JOIN orders o ON u.id = o.user_id
     GROUP BY u.id ORDER BY u.created_at DESC LIMIT 100`
  );
  res.render("admin/customers", { customers });
});

// ── ADMINS ──
router.get("/admins", requireRole("super_admin"), (req, res) => {
  const admins = db.all("SELECT id, username, full_name, email, role, active, last_login_at, created_at FROM admins ORDER BY created_at");
  res.render("admin/admins", { admins });
});

// ── ACTIVITY LOG ──
router.get("/logs", requireRole("super_admin"), (req, res) => {
  let sql = "SELECT * FROM admin_activity_logs ORDER BY created_at DESC";
  const params = [];
  if (req.query.action) { sql += " WHERE action = ?"; params.push(req.query.action); }
  sql += " LIMIT 200";
  const logs = db.all(sql, params);
  res.render("admin/logs", { logs, query: req.query });
});

// ── HOMEPAGE CMS ──
router.get("/homepage", (req, res) => {
  const hero = db.get("SELECT value FROM homepage_sections WHERE key = 'hero'")?.value;
  const announcementBar = db.get("SELECT value FROM homepage_sections WHERE key = 'announcement_bar'")?.value;
  const heroParsed = hero ? JSON.parse(hero) : {};
  const barParsed = announcementBar ? JSON.parse(announcementBar) : { text: "" };
  res.render("admin/homepage", { hero: heroParsed, announcementBar: barParsed });
});

router.post("/homepage", requireRole("super_admin", "manager"), (req, res) => {
  const h = req.body.hero || {};
  db.run(
    "INSERT INTO homepage_sections (key, value) VALUES ('hero', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    JSON.stringify(h)
  );
  const bar = req.body.announcement_bar || { text: "" };
  db.run(
    "INSERT INTO homepage_sections (key, value) VALUES ('announcement_bar', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    JSON.stringify(bar)
  );
  auditFrom(req, "homepage_updated", "homepage_sections", "", "hero + announcement bar");
  res.redirect("/admin/homepage?msg=saved");
});

// ── ANNOUNCEMENTS ──
router.get("/announcements", (req, res) => {
  const announcements = db.all("SELECT * FROM announcements ORDER BY created_at DESC");
  res.render("admin/announcements", { announcements });
});

router.get("/announcements/new", (req, res) => {
  let a = null;
  if (req.query.id) {
    a = db.get("SELECT * FROM announcements WHERE id = ?", [req.query.id]);
    if (!a) return res.status(404).send("Not found");
  }
  res.render("admin/announcement-form", { a, action: a ? "edit" : "create" });
});

router.post("/announcements/save", requireRole("super_admin", "manager"), (req, res) => {
  const a = req.body;
  if (a.id) {
    db.run(
      "UPDATE announcements SET title=?, body=?, image=?, button_text=?, button_link=?, published=?, scheduled_at=?, expires_at=?, updated_at=datetime('now') WHERE id=?",
      a.title, a.body, a.image || "", a.button_text || "", a.button_link || "", a.published ? 1 : 0, a.scheduled_at || null, a.expires_at || null, a.id
    );
    auditFrom(req, "announcement_edited", "announcements", a.id, a.title);
  } else {
    db.run(
      "INSERT INTO announcements (title, body, image, button_text, button_link, published, scheduled_at, expires_at) VALUES (?,?,?,?,?,?,?,?)",
      a.title, a.body, a.image || "", a.button_text || "", a.button_link || "", a.published ? 1 : 0, a.scheduled_at || null, a.expires_at || null
    );
    auditFrom(req, "announcement_created", "announcements", "", a.title);
  }
  res.redirect("/admin/announcements");
});

// ── BANNERS ──
router.get("/banners", (req, res) => {
  const banners = db.all("SELECT * FROM banners ORDER BY sort_order, start_at DESC");
  res.render("admin/banners", { banners });
});

// ── SITE SETTINGS ──
router.get("/settings/site", requireRole("super_admin"), (req, res) => {
  const settings = {};
  db.all("SELECT key, value FROM site_settings").forEach((row) => { settings[row.key] = row.value; });
  res.render("admin/settings-site", { settings });
});

router.post("/settings/site", requireRole("super_admin"), (req, res) => {
  const s = req.body;
  const upsert = db.prepare("INSERT INTO site_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const keys = ["store_name", "tagline", "currency", "maintenance_mode", "maintenance_message", "notif_email"];
  keys.forEach((k) => {
    const v = k === "maintenance_mode" ? (s[k] ? "1" : "0") : s[k] || "";
    upsert.run(k, v);
  });
  config.maintenanceMode = s.maintenance_mode ? true : false;
  auditFrom(req, "site_settings_updated", "site_settings", "", "maintenance=" + (s.maintenance_mode ? "on" : "off"));
  res.redirect("/admin/settings/site?msg=saved");
});

// ── SUPPORT SETTINGS ──
router.get("/settings/support", (req, res) => {
  const s = db.get("SELECT * FROM support_settings WHERE id = 1") || {};
  let faq = [];
  try { faq = JSON.parse(s.faq_json || "[]"); } catch (_) { faq = []; }
  res.render("admin/settings-support", { support: s, faq });
});

router.post("/settings/support", requireRole("super_admin", "manager"), (req, res) => {
  const s = req.body;
  db.run(
    `INSERT INTO support_settings (id, whatsapp, telegram, email, faq_json) VALUES (1,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET whatsapp=excluded.whatsapp, telegram=excluded.telegram, email=excluded.email, faq_json=excluded.faq_json`,
    s.whatsapp || "",
    s.telegram || "",
    s.email || "",
    JSON.stringify(s.faq || [])
  );
  auditFrom(req, "support_settings_updated", "support_settings", 1, "");
  res.redirect("/admin/settings/support?msg=saved");
});

module.exports = router;
