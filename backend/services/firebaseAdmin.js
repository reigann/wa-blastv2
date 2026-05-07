const admin = require('firebase-admin');
const fs = require('fs');

let initialized = false;

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const raw = fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
    return JSON.parse(raw);
  }

  return null;
}

function getFirebaseApp() {
  if (initialized && admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    throw new Error('Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in backend .env');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
  return admin.app();
}

function getFirestore() {
  getFirebaseApp();
  return admin.firestore();
}

module.exports = { admin, getFirebaseApp, getFirestore };
