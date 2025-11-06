import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export default function RangerDashboard() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "detections"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => setAlerts(snap.docs.map((d) => d.data())));
    return unsub;
  }, []);

  return (
    // Make the container wider to fit the video and alerts
    <div className="container" style={{ maxWidth: "1200px", display: "flex", gap: "20px" }}>
      
      {/* Column 1: Live Feed */}
      <div style={{ flex: 2 }}>
        <h2>Live Camera Feed</h2>
        <img 
          src="http://localhost:5001/video_feed" 
          alt="Live Feed"
          style={{ width: "100%", borderRadius: "12px", background: "#eee" }} 
        />
      </div>

      {/* Column 2: Detections */}
      <div style={{ flex: 1 }}>
        <h2>🧑‍✈️ Detections Log</h2>
        <p style={{ color: "#666", marginBottom: "20px", textAlign: "left" }}>
          Monitoring all active zones in real-time
        </p>
        
        {/* Make the alert list scrollable */}
        <div style={{ maxHeight: "600px", overflowY: "auto" }}>
          {alerts.length === 0 && <p>No detections yet.</p>}
          {alerts.map((a, i) => (
            <div key={i} className="card">
              <b>{a.species}</b> detected<br />
              Zone: {a.zone} | Confidence: {a.confidence?.toFixed(2)}<br />
              <span style={{ fontSize: "13px", color: "#666" }}>
                {a.timestamp?.seconds && new Date(a.timestamp.seconds * 1000).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}