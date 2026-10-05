const ORDER_STATUS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const VALID_TRANSITIONS = {
  Pending: ["Confirmed", "Preparing", "Cancelled"],
  Confirmed: ["Preparing", "Cancelled"],
  Preparing: ["Ready"],
  Ready: ["Completed"],
  Completed: [],
  Cancelled: [],
};

function normalizeOrderStatus(status) {
  if (typeof status !== "string") return null;
  const normalized = status.trim().toLowerCase();
  return Object.values(ORDER_STATUS).find(
    (candidate) => candidate.toLowerCase() === normalized
  ) || null;
}

function canTransition(currentStatus, nextStatus) {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(nextStatus);
  return Boolean(current && next && VALID_TRANSITIONS[current]?.includes(next));
}

function validateTransition(currentStatus, nextStatus) {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(nextStatus);
  if (!current || !next || !canTransition(current, next)) {
    const error = new Error(
      `Invalid order status transition: ${currentStatus} -> ${nextStatus}`
    );
    error.statusCode = 400;
    throw error;
  }
  return next;
}

module.exports = {
  ORDER_STATUS,
  VALID_TRANSITIONS,
  normalizeOrderStatus,
  canTransition,
  validateTransition,
};