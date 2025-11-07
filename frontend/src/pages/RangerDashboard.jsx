import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import AnalyticsSidebar from "./AnalyticsSidebar"; // We'll keep the analytics

export default function RangerDashboard() {
  const [detections, setDetections] = useState([]);
  const [cameras, setCameras] = useState({}); // To show camera names
  const [loading, setLoading] = useState(true);

  // 1. Fetch the list of all cameras ONCE (to get their names)
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const cameraQuery = query(collection(db, "cameras"));
        const querySnapshot = await getDocs(cameraQuery);
        const cameraMap = {};
        querySnapshot.docs.forEach(doc => {
          cameraMap[doc.id] = doc.data();
        });
        setCameras(cameraMap);
      } catch (error) {
        console.error("Error fetching cameras: ", error);
      }
      setLoading(false);
    };
    fetchCameras();
  }, []);

  // 2. Listen for new detections in real-time
  useEffect(() => {
    const q = query(collection(db, "detections"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const newDetections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDetections(newDetections);
    });
    return unsub; 
  }, []);

  if (loading) {
    return <div className="container"><h2>Loading Detections...</h2></div>;
  }

  return (
    <div className="container" style={{ maxWidth: "1600px", padding: "20px" }}>
      <h1 style={{ color: "#2E7D32", marginBottom: "20px" }}>🧑‍✈️ Ranger Command Center</h1>
      
      {/* --- 2-COLUMN LAYOUT --- */}
      <div style={{ display: "flex", gap: "20px" }}>
        
        {/* --- LEFT COLUMN (Detections Log) --- */}
        <div style={{ flex: 2 }}>
          {/* Detections Log is now the main component */}
          <h2>Recent Detections</h2>
          <div style={{ maxHeight: "80vh", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px" }}>
            {detections.length === 0 && <p style={{padding: "10px"}}>No detections yet.</p>}
            
            {detections.map((alert, index) => {
              const isCritical = alert.priority === "critical";
              
              return (
                <div 
                  key={alert.id} 
                  className="card" 
                  style={{ 
                    background: isCritical ? "#ffebee" : "#fff", 
                    border: isCritical ? "2px solid #D32F2F" : (index === 0 ? "1px solid #FBC02D" : "1px solid #eee")
                  }}
                >
                  <b>{alert.species}</b> detected on <b>{cameras[alert.camera_id]?.name || alert.camera_id}</b>
                  
                  {isCritical && (
                    <b style={{color: "#D32F2F", marginLeft: "10px"}}>
                      (CRITICAL: HUMAN INTERACTION)
                    </b>
                  )}
                  
                  <br />
                  Confidence: {alert.confidence?.toFixed(2)} | Zone: {alert.zone}
                  <span style={{ fontSize: "13px", color: "#666", display: "block", marginTop: "5px" }}>
                    {alert.timestamp?.seconds && new Date(alert.timestamp.seconds * 1000).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* --- RIGHT COLUMN (Map & Analytics) --- */}
        <div style={{ flex: 1 }}>
          <AnalyticsSidebar detections={detections} />
        </div>

      </div>
    </div>
  );
}