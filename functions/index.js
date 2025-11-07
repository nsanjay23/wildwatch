// functions/index.js
const {onCall} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

initializeApp();
const db = getFirestore();

// Define secrets
const TWILIO_SECRETS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_VERIFY_SID",
];

// Initialize Twilio client
const client = process.env.TWILIO_ACCOUNT_SID ?
             require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) :
             null;

/**
 * Checks if a number is a ranger or user.
 * If user, sends an OTP.
 * If ranger, does nothing but confirms the role.
 */
exports.sendOtp = onCall({secrets: TWILIO_SECRETS}, async (request) => {
  if (!client) {
    logger.error("Twilio client not initialized. Check secrets.");
    throw new functions.https.HttpsError("internal", "Twilio client not initialized.");
  }

  const phone = request.data.phone;
  if (!phone) {
    throw new functions.https.HttpsError("invalid-argument", "Phone number is required.");
  }

  try {
    const rangersRef = db.collection("rangers");
    const q = rangersRef.where("phone", "==", phone);
    const snapshot = await q.get();

    if (!snapshot.empty) {
      // --- THIS IS A RANGER ---
      logger.info("Ranger found:", phone);
      // We DON'T send an OTP. Just tell the frontend it's a ranger.
      return {success: true, role: "ranger"};
    } else {
      // --- THIS IS A USER ---
      logger.info("User found, sending OTP:", phone);
      
      const verification = await client.verify.v2
          .services(process.env.TWILIO_VERIFY_SID)
          .verifications.create({to: phone, channel: "sms"});

      return {success: true, role: "user", status: verification.status};
    }
  } catch (error) {
    logger.error("Error in sendOtp:", error);
    throw new functions.https.HttpsError("unknown", error.message, error);
  }
});

/**
 * Checks the User's OTP code.
 * (This function is unchanged)
 */
exports.checkOtp = onCall({secrets: TWILIO_SECRETS}, async (request) => {
  // ... (code for checkOtp is exactly the same as before)
  if (!client) {
    logger.error("Twilio client not initialized.");
    throw new functions.https.HttpsError("internal", "Twilio client not initialized.");
  }
  const {phone, code} = request.data;
  if (!phone || !code) {
    throw new functions.https.HttpsError("invalid-argument", "Phone and code are required.");
  }
  try {
    const verificationCheck = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SID)
        .verificationChecks.create({to: phone, code: code});
    if (verificationCheck.status === "approved") {
      return {success: true, status: verificationCheck.status};
    } else {
      return {success: false, status: verificationCheck.status};
    }
  } catch (error) {
    logger.error("Error checking OTP:", error);
    throw new functions.https.HttpsError("unknown", error.message, error);
  }
});


/**
 * --- NEW FUNCTION ---
 * Verifies a ranger's password (insecurely, for demo only).
 */
exports.verifyRangerPassword = onCall(async (request) => {
  const {phone, password} = request.data;
  if (!phone || !password) {
    throw new functions.https.HttpsError("invalid-argument", "Phone and password are required.");
  }

  try {
    const rangersRef = db.collection("rangers");
    const q = rangersRef.where("phone", "==", phone);
    const snapshot = await q.get();

    if (snapshot.empty) {
      return {success: false, error: "Not a ranger."};
    }

    const rangerDoc = snapshot.docs[0].data();

    // WARNING: In a real app, NEVER store plain text passwords.
    // This is for demo purposes only. Use bcrypt in a real app.
    if (rangerDoc.password === password) {
      logger.info("Ranger password verified for:", phone);
      return {success: true};
    } else {
      logger.warn("Ranger password FAILED for:", phone);
      return {success: false, error: "Invalid password"};
    }
  } catch (error) {
    logger.error("Error verifying password:", error);
    throw new functions.https.HttpsError("unknown", error.message, error);
  }
});