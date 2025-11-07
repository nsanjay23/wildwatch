import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import AnalyticsSidebar from "./AnalyticsSidebar"; // Make sure this is imported

export default function RangerDashboard() {
  const [detections, setDetections] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [activeCam, setActiveCam] = useState(null); // The camera to display
  const [loading, setLoading] = useState(true);
  const [autoMode, setAutoMode] = useState(true); // For auto-priority

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
          setActiveCam(cameraList[0]); // Set default camera
        }
      } catch (error) {
        console.error("Error fetching cameras: ", error);
      }
      setLoading(false);
    };
    fetchCameras();
  }, []);

  // 2. Listen for new detections in real-time
  useEffect(() => {
    if (cameras.length === 0) return;

    const q = query(collection(db, "detections"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const newDetections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDetections(newDetections);

      // --- AUTO-PRIORITY LOGIC ---
      if (newDetections.length > 0) {
        const latestDetection = newDetections[0];
        const latestCam = cameras.find(c => c.id === latestDetection.camera_id);
        
        // Only auto-switch if we are in 'autoMode'
        if (autoMode && latestCam && latestCam.id !== activeCam?.id) {
          console.log(`Auto-switching to ${latestCam.name} due to new detection.`);
          setActiveCam(latestCam);
        }
      }
    });
    return unsub; 
  }, [cameras, activeCam, autoMode]); 

  if (loading) {
    return <div className="container" style={{maxWidth: "700px"}}><h2>Loading Cameras...</h2></div>;
  }
  
  // Handler for manual camera click
  const handleManualSwitch = (cam) => {
    setAutoMode(false); // Turn OFF auto-priority
    setActiveCam(cam); // Manually set the active camera
  };

  // Handler for "Return to Auto" button
  const handleReturnToAuto = () => {
    setAutoMode(true);
    if (detections.length > 0) {
      const latestDetection = detections[0];
      const latestCam = cameras.find(c => c.id === latestDetection.camera_id);
      if (latestCam) {
        setActiveCam(latestCam);
      }
    }
  };

  // Filter out the active cam to show in the grid
  const gridCams = cameras.filter(cam => cam.id !== activeCam?.id);

  return (
    <div className="container" style={{ maxWidth: "1600px", padding: "20px" }}>
      <h1 style={{ color: "#2E7D32", marginBottom: "20px" }}>🧑‍✈️ Ranger Command Center</h1>
      
      <div style={{ display: "flex", gap: "20px" }}>
        
        {/* --- LEFT COLUMN (Feed & Detections) --- */}
        <div style={{ flex: 3 }}>
          
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <h3 style={{ padding: "15px", background: "#333", color: "white" }}>
              Live Feed: {activeCam?.name || 'No Camera Selected'} (Zone {activeCam?.zone})
            </h3>
            {activeCam ? (
              <img 
                src={activeCam.stream_url} 
                alt={`Live Feed from ${activeCam.name}`}
                style={{ width: "100%", height: "auto", display: "block", background: "#111" }} 
              />
            ) : (
              <div style={{ height: "480px", display: "flex", alignItems: "center", justifyContent: "center", background: "#eee" }}>
                <p>No Camera Stream</p>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: "20px" }}>
            <h2>Recent Detections</h2>
            <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px" }}>
              {detections.length === 0 && <p style={{padding: "10px"}}>No detections yet.</p>}
              {detections.map((alert, index) => (
                <div key={alert.id} className="card" style={{ background: index === 0 ? "#fffbe6" : "#fff", border: index === 0 ? "1px solid #FBC02D" : "1px solid #eee" }}>
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
        
        {/* --- RIGHT COLUMN (Map, Analytics, & Camera "Links") --- */}
        <div style={{ flex: 1 }}>
          <AnalyticsSidebar detections={detections} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <h2>All Cameras</h2>
            {!autoMode && (
              <button 
                onClick={handleReturnToAuto} 
                style={{height: '30px', padding: '0 10px', background: '#f0ad4e', border: 'none', color: 'white', borderRadius: '5px', cursor: 'pointer', fontWeight: '600'}}
              >
                Auto-Priority
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: '10px' }}>
            {gridCams.map(cam => (
              <div 
                key={cam.id} 
                className="card" 
                onClick={() => handleManualSwitch(cam)} // <-- Use new handler
                style={{ cursor: "pointer", padding: "10px", transition: "all 0.2s ease" }}
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