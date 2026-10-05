const assert = require("node:assert/strict");
const test = require("node:test");
const { ObjectId } = require("mongodb");
const {
  canTransition,
  validateTransition,
} = require("../src/modules/orders/orderStateMachine");
const { requireRole } = require("../src/middleware/role.middleware");
const { ROLES } = require("../src/common/constants/roles");
const mongodbPath = require.resolve("../src/config/mongodb");
const orderServicePath = require.resolve("../src/modules/orders/order.service");

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("order state machine validates Pending -> Confirmed -> Preparing -> Ready -> Completed", () => {
  assert.equal(canTransition("Pending", "Confirmed"), true);
  assert.equal(canTransition("Confirmed", "Preparing"), true);
  assert.equal(canTransition("Preparing", "Ready"), true);
  assert.equal(canTransition("Ready", "Completed"), true);
  assert.equal(canTransition("CONFIRMED", "Preparing"), true);

  // Completed cannot transition further
  assert.equal(canTransition("Completed", "Ready"), false);
  assert.equal(canTransition("Completed", "Cancelled"), false);
});

test("invalid order status transitions throw 400 error", () => {
  assert.throws(
    () => validateTransition("Pending", "Completed"),
    (err) => err.statusCode === 400 && err.message.includes("Invalid order status transition")
  );
  assert.throws(
    () => validateTransition("Confirmed", "Ready"),
    (err) => err.statusCode === 400
  );
  assert.throws(
    () => validateTransition("Preparing", "Completed"),
    (err) => err.statusCode === 400
  );
  assert.throws(
    () => validateTransition("Completed", "Preparing"),
    (err) => err.statusCode === 400
  );
  assert.throws(
    () => validateTransition("Confirmed", "Accepted"),
    (err) => err.statusCode === 400
  );
});

test("student cannot access /api/orders/all staff endpoint", () => {
  const staffOnly = requireRole(ROLES.ADMIN, ROLES.KITCHEN, ROLES.FACULTY);
  const response = makeResponse();
  let nextCalled = false;

  staffOnly(
    { user: { uid: "student-1", role: ROLES.STUDENT, status: "ACTIVE" } },
    response,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("authenticated Admin and Kitchen can access staff orders endpoint", () => {
  const staffOnly = requireRole(ROLES.ADMIN, ROLES.KITCHEN, ROLES.FACULTY);

  for (const role of [ROLES.ADMIN, ROLES.KITCHEN]) {
    const response = makeResponse();
    let nextCalled = false;

    staffOnly(
      { user: { uid: "staff-1", role, status: "ACTIVE" } },
      response,
      () => {
        nextCalled = true;
      }
    );

    assert.equal(response.statusCode, 200);
    assert.equal(nextCalled, true);
  }
});

function loadOrderService({ initialStatus = "Confirmed", cafeteria = "Cafe PESU" } = {}) {
  const testOrderId = new ObjectId();
  let storedStatus = initialStatus;
  let updateCount = 0;
  const mockOrdersCollection = {
    findOne: async ({ _id }) =>
      _id.equals(testOrderId)
        ? {
            _id: testOrderId,
            userId: "student-uid-123",
            status: storedStatus,
            cafeteria,
            items: [{ name: "Dosa", price: 60, quantity: 1 }],
            total: 60,
          }
        : null,
    findOneAndUpdate: async ({ _id }, { $set }) => {
      if (!_id.equals(testOrderId)) return null;
      storedStatus = $set.status;
      updateCount += 1;
      return {
        _id: testOrderId,
        userId: "student-uid-123",
        status: storedStatus,
        cafeteria,
        updatedAt: $set.updatedAt,
      };
    },
  };

  require.cache[mongodbPath] = {
    exports: {
      getDb: () => ({
        collection: (name) =>
          name === "orders" ? mockOrdersCollection : {},
      }),
    },
  };
  delete require.cache[orderServicePath];
  return {
    orderId: testOrderId.toString(),
    service: require(orderServicePath),
    updateCount: () => updateCount,
  };
}

const pesuKitchen = {
  uid: "kitchen-uid",
  role: ROLES.KITCHEN,
  status: "ACTIVE",
  cafeteria: "PESU Cafe",
  cafeteriaId: "pesucafe",
};

test("status update persists Confirmed -> Preparing -> Ready -> Completed", async () => {
  const { orderId, service } = loadOrderService();

  const preparing = await service.updateOrderStatus(orderId, "Preparing", pesuKitchen);
  assert.equal(preparing.status, "Preparing");
  assert.equal(preparing._id.toString(), orderId);

  const ready = await service.updateOrderStatus(orderId, "Ready", pesuKitchen);
  assert.equal(ready.status, "Ready");

  const completed = await service.updateOrderStatus(orderId, "Completed", pesuKitchen);
  assert.equal(completed.status, "Completed");
});

test("invalid and terminal status transitions are rejected", async () => {
  const { orderId, service } = loadOrderService({ initialStatus: "Preparing" });

  await assert.rejects(
    service.updateOrderStatus(orderId, "Ready for Pickup", pesuKitchen),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    service.updateOrderStatus(orderId, "Completed", pesuKitchen),
    (error) => error.statusCode === 400
  );
});

test("invalid and nonexistent MongoDB order IDs return client errors", async () => {
  const { service } = loadOrderService();

  await assert.rejects(
    service.updateOrderStatus("not-an-object-id", "Preparing", pesuKitchen),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    service.updateOrderStatus(new ObjectId().toString(), "Preparing", pesuKitchen),
    (error) => error.statusCode === 404
  );
});

test("staff cannot update orders assigned to a different cafeteria", async () => {
  const { orderId, service, updateCount } = loadOrderService({
    cafeteria: "Bengaluru Cafe",
  });

  await assert.rejects(
    service.updateOrderStatus(orderId, "Preparing", pesuKitchen),
    (error) => error.statusCode === 403
  );
  assert.equal(updateCount(), 0);
});

test("order status endpoint validates canonical status values", () => {
  const { validateOrderStatus } = require("../src/modules/orders/order.validator");
  const req = { body: { status: "Ready" } };
  let nextCalled = false;
  validateOrderStatus(req, makeResponse(), () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.body.status, "Ready");

  for (const status of ["Ready for Pickup", "Unknown", "Pending"]) {
    const response = makeResponse();
    validateOrderStatus({ body: { status } }, response, () => {
      assert.fail("invalid update status must not proceed");
    });
    assert.equal(response.statusCode, 400);
  }
});
