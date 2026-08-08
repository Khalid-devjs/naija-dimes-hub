// ── DB test ────────────────────────────────────────────────────────────
const { db } = require("./db");

const tables = [
  "diamond_packages", "admins", "users", "orders", "payments",
  "notifications", "announcements", "banners", "testimonials",
  "homepage_sections", "payment_settings", "support_settings",
  "site_settings", "admin_activity_logs"
];

let done = 0;
function check() {
  if (++done === tables.length) {
    console.log("[db] ✓ All tables checked. Run npm start to launch the store.");
    db.close();
  }
}

tables.forEach(t => {
  db.get(`SELECT COUNT(*) c FROM ${t}`, (e, row) => {
    console.log(`${t}: ${e ? 'ERROR' : row.c}`);
    check();
  });
});

// check order statuses
const statuses = [
  "PENDING_PAYMENT", "PAYMENT_UNDER_REVIEW", "PAYMENT_CONFIRMED",
  "PROCESSING", "COMPLETED", "PAYMENT_REJECTED", "CANCELLED", "REFUNDED"
];
statuses.forEach(s => {
  db.get("SELECT COUNT(*) c FROM orders WHERE status = ?", [s], (e, row) => {
    console.log(`orders.${s}: ${e ? 'ERROR' : row.c}`);
  });
});

// package badges
const badges = ["popular", "best_value", "promo"];
badges.forEach(b => {
  db.get("SELECT COUNT(*) c FROM diamond_packages WHERE badge = ?", [b], (e, row) => {
    console.log(`badge.${b}: ${e ? 'ERROR' : row.c}`);
  });
});