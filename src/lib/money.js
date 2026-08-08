// ── Money helpers (NGN minor units) ─────────────────────────────────────
// All amounts stored as kobo (1 naira = 100 kobo). Display divides by 100.

const koboToNaira = (k) => (k || 0) / 100;

const formatNaira = (k) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format((k || 0) / 100);

const formatNairaShort = (k) => "₦" + new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format((k || 0) / 100);

const toKobo = (n) => Math.round(Number(n || 0) * 100);

// validate user-entered naira string like "2000", "2,000", "2000.5"
const parseNaira = (s) => {
  const cleaned = String(s || "").replace(/[₦, ]/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return toKobo(parseFloat(cleaned));
};

module.exports = { koboToNaira, formatNaira, formatNairaShort, toKobo, parseNaira };
