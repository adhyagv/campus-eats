const {
  initializeApp,
  getApps,
  cert,
} = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");

const config = require("./env");

function normalizeFirebaseValue(value) {
  if (typeof value !== "string") return undefined;

  let normalized = value.trim();
  normalized = normalized.replace(/,$/, "").trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized.replace(/\\n/g, "\n").replace(/,$/, "").trim();
  return normalized || undefined;
}

const projectId = normalizeFirebaseValue(config.firebase.projectId);
const clientEmail = normalizeFirebaseValue(config.firebase.clientEmail);
const privateKey = normalizeFirebaseValue(config.firebase.privateKey);
const databaseURL = normalizeFirebaseValue(config.firebase.databaseURL);

const hasFirebaseConfig = Boolean(projectId && clientEmail && privateKey);

if (!hasFirebaseConfig) {
  throw new Error(
    "Firebase Admin initialization requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY"
  );
}

const firebaseOptions = {
  projectId,
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
};

if (databaseURL) {
  firebaseOptions.databaseURL = databaseURL;
}

const existingDefaultApp = getApps().find((app) => app.name === "[DEFAULT]");
if (existingDefaultApp && existingDefaultApp.options.projectId !== projectId) {
  throw new Error(
    "Firebase Admin default app was initialized for a different project"
  );
}

const firebaseApp = existingDefaultApp || initializeApp(firebaseOptions);
const auth = getAuth(firebaseApp);
const realtimeDb = databaseURL ? getDatabase(firebaseApp) : null;

module.exports = {
  firebaseApp,
  auth,
  realtimeDb,
};