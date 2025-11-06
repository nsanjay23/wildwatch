// src/pages/UserDashboard.jsx
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function UserDashboard() {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [userPhone, setUserPhone] = useState(null);

  // Get the user's phone from session storage
  useEffect(() => {
    const storedPhone = sessionStorage.getItem("wildwatch_user");
    if (storedPhone) {
      setUserPhone(storedPhone);
    } else {
      window.location.href = "/";
    }
  }, []);

  // Ask for location
  useEffect(() => {
    if (userPhone) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setLocation({ latitude, longitude });

            const userDocRef = doc(db, "users", userPhone);
            updateDoc(userDocRef, {
              location: {
                lat: latitude,
                lon: longitude,
              },
              lastUpdatedLocation: new Date(),
            })
            .then(() => console.log("User location saved to Firestore."))
            .catch((err) => console.error("Error saving location: ", err));
          },
          (err) => {
            console.warn("User denied location access.", err.message);
          }
        );
      }
    }
  }, [userPhone]);

  // Listen for alerts
  useEffect(() => {
    const q = query(collection(db, "detections"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const latest = snap.docs[0]?.data();
      
      if (latest?.zone === "C") {
        setAlert(latest);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <div className="container">
      <h2>🏡 User Dashboard</h2> {/* <-- CHANGED */}

      {loading && <p>Loading alerts...</p>}

      {!loading && alert ? (
        <div className="alert-box">
          🚨 {alert.species} detected near your area!
        </div>
      ) : (
        !loading && <p>No current alerts 😊</p>
      )}

      {location && (
        <p style={{ fontSize: "0.8em", color: "#888", marginTop: "20px" }}>
          Your location is protected and being monitored.
        </p>
      )}
    </div>
  );
}