require("dotenv").config();

const { connectMongoDB, getDb, closeMongoDB } = require("../src/config/mongodb");

const NON_VEG_MENU_ITEMS = [
  {
    name: "Chicken 65",
    description: "Crispy spiced chicken bites served hot",
    price: 110,
    category: "Non-Veg",
    cafeteria: "Non-Veg Cafeteria",
    imageUrl: "assets/images/food/chicken_65.jpg",
    available: true,
  },
  {
    name: "Chicken Meal",
    description: "Chicken curry served with rice and a side",
    price: 150,
    category: "Non-Veg",
    cafeteria: "Non-Veg Cafeteria",
    imageUrl: "assets/images/food/chicken_biryani.jpg",
    available: true,
  },
];

async function seedNonVegMenu() {
  await connectMongoDB();
  const collection = getDb().collection("menu");
  let inserted = 0;

  for (const item of NON_VEG_MENU_ITEMS) {
    const now = new Date();
    const result = await collection.updateOne(
      {
        name: item.name,
        cafeteria: item.cafeteria,
      },
      {
        $setOnInsert: {
          ...item,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
    inserted += result.upsertedCount;
  }

  const biryaniImage = await collection.updateOne(
    {
      name: "Chicken Biryani",
      cafeteria: "Non-Veg Cafeteria",
      $or: [{ imageUrl: "" }, { imageUrl: { $exists: false } }],
    },
    { $set: { imageUrl: "assets/images/food/chicken_biryani.jpg" } }
  );

  const visibleItems = await collection
    .find(
      { cafeteria: "Non-Veg Cafeteria", available: { $ne: false } },
      { projection: { _id: 0, name: 1 } }
    )
    .sort({ name: 1 })
    .toArray();

  console.log(
    JSON.stringify({
      inserted,
      existingImagesUpdated: biryaniImage.modifiedCount,
      availableNonVegItems: visibleItems.map((item) => item.name),
    })
  );
}

seedNonVegMenu()
  .catch((error) => {
    console.error("Non-veg menu seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoDB();
  });
