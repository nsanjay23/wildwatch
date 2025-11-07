import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import AnalyticsSidebar from "./AnalyticsSidebar"; // We'll keep the map/analytics

export default function RangerDashboard() {
  const [detections, setDetections] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [priorityCam, setPriorityCam] = useState(null); // This will hold the full camera object
  const [loading, setLoading] = useState(true);

  // 1. Fetch the list of all cameras from Firestore ONCE
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const cameraQuery = query(collection(db, "cameras"));
        const querySnapshot = await getDocs(cameraQuery);
        const cameraList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        if (cameraList.length > 0) {
          setCameras(cameraList);
          // Set the first camera as the default priority
          setPriorityCam(cameraList[0]);
        }
      } catch (error) {
        console.error("Error fetching cameras: ", error);
      }
      setLoading(false);
    };
    fetchCameras();
  }, []); // Empty array means this runs only once on mount

  // 2. Listen for new detections in real-time
  useEffect(() => {
    // Only start listening for detections after we have the camera list
    if (cameras.length === 0) return;

    const q = query(collection(db, "detections"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const newDetections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDetections(newDetections);

      // --- PRIORITY LOGIC ---
      if (newDetections.length > 0) {
        const latestDetection = newDetections[0];
        const latestCam = cameras.find(c => c.id === latestDetection.camera_id);
        
        // Auto-switch to the camera with the latest alert
        if (latestCam && latestCam.id !== priorityCam?.id) {
          console.log(`New detection on ${latestCam.name}, switching priority.`);
          setPriorityCam(latestCam);
        }
      }
    });
    return unsub; 
  }, [cameras, priorityCam]); // Re-check if cameras or priorityCam changes

  if (loading) {
    return <div className="container" style={{maxWidth: "700px"}}><h2>Loading Cameras...</h2></div>;
  }

  // Filter out the priority cam to show in the grid
  const gridCams = cameras.filter(cam => cam.id !== priorityCam?.id);

  return (
    <div className="container" style={{ maxWidth: "1600px", padding: "20px" }}>
      <h1 style={{ color: "#2E7D32", marginBottom: "20px" }}>🧑‍✈️ Ranger Command Center</h1>
      
      <div style={{ display: "flex", gap: "20px" }}>
        
        {/* --- LEFT COLUMN (Feed & Detections) --- */}
        <div style={{ flex: 3 }}>
          
          {/* Priority Feed (The ONLY video feed on the page) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <h3 style={{ padding: "15px", background: "#333", color: "white" }}>
              Priority Feed: {priorityCam?.name || 'No Camera Selected'} (Zone {priorityCam?.zone})
            </h3>
            {priorityCam ? (
              <img 
                src={priorityCam.stream_url} 
                alt={`Live Feed from ${priorityCam.name}`}
                style={{ width: "100%", height: "auto", display: "block", background: "#111" }} 
              />
            ) : (
              <div style={{ height: "480px", display: "flex", alignItems: "center", justifyContent: "center", background: "#eee" }}>
                <p>No Camera Stream</p>
              </div>
            )}
          </div>
          
          {/* Detections Log */}
          <div style={{ marginTop: "20px" }}>
            <h2>Recent Detections</h2>
            <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px" }}>
              {detections.length === 0 && <p style={{padding: "10px"}}>No detections yet.</p>}
              {detections.map((alert) => (
                <div key={alert.id} className="card" style={{ background: alert.id === detections[0]?.id ? "#fffbe6" : "#fff", border: alert.id === detections[0]?.id ? "1px solid #FBC02D" : "1px solid #eee" }}>
                  <b>{alert.species}</b> detected on <b>{cameras.find(c => c.id === alert.camera_id)?.name || alert.camera_id}</b>
                  <br />
                  Confidence: {alert.confidence?.toFixed(2)} | Zone: {alert.zone}
                  <span style={{ fontSize: "13px", color: "#666", display: "block", marginTop: "5px" }}>
                    {alert.timestamp?.seconds && new Date(alert.timestamp.seconds * 1000).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* --- RIGHT COLUMN (Map & Analytics) --- */}
        <div style={{ flex: 1 }}>
          <AnalyticsSidebar detections={detections} />
          
          {/* Camera Switcher Grid */}
          <h2 style={{marginTop: '20px'}}>All Cameras</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {gridCams.map(cam => (
              <div 
                key={cam.id} 
                className="card" 
                onClick={() => setPriorityCam(cam)} // Clicking this changes the main feed
                style={{ cursor: "pointer", padding: "10px", transition: "all 0.2s ease" }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = '#2E7D32'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = '#eee'}
              >
                <h4 style={{ color: "#2E7D32" }}>{cam.name}</h4>
                <p style={{ fontSize: "0.9em", color: "#666" }}>Zone: {cam.zone}</p>
                <div style={{ height: "120px", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", marginTop: "5px", color: "#777" }}>
                  (Click to view stream)
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}