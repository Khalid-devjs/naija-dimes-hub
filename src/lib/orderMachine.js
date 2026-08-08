// ── Order state machine ─────────────────────────────────────────────────
// Strict transitions only — no unauthorized jumps.

const STATES = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAYMENT_UNDER_REVIEW: "PAYMENT_UNDER_REVIEW",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  PAYMENT_REJECTED: "PAYMENT_REJECTED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
};

const LABELS = {
  PENDING_PAYMENT: "Payment Pending",
  PAYMENT_UNDER_REVIEW: "Payment Under Review",
  PAYMENT_CONFIRMED: "Payment Confirmed",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  PAYMENT_REJECTED: "Payment Rejected",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

// actor: 'customer' | 'admin'
const TRANSITIONS = {
  PENDING_PAYMENT: { customer: ["CANCELLED"], admin: ["CANCELLED"] },
  PAYMENT_UNDER_REVIEW: {
    customer: [], // customer cannot touch while under review
    admin: ["PAYMENT_CONFIRMED", "PAYMENT_REJECTED", "CANCELLED"],
  },
  PAYMENT_CONFIRMED: { customer: [], admin: ["PROCESSING", "CANCELLED", "REFUNDED"] },
  PROCESSING: { customer: [], admin: ["COMPLETED", "CANCELLED", "REFUNDED"] },
  COMPLETED: { customer: [], admin: ["REFUNDED"] },
  PAYMENT_REJECTED: { customer: ["PAYMENT_UNDER_REVIEW"], admin: ["CANCELLED", "PAYMENT_UNDER_REVIEW"] }, // resubmit
  CANCELLED: { customer: [], admin: [] },
  REFUNDED: { customer: [], admin: [] },
};

function canTransition(from, to, actor) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from][actor]?.includes(to));
}

function assertTransition(from, to, actor) {
  if (!canTransition(from, to, actor)) {
    const err = new Error(`Illegal status transition ${from} → ${to} (${actor})`);
    err.code = "ILLEGAL_TRANSITION";
    throw err;
  }
}

module.exports = { STATES, LABELS, TRANSITIONS, canTransition, assertTransition };
