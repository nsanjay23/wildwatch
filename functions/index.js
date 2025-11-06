// Import v2 functions
const {onCall} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Define the secrets our functions need access to
const TWILIO_SECRETS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_VERIFY_SID",
];

// We must initialize the client *after* secrets are defined
// and check if they exist to prevent crashes during analysis
const client = process.env.TWILIO_ACCOUNT_SID ? 
             require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : 
             null;

/**
 * Sends an OTP and checks if the user is a ranger.
 * This is an "onCall" function (v2 syntax).
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
    // 1. Check if this number belongs to a ranger
    const rangersRef = db.collection("rangers");
    const q = rangersRef.where("phone", "==", phone);
    const snapshot = await q.get();

    let role = "user"; // <-- This is your "villager" -> "user" change
    if (!snapshot.empty) {
      role = "ranger";
      logger.info("Ranger found:", phone);
    } else {
      logger.info("User found:", phone); // <-- This is your "villager" -> "user" change
    }

    // 2. Send the OTP via Twilio
    const verification = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SID)
        .verifications.create({to: phone, channel: "sms"});

    // 3. Send back success and the user's role
    return {success: true, role: role, status: verification.status};
  } catch (error) {
    logger.error("Error sending OTP:", error);
    throw new functions.https.HttpsError("unknown", error.message, error);
  }
});

/**
 * Checks the OTP code entered by the user.
 * This is also an "onCall" function (v2 syntax).
 */
exports.checkOtp = onCall({secrets: TWILIO_SECRETS}, async (request) => {
  if (!client) {
    logger.error("Twilio client not initialized. Check secrets.");
    throw new functions.httpsNothing.HttpsError("internal", "Twilio client not initialized.");
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
      logger.info("OTP approved for:", phone);
      return {success: true, status: verificationCheck.status};
    } else {
      logger.warn("OTP incorrect for:", phone);
      return {success: false, status: verificationCheck.status};
    }
  } catch (error) {
    logger.error("Error checking OTP:", error);
    throw new functions.https.HttpsError("unknown", error.message, error);
  }
});