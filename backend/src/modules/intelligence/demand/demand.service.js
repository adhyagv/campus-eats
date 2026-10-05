const { getDb } = require("../../../config/mongodb");
const { calculateDemand } = require("./demand.engine");

async function getDemand() {
  const orders = await getDb()
    .collection("orders")
    .find({
      status: {
        $nin: ["CANCELLED", "Cancelled"],
      },
    })
    .toArray();

  return calculateDemand(orders);
}

module.exports = {
  getDemand,
};