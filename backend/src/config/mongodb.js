const { MongoClient, ObjectId } = require("mongodb");
const config = require("./env");

let client;
let db;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getNestedValue(record, path) {
  if (!path || !record) return undefined;
  return path.split(".").reduce((current, segment) => {
    if (current == null) return undefined;
    if (segment === "$") return current;
    return current[segment];
  }, record);
}

function normalizeComparableValue(value) {
  if (value instanceof ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function valueMatches(actual, expected) {
  if (expected instanceof RegExp) {
    return expected.test(String(actual ?? ""));
  }

  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    if (Object.prototype.hasOwnProperty.call(expected, "$regex")) {
      return new RegExp(expected.$regex).test(String(actual ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(expected, "$in")) {
      return expected.$in.some((entry) => normalizeComparableValue(actual) === normalizeComparableValue(entry));
    }
    if (Object.prototype.hasOwnProperty.call(expected, "$ne")) {
      return normalizeComparableValue(actual) !== normalizeComparableValue(expected.$ne);
    }
    if (Object.prototype.hasOwnProperty.call(expected, "$gt")) {
      return Number(actual) > Number(expected.$gt);
    }
    if (Object.prototype.hasOwnProperty.call(expected, "$gte")) {
      return Number(actual) >= Number(expected.$gte);
    }
    if (Object.prototype.hasOwnProperty.call(expected, "$lt")) {
      return Number(actual) < Number(expected.$lt);
    }
    if (Object.prototype.hasOwnProperty.call(expected, "$lte")) {
      return Number(actual) <= Number(expected.$lte);
    }
    if (Object.prototype.hasOwnProperty.call(expected, "$exists")) {
      const exists = actual !== undefined && actual !== null;
      return exists === Boolean(expected.$exists);
    }
    return false;
  }

  if (Array.isArray(expected)) {
    return expected.some((entry) => normalizeComparableValue(actual) === normalizeComparableValue(entry));
  }

  return normalizeComparableValue(actual) === normalizeComparableValue(expected);
}

function queryMatches(record, query) {
  if (!query || !isPlainObject(query)) {
    return true;
  }

  if (Array.isArray(query.$or)) {
    return query.$or.some((subQuery) => queryMatches(record, subQuery));
  }

  if (Array.isArray(query.$and)) {
    return query.$and.every((subQuery) => queryMatches(record, subQuery));
  }

  for (const [key, expected] of Object.entries(query)) {
    if (key === "$or" || key === "$and") continue;

    const actualValue = getNestedValue(record, key);
    if (!valueMatches(actualValue, expected)) {
      return false;
    }
  }

  return true;
}

function ensureId(doc) {
  const value = { ...doc };
  if (!value._id) {
    value._id = new ObjectId();
  }
  return value;
}

function applyUpdate(record, update) {
  if (!update || !isPlainObject(update)) return record;

  if (update.$set && isPlainObject(update.$set)) {
    for (const [key, value] of Object.entries(update.$set)) {
      if (key.includes(".")) {
        const segments = key.split(".");
        let cursor = record;
        for (let i = 0; i < segments.length - 1; i += 1) {
          const segment = segments[i];
          if (cursor[segment] == null || typeof cursor[segment] !== "object") {
            cursor[segment] = {};
          }
          cursor = cursor[segment];
        }
        cursor[segments[segments.length - 1]] = value;
      } else {
        record[key] = value;
      }
    }
  }

  if (update.$inc && isPlainObject(update.$inc)) {
    for (const [key, amount] of Object.entries(update.$inc)) {
      if (key.includes(".")) {
        const segments = key.split(".");
        let cursor = record;
        for (let i = 0; i < segments.length - 1; i += 1) {
          const segment = segments[i];
          if (!Array.isArray(cursor[segment])) {
            cursor[segment] = {};
          }
          cursor = cursor[segment];
        }
        const lastSegment = segments[segments.length - 1];
        const currentValue = Number(cursor[lastSegment] ?? 0);
        cursor[lastSegment] = currentValue + Number(amount || 0);
      } else {
        record[key] = Number(record[key] ?? 0) + Number(amount || 0);
      }
    }
  }

  if (update.$push && isPlainObject(update.$push)) {
    for (const [key, value] of Object.entries(update.$push)) {
      if (!Array.isArray(record[key])) {
        record[key] = [];
      }
      record[key].push(value);
    }
  }

  if (update.$unset && isPlainObject(update.$unset)) {
    for (const key of Object.keys(update.$unset)) {
      delete record[key];
    }
  }

  return record;
}

function createMemoryCollection(initialDocs = []) {
  const documents = [...initialDocs];

  return {
    async createIndex() {
      return null;
    },

    async findOne(query = {}) {
      return documents.find((doc) => queryMatches(doc, query)) || null;
    },

    async findOneAndUpdate(query, update, options = {}) {
      const doc = documents.find((candidate) => queryMatches(candidate, query));
      if (!doc) return null;
      applyUpdate(doc, update);
      if (options.returnDocument === "after") {
        return doc;
      }
      return doc;
    },

    async insertOne(document) {
      const normalized = ensureId(document);
      documents.push(normalized);
      return {
        acknowledged: true,
        insertedId: normalized._id,
      };
    },

    async updateOne(query, update) {
      const matches = documents.filter((doc) => queryMatches(doc, query));
      for (const doc of matches) {
        applyUpdate(doc, update);
      }
      return {
        acknowledged: true,
        matchedCount: matches.length,
        modifiedCount: matches.length,
      };
    },

    async deleteOne(query) {
      const index = documents.findIndex((doc) => queryMatches(doc, query));
      if (index === -1) {
        return { deletedCount: 0 };
      }
      documents.splice(index, 1);
      return { deletedCount: 1 };
    },

    find(query = {}) {
      const items = documents.filter((doc) => queryMatches(doc, query));
      return {
        sort(spec = {}) {
          const entries = Object.entries(spec);
          const sorted = [...items].sort((left, right) => {
            for (const [field, direction] of entries) {
              const modifier = direction === -1 ? -1 : 1;
              const leftValue = left[field];
              const rightValue = right[field];
              if (leftValue == null && rightValue == null) continue;
              if (leftValue == null) return 1;
              if (rightValue == null) return -1;
              if (leftValue > rightValue) return modifier;
              if (leftValue < rightValue) return -modifier;
            }
            return 0;
          });
          return {
            toArray: () => sorted,
          };
        },
        toArray() {
          return items;
        },
      };
    },
  };
}

function createDemoDatabase() {
  const now = new Date();
  const demoMenuItems = [
    {
      _id: new ObjectId("64b6c06d1a00000000000001"),
      name: "Masala Dosa",
      price: 60,
      available: true,
      cafeteria: "Bengaluru Cafe",
      category: "Breakfast",
      description: "Demo item",
      imageUrl: "",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId("64b6c06d1a00000000000002"),
      name: "Veg Biryani",
      price: 120,
      available: true,
      cafeteria: "Bengaluru Cafe",
      category: "Lunch",
      description: "Demo item",
      imageUrl: "",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const collections = new Map([
    [
      "users",
      createMemoryCollection([
        {
          _id: new ObjectId("64b6c06d1a00000000000010"),
          uid: "demo-student-1",
          studentId: "demo-student-1",
          name: "Demo Student",
          program: "B.Tech",
          status: "ACTIVE",
          role: "Student",
        },
      ]),
    ],
    ["carts", createMemoryCollection([])],
    ["menu", createMemoryCollection(demoMenuItems)],
    ["orders", createMemoryCollection([])],
    ["payments", createMemoryCollection([])],
    ["studentRegistry", createMemoryCollection([])],
    ["campusAccessProofs", createMemoryCollection([])],
    ["reviews", createMemoryCollection([])],
    ["campusCheckinChallenges", createMemoryCollection([])],
  ]);

  return {
    collection(name) {
      if (!collections.has(name)) {
        collections.set(name, createMemoryCollection([]));
      }
      return collections.get(name);
    },
    command: async () => ({ ok: 1 }),
  };
}

async function connectMongoDB() {
  if (!config.mongodb.uri) {
    console.warn("MONGODB_URI is not configured; starting with local demo database.");
    db = createDemoDatabase();
    return db;
  }

  if (!config.mongodb.dbName) {
    console.warn("MONGODB_DB_NAME is not configured; starting with local demo database.");
    db = createDemoDatabase();
    return db;
  }

  try {
    client = new MongoClient(config.mongodb.uri, {
      serverSelectionTimeoutMS: 10000,
    });

    await client.connect();
    db = client.db(config.mongodb.dbName);
    await db.command({ ping: 1 });
    console.log("MongoDB connected successfully");
    return db;
  } catch (error) {
    if (client) {
      await client.close().catch(() => {});
    }
    client = null;
    db = null;
    throw error;
  }
}

function getDb() {
  if (!db) {
    db = createDemoDatabase();
  }
  return db;
}

async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
  }
  db = null;
}

module.exports = {
  connectMongoDB,
  getDb,
  closeMongoDB,
};