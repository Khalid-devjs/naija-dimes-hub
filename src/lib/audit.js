// ── Admin activity logging ──────────────────────────────────────────────
const db = require("../db");

function logActivity({ adminId = null, adminName = "", action, targetType = "", targetId = "", details = "", ip = "" }) {
  try {
    db.prepare(
      `INSERT INTO admin_activity_logs (admin_id, admin_name, action, target_type, target_id, details, ip)
       VALUES (?,?,?,?,?,?,?)`
    ).run(adminId, adminName, action, targetType, String(targetId ?? ""), String(details ?? ""), ip || "");
  } catch (e) {
    console.error("[audit] failed to log activity:", e.message);
  }
}

// convenience: log from an Express request (res.locals.admin + req.ip)
function auditFrom(req, action, targetType = "", targetId = "", details = "") {
  const admin = req.session?.admin;
  logActivity({
    adminId: admin?.id ?? null,
    adminName: admin?.username ?? "",
    action,
    targetType,
    targetId,
    details,
    ip: req.ip || req.socket?.remoteAddress || "",
  });
}

module.exports = { logActivity, auditFrom };
