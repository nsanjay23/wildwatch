import React, { useState } from "react";
import { db, functions, httpsCallable } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

// Get the callable functions
const sendOtpFunction = httpsCallable(functions, 'sendOtp');
const checkOtpFunction = httpsCallable(functions, 'checkOtp');
const verifyRangerPasswordFunction = httpsCallable(functions, 'verifyRangerPassword');

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1); // 1: Phone, 2: Password, 3: OTP
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const showError = (message) => {
    setError(message);
    setTimeout(() => { setError(""); }, 3000);
  };

  // Step 1: Check the phone number
  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 10) {
      showError("Please enter a valid phone number.");
      return;
    }
    setLoading(true);

    try {
      const res = await sendOtpFunction({ phone: phone });
      const data = res.data;
      
      if (data.role === "ranger") {
        setRole("ranger");
        setStep(2); // Go to Password step
      } else {
        setRole("user");
        setStep(3); // Go to OTP step
      }
    } catch (err) {
      showError("Error processing phone number.");
      console.error(err);
    }
    setLoading(false);
  };

  // Step 2 (Ranger): Verify password
  const handlePasswordSubmit = async () => {
    if (!password) {
      showError("Please enter your password.");
      return;
    }
    setLoading(true);

    try {
      const res = await verifyRangerPasswordFunction({ phone, password });
      const data = res.data;

      if (data.success) {
        sessionStorage.setItem("wildwatch_user", phone);
        window.location.href = "/ranger";
      } else {
        showError("Invalid password. Please try again.");
      }
    } catch (err) {
      showError("Login error. Please try again.");
      console.error(err);
    }
    setLoading(false);
  };

  // Step 2 (User): Verify OTP
  const handleOtpSubmit = async () => {
    if (!otp || otp.length < 6) {
      showError("Please enter the 6-digit OTP.");
      return;
    }
    setLoading(true);

    try {
      const res = await checkOtpFunction({ phone: phone, code: otp });
      const data = res.data;

      if (data.success) {
        sessionStorage.setItem("wildwatch_user", phone);
        
        // This is a user, create their document
        const userDocRef = doc(db, "users", phone); 
        await setDoc(userDocRef, {
          phone: phone,
          role: "user",
          createdAt: new Date(),
        });
        window.location.href = "/user";
      } else {
        showError("Invalid OTP. Please try again.");
      }
    } catch (err) {
      showError("Invalid OTP or server error.");
      console.error(err);
    }
    setLoading(false);
  };

  // Function to go back and change number
  const goBack = () => {
    setStep(1);
    setLoading(false);
    setError("");
    setOtp("");
    setPassword("");
  };

  return (
    <div className="container">
      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ color: "#2E7D32", fontSize: "2.5em", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span role="img" aria-label="leaf" style={{ marginRight: "10px", fontSize: "0.8em" }}>🌿</span>
          WildWatch
        </h1>
        <p style={{ color: "#666", marginTop: "10px", fontSize: "1.1em" }}>
          Welcome back. Please sign in.
        </p>
      </div>

      {/* Step 1: Enter Phone */}
      {step === 1 && (
        <>
          <p style={{ marginBottom: "20px", color: "#666" }}>
            Enter your phone number to begin.
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
          <button onClick={handlePhoneSubmit} disabled={loading}>
            {loading ? "Checking..." : "Continue"}
          </button>
        </>
      )}

      {/* Step 2 (Ranger): Enter Password */}
      {step === 2 && (
        <>
          <p style={{ marginBottom: "20px", color: "#666" }}>
            Welcome, Ranger. Please enter your password for {phone}.
          </p>
          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <button onClick={handlePasswordSubmit} disabled={loading}>
            {loading ? "Verifying..." : "Login"}
          </button>
          <button onClick={goBack} style={{ background: "grey", marginTop: "10px" }} disabled={loading}>
            Back
          </button>
        </>
      )}

      {/* Step 3 (User): Enter OTP */}
      {step === 3 && (
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
          <button onClick={handleOtpSubmit} disabled={loading}>
            {loading ? "Verifying..." : "Verify & Login"}
          </button>
          <button onClick={goBack} style={{ background: "grey", marginTop: "10px" }} disabled={loading}>
            Back
          </button>
        </>
      )}

      {/* Error Message Display */}
      {error && <div className="error-message">{error}</div>}

      {/* Footer */}
      <div style={{ marginTop: "30px", fontSize: "0.85em", color: "#999" }}>
        <p>Powered by Twilio</p>
        <p>&copy; WildWatch 2025</p>
      </div>
    </div>
  );
}