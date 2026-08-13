// ── Database: schema, connection, seed (better-sqlite3, synchronous) ──
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const config = require("./config");

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.uploadsDir, { recursive: true });

const db = new Database(config.dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ──────────────────────────────────────────────────────────────
const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'manager',   -- super_admin | manager | support
  active        INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name       TEXT NOT NULL,
  whatsapp        TEXT NOT NULL,
  email           TEXT,
  password_hash   TEXT,
  freefire_uid    TEXT NOT NULL,
  freefire_nick   TEXT DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS diamond_packages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  game         TEXT NOT NULL DEFAULT 'freefire',
  section      TEXT DEFAULT '',
  title        TEXT DEFAULT '',
  dimes        INTEGER NOT NULL,
  price_kobo   INTEGER NOT NULL,
  old_price_kobo INTEGER,
  badge        TEXT DEFAULT '',
  active       INTEGER NOT NULL DEFAULT 1,
  featured     INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_packages_game ON diamond_packages(game, active);

CREATE TABLE IF NOT EXISTS promo_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  discount_kobo INTEGER NOT NULL DEFAULT 0,
  discount_pct INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  max_uses    INTEGER NOT NULL DEFAULT 0,
  used_count  INTEGER NOT NULL DEFAULT 0,
  starts_at   TEXT,
  expires_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code        TEXT NOT NULL UNIQUE,
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  package_id        INTEGER NOT NULL,
  dimes             INTEGER NOT NULL,
  amount_kobo       INTEGER NOT NULL,
  base_kobo         INTEGER NOT NULL,
  discount_kobo     INTEGER NOT NULL DEFAULT 0,
  promo_code        TEXT DEFAULT '',
  customer_name     TEXT NOT NULL,
  whatsapp          TEXT NOT NULL,
  email             TEXT DEFAULT '',
  freefire_uid      TEXT NOT NULL,
  freefire_nick     TEXT DEFAULT '',
  note              TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  reject_reason     TEXT DEFAULT '',
  internal_notes    TEXT DEFAULT '',
  suspicious        INTEGER NOT NULL DEFAULT 0,
  ip_address        TEXT DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_uid ON orders(freefire_uid);
CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER NOT NULL,
  transaction_ref TEXT NOT NULL UNIQUE,
  sender_name     TEXT DEFAULT '',
  amount_kobo     INTEGER NOT NULL,
  expected_kobo   INTEGER NOT NULL,
  paid_date       TEXT DEFAULT '',
  screenshot_path TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'SUBMITTED',
  admin_id        INTEGER,
  reject_reason   TEXT DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at     TEXT,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY(admin_id) REFERENCES admins(id)
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(transaction_ref);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  type       TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  link       TEXT DEFAULT '',
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS announcements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  body         TEXT DEFAULT '',
  image        TEXT DEFAULT '',
  button_text  TEXT DEFAULT '',
  button_link  TEXT DEFAULT '',
  published    INTEGER NOT NULL DEFAULT 0,
  scheduled_at TEXT,
  expires_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banners (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image       TEXT DEFAULT '',
  link        TEXT DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  start_at    TEXT,
  end_at      TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS testimonials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  text          TEXT NOT NULL,
  rating        INTEGER NOT NULL DEFAULT 5,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS homepage_sections (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  key   TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS payment_settings (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  bank_name           TEXT NOT NULL DEFAULT 'GTBank',
  account_name        TEXT NOT NULL DEFAULT '',
  account_number      TEXT NOT NULL DEFAULT '',
  instructions        TEXT NOT NULL DEFAULT '',
  reference_note      TEXT NOT NULL DEFAULT 'Use your Order ID as the transfer reference',
  min_payment_kobo    INTEGER NOT NULL DEFAULT 0,
  screenshot_required INTEGER NOT NULL DEFAULT 1,
  max_screenshot_mb   INTEGER NOT NULL DEFAULT 5,
  allowed_formats     TEXT NOT NULL DEFAULT 'jpg,jpeg,png,webp'
);

CREATE TABLE IF NOT EXISTS support_settings (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  whatsapp  TEXT NOT NULL DEFAULT '',
  telegram  TEXT NOT NULL DEFAULT '',
  email     TEXT NOT NULL DEFAULT '',
  faq_json  TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    INTEGER,
  admin_name  TEXT DEFAULT '',
  action      TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id   TEXT DEFAULT '',
  details     TEXT DEFAULT '',
  ip          TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON admin_activity_logs(created_at);
`;

db.exec(SCHEMA);
console.log("[db] ✓ Schema ready");

// ── Seed ────────────────────────────────────────────────────────────────
function seed() {
  // admins
  let row = db.prepare("SELECT COUNT(*) c FROM admins").get();
  if (row.c === 0) {
    const hash = bcrypt.hashSync(config.admin.password, 10);
    db.prepare(
      "INSERT INTO admins (username, full_name, email, password_hash, role) VALUES (?,?,?,?, 'super_admin')"
    ).run(config.admin.username, "Super Admin", config.admin.email, hash);
    console.log("[db] ✓ Super admin seeded:", config.admin.username);
  } else {
    console.log("[db] ✓ Admin exists, skipping");
  }

  // packages
  row = db.prepare("SELECT COUNT(*) c FROM diamond_packages").get();
  if (row.c === 0) {
    const packs = [
      // Free Fire (existing)
      [300, 200000], [1000, 500000], [2000, 1000000], [5000, 2500000],
      [10000, 5000000], [20000, 10000000], [30000, 15000000], [40000, 20000000],
      [50000, 25000000], [75000, 37500000], [100000, 50000000],
    ];
    const ins = db.prepare(
      "INSERT INTO diamond_packages (game, section, title, dimes, price_kobo, old_price_kobo, badge, active, featured, sort_order) VALUES (?,?,?,?,?,?,?,1,?,?)"
    );
    packs.forEach(([dimes, price], i) => {
      const badge = dimes === 1000 ? "popular" : dimes === 5000 ? "best_value" : dimes === 100000 ? "promo" : "";
      const featured = dimes === 1000 || dimes === 5000 || dimes === 10000 ? 1 : 0;
      const old = dimes === 1000 ? 550000 : dimes === 2000 ? 1100000 : null;
      ins.run("freefire", "", "", dimes, price, old, badge, featured, i + 1);
    });
    console.log("[db] ✓ 11 Free Fire packages seeded (editable in admin)");

    // Blood Strike — two sections: Gold + Passes
    const bsItems = [
      // section, title, gold, price₦, old₦, badge, featured
      ["Gold", "", 100, 750, 1500, "", 0],
      ["Gold", "", 500, 3750, 7500, "popular", 1],
      ["Gold", "", 1000, 7500, 15000, "best_value", 1],
      ["Gold", "", 2000, 15000, 30000, "", 0],
      ["Passes", "Level-Up Pass", 0, 1500, 3000, "", 0],
      ["Passes", "Strike Pass Elite", 0, 3000, 6000, "popular", 0],
    ];
    bsItems.forEach(([section, title, dimes, price, old, badge, featured], i) => {
      ins.run("bloodstrike", section, title, dimes, price * 100, old * 100, badge, featured, i + 1);
    });
    console.log("[db] ✓ Blood Strike packages seeded (Gold + Passes)");

    // Call of Duty Mobile starter packs
    const codmPacks = [
      [88, 825], [160, 825], [460, 4100], [960, 8250], [2600, 20500],
      [5400, 41250], [11600, 82500], [23200, 160875], [34800, 239250], [58000, 387750],
    ];
    const codmBadge = { 460: "popular", 960: "best_value", 5400: "promo", 23200: "premium", 58000: "mega" };
    codmPacks.forEach(([dimes, price], i) => {
      const badge = codmBadge[dimes] || "";
      const featured = [460, 960, 5400, 58000].includes(dimes) ? 1 : 0;
      const old = Math.round(price * 2); // 50% OFF shown on source
      ins.run("codm", "", "", dimes, price * 100, old * 100, badge, featured, i + 1);
    });
    console.log("[db] ✓ Call of Duty Mobile packages seeded (10 CP tiers)");

    // MadOut2 — two sections: Gems + Passes
    const madItems = [
      // section, title, gems, price₦, old₦, badge, featured
      ["Gems", "", 35, 375, 750, "", 0],
      ["Gems", "", 240, 2250, 4500, "popular", 1],
      ["Gems", "", 850, 7500, 15000, "best_value", 1],
      ["Gems", "", 1750, 15000, 30000, "", 0],
      ["Gems", "", 4700, 37500, 75000, "promo", 0],
      ["Passes", "Elite Pass", 0, 2250, 4500, "popular", 0],
      ["Passes", "Elite+ Pass", 0, 7500, 15000, "premium", 0],
    ];
    madItems.forEach(([section, title, dimes, price, old, badge, featured], i) => {
      ins.run("madout2", section, title, dimes, price * 100, old * 100, badge, featured, i + 1);
    });
    console.log("[db] ✓ MadOut2 packages seeded (Gems + Passes)");

    // OneState RP — two sections: Passes + State Coins
    const osItems = [
      // section, title, dimes(coins), price₦, old₦, badge, featured
      ["Passes", "Gang Season Pass V3", 0, 2450, 4900, "best_value", 1],
      ["Passes", "Event Premium Pass", 0, 1600, 3200, "popular", 0],
      ["State Coins", "State Coins Pack 1", 1000, 1600, 3200, "", 0],
      ["State Coins", "State Coins Pack 2", 5000, 3950, 7900, "popular", 0],
      ["State Coins", "State Coins Pack 3", 12000, 7450, 14900, "best_value", 1],
      ["State Coins", "State Coins Pack 6", 200000, 74950, 149900, "premium", 0],
    ];
    osItems.forEach(([section, title, dimes, price, old, badge, featured], i) => {
      ins.run("onestate", section, title, dimes, price * 100, old * 100, badge, featured, i + 1);
    });
    console.log("[db] ✓ OneState RP packages seeded (Passes + State Coins)");
  } else {
    console.log("[db] ✓ Packages exist, skipping");
  }

  // payment settings
  row = db.prepare("SELECT COUNT(*) c FROM payment_settings").get();
  if (row.c === 0) {
    db.prepare(
      "INSERT INTO payment_settings (bank_name, account_name, account_number, instructions, reference_note) VALUES (?,?,?,?,?)"
    ).run(
      "GTBank", "NAIJA DIMES HUB", "0000000000",
      "1. Open your banking app.\n2. Transfer the exact amount shown.\n3. Complete the transaction.\n4. Save your payment receipt.\n5. Return to Naija Dimes Hub.\n6. Upload your payment screenshot.\n7. Submit your payment for verification.\n8. Wait for admin approval.",
      "Use your Order ID as the transfer reference"
    );
    console.log("[db] ✓ Payment settings seeded (EDIT bank details in admin!)");
  } else {
    console.log("[db] ✓ Payment settings exist, skipping");
  }

  // support settings
  row = db.prepare("SELECT COUNT(*) c FROM support_settings").get();
  if (row.c === 0) {
    db.prepare(
      "INSERT INTO support_settings (whatsapp, telegram, email, faq_json) VALUES (?,?,?,?)"
    ).run(
      "", "", "support@naijadimeshub.com",
      JSON.stringify([
        { q: "How long does delivery take?", a: "Diamonds are delivered within minutes to a few hours after your payment is approved." },
        { q: "Is bank transfer the only payment method?", a: "Yes — pay by bank transfer, upload your receipt, and our admin verifies it manually." },
        { q: "Which server does my UID need to be on?", a: "Send diamonds to the UID you specified. Double-check it — diamonds cannot be reversed once sent." },
      ])
    );
    console.log("[db] ✓ Support settings seeded");
  } else {
    console.log("[db] ✓ Support settings exist, skipping");
  }

  // homepage sections
  row = db.prepare("SELECT COUNT(*) c FROM homepage_sections").get();
  if (row.c === 0) {
    const hero = {
      heading: "Get Your Free Fire Diamonds Fast ⚡",
      description: "Buy your diamonds easily with secure bank transfer payment and track your order from start to finish.",
      button_primary: "BUY DIMES",
      button_secondary: "TRACK ORDER",
    };
    db.prepare("INSERT INTO homepage_sections (key, value) VALUES ('hero', ?)").run(JSON.stringify(hero));
    db.prepare("INSERT INTO homepage_sections (key, value) VALUES ('announcement_bar', ?)").run(JSON.stringify({ text: "" }));
    console.log("[db] ✓ Homepage sections seeded");
  } else {
    console.log("[db] ✓ Homepage sections exist, skipping");
  }

  // site settings
  row = db.prepare("SELECT COUNT(*) c FROM site_settings").get();
  if (row.c === 0) {
    const sets = [
      ["store_name", "Naija Top Up Store"],
      ["tagline", "Fast. Simple. Reliable."],
      ["currency", "₦"],
      ["maintenance_mode", "0"],
      ["maintenance_message", "We're doing some maintenance. Check back soon!"],
      ["notif_email", "0"],
    ];
    const ins = db.prepare("INSERT INTO site_settings (key, value) VALUES (?,?)");
    sets.forEach(([k, v]) => ins.run(k, v));
    console.log("[db] ✓ Site settings seeded");
  } else {
    console.log("[db] ✓ Site settings exist, skipping");
  }

  row = db.prepare("SELECT COUNT(*) c FROM admins").get();
  if (row.c > 0) console.log("\n[db] ✓ Database ready. Admin:", config.admin.username, "/ pass: " + config.admin.password);
}

seed();

// ── Convenience wrappers (routes call db.all/db.get/db.run directly) ──
// Routes pass params as an array: db.get(sql, [a, b]) — normalize to spread args.
const spread = (params) => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
db.all = (sql, ...params) => db.prepare(sql).all(...spread(params));
db.get = (sql, ...params) => db.prepare(sql).get(...spread(params));
db.run = (sql, ...params) => db.prepare(sql).run(...spread(params));

module.exports = db;
