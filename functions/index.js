const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

// Cloud Function to securely provide ROOK credentials to authenticated users
exports.getRookCredentials = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }
  
  const configDoc = await db.collection("config").doc("rook").get();
  if (!configDoc.exists) {
    throw new functions.https.HttpsError("not-found", "ROOK configuration not found");
  }
  
  return configDoc.data();
});

// Cloud Function to store health data from ROOK
exports.storeHealthData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }
  
  const userId = context.auth.uid;
  const { type, payload } = data;
  
  if (!type || !payload) {
    throw new functions.https.HttpsError("invalid-argument", "Missing type or payload");
  }
  
  await db.collection("users").doc(userId).collection("healthData").doc(type).set({
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  
  return { success: true };
});
