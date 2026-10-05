const ORDER_STATUS = Object.freeze({
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
});

const VALID_ORDER_STATUS = Object.freeze(Object.values(ORDER_STATUS));

module.exports = {
  ORDER_STATUS,
  VALID_ORDER_STATUS,
};