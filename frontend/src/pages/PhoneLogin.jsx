// src/pages/PhoneLogin.jsx
import React, { useState } from "react";
import { db, functions, httpsCallable } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";

import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

// Your function names (sendOtp, checkOtp)
const sendOtpFunction = httpsCallable(functions, 'sendOtp');
const checkOtpFunction = httpsCallable(functions, 'checkOtp');

export default function PhoneLogin() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const showError = (message) => {
    setError(message);
    setTimeout(() => {
      setError("");
    }, 3000);
  };

  const sendOtp = async () => {
    if (!phone || phone.length < 10) {
      showError("Please enter a valid phone number.");
      return;
    }
    setLoading(true);

    try {
      const res = await sendOtpFunction({ phone: phone });
      const data = res.data;
      setRole(data.role); // This will now be "user" or "ranger"
      setStep(2);
    } catch (err) {
      showError("Error sending OTP. Is the number verified in Twilio?");
      console.error(err);
    }
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (!otp || !phone || otp.length < 6) {
      showError("Please enter the 6-digit OTP.");
      return;
    }
    setLoading(true);

    try {
      const res = await checkOtpFunction({ phone: phone, code: otp });
      const data = res.data;

      if (data.success) {
        sessionStorage.setItem("wildwatch_user", phone);

        if (role === "ranger") {
          window.location.href = "/ranger";
        } else {
          // It's a "user", create their document
          const userDocRef = doc(db, "users", phone); 
          await setDoc(userDocRef, {
            phone: phone,
            role: "user", // <-- CHANGED
            createdAt: new Date(),
          });
          window.location.href = "/user"; // <-- CHANGED
        }
      } else {
        showError("Invalid OTP. Please try again.");
      }
    } catch (err) {
      showError("Invalid OTP or server error.");
      console.error(err);
    }
    setLoading(false);
  };

  // ... Your return() JSX stays the same ...
  // (The rest of your login page UI code is perfect)

  return (
    <div className="container">
      {/* Header with Logo */}
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ color: "#2E7D32", fontSize: "2.5em", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span role="img" aria-label="leaf" style={{ marginRight: "10px", fontSize: "0.8em" }}>🌿</span>
          WildWatch
        </h1>
        <p style={{ color: "#666", marginTop: "10px", fontSize: "1.1em" }}>
          Your connection to a safer wildlife environment.
        </p>
      </div>

      {/* Step 1: Enter Phone Number */}
      {step === 1 && (
        <>
          <p style={{ marginBottom: "20px", color: "#666" }}>
            Enter your phone number to receive a one-time password.
          </p>
          
          <PhoneInput
            placeholder="Enter phone number"
            value={phone}
            onChange={setPhone}
            defaultCountry="IN"
            international
            countryCallingCodeEditable={false}
            style={{ marginBottom: "8px" }}
          />

          <button onClick={sendOtp} disabled={loading}>
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </>
      )}

      {/* Step 2: Enter OTP */}
      {step === 2 && (
        <>
          <p style={{ marginBottom: "20px", color: "#666" }}>
            An OTP was sent to {phone}.
          </p>
          <input
            type="text"
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            disabled={loading}
          />
          <button onClick={verifyOtp} disabled={loading}>
            {loading ? "Verifying..." : "Verify & Login"}
          </button>
          <button 
            onClick={() => {setStep(1); setLoading(false); setError("");}}
            style={{ background: "grey", marginTop: "10px" }} 
            disabled={loading}
          >
            Change Number
          </button>
        </>
      )}

      {/* Clean Error Message Display */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "30px", fontSize: "0.85em", color: "#999" }}>
        <p>Powered by Twilio</p>
        <p>&copy; WildWatch 2025</p>
      </div>
    </div>
  );
}