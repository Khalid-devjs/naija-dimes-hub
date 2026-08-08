// ── Order ID generation: NDH-YYYYMMDD-XXXX ──────────────────────────────
const crypto = require("crypto");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randCode(len = 4) {
  let out = "";
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function dateStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function generateOrderCode(db) {
  for (let i = 0; i < 20; i++) {
    const code = `NDH-${dateStamp()}-${randCode(4)}`;
    const exists = db.prepare("SELECT 1 FROM orders WHERE order_code = ?").get(code);
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique order code");
}

module.exports = { generateOrderCode, randCode, dateStamp };
