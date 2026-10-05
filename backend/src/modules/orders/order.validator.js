const {
  VALID_ORDER_STATUS,
  ORDER_STATUS,
} = require("../../common/constants/orderStatus");

function validateCreateOrder(req, res, next) {
  const { notes } = req.body;

  if (notes !== undefined && typeof notes !== "string") {
    return res.status(400).json({
      status: "error",
      message: "notes must be a string",
    });
  }

  next();
}

function validateOrderStatus(req, res, next) {
  const { status } = req.body;

  if (typeof status !== "string" || !status.trim()) {
    return res.status(400).json({
      status: "error",
      message: "status is required",
    });
  }

  const canonical = VALID_ORDER_STATUS.find(
    (candidate) => candidate.toLowerCase() === status.trim().toLowerCase()
  );
  if (!canonical || canonical === ORDER_STATUS.PENDING) {
    const validStatuses = VALID_ORDER_STATUS
      .filter((value) => value !== ORDER_STATUS.PENDING)
      .join(", ");
    return res.status(400).json({
      status: "error",
      message: `status must be one of: ${validStatuses}`,
    });
  }

  req.body.status = canonical;
  next();
}

module.exports = {
  validateCreateOrder,
  validateOrderStatus,
};