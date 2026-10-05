const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getCafeteriaAliases,
  resolveCafeteria,
} = require("../src/common/constants/cafeteria");

test("PESU cafeteria name aliases resolve to the canonical menu identity", () => {
  assert.deepEqual(resolveCafeteria("PESU Cafe"), {
    id: "pesucafe",
    name: "Cafe PESU",
  });
  assert.deepEqual(getCafeteriaAliases("PESU Cafe", "pesucafe"), [
    "Cafe PESU",
    "PESU Cafe",
  ]);
});

test("known Bengaluru and non-veg cafeteria aliases resolve canonically", () => {
  assert.deepEqual(resolveCafeteria("Main Cafeteria"), {
    id: "bengaluru",
    name: "Bengaluru Cafe",
  });
  assert.deepEqual(resolveCafeteria("Nonveg"), {
    id: "nonveg",
    name: "Non-Veg Cafeteria",
  });
});

test("staff order query includes canonical IDs and legacy cafeteria names", async () => {
  const mongodbPath = require.resolve("../src/config/mongodb");
  const orderServicePath = require.resolve("../src/modules/orders/order.service");
  let capturedQuery;
  const storedOrders = [
    {
      _id: "canonical",
      cafeteria: "Cafe PESU",
      cafeteriaId: "pesucafe",
      items: [{ cafeteria: "Cafe PESU" }],
    },
    {
      _id: "legacy-alias",
      cafeteria: "Bengaluru Cafe",
      items: [{ cafeteria: "PESU Cafe" }],
    },
    {
      _id: "mixed-cafeterias",
      cafeteria: "Cafe PESU",
      items: [
        { cafeteria: "Cafe PESU" },
        { cafeteria: "Bengaluru Cafe" },
      ],
    },
    {
      _id: "wrong-explicit-id",
      cafeteria: "Cafe PESU",
      cafeteriaId: "bengaluru",
      items: [{ cafeteria: "Cafe PESU" }],
    },
  ];

  require.cache[mongodbPath] = {
    exports: {
      getDb: () => ({
        collection: () => ({
          find(query) {
            capturedQuery = query;
            return {
              sort() {
                return this;
              },
              toArray: async () => storedOrders,
            };
          },
        }),
      }),
    },
  };
  delete require.cache[orderServicePath];

  try {
    const orderService = require(orderServicePath);
    const orders = await orderService.getAllOrders("PESU Cafe", "pesucafe");

    assert.ok(
      capturedQuery.$or.some((condition) => condition.cafeteriaId === "pesucafe")
    );
    assert.ok(
      capturedQuery.$or.some((condition) =>
        condition.cafeteria?.$in?.some(
          (value) => value instanceof RegExp && value.test("Cafe PESU")
        )
      )
    );
    assert.deepEqual(
      orders.map((order) => order._id),
      ["canonical", "legacy-alias"]
    );
    assert.ok(
      capturedQuery.$or.some((condition) =>
        condition["items.cafeteria"]?.$in?.some(
          (value) => value instanceof RegExp && value.test("PESU Cafe")
        )
      )
    );
  } finally {
    delete require.cache[orderServicePath];
    delete require.cache[mongodbPath];
  }
});
