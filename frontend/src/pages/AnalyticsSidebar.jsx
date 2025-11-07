import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // <-- THE MAP TILE FIX
import L from 'leaflet'; // Import L for custom icons

// --- FIX FOR BROKEN MARKER ICONS ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;
// --- END MARKER ICON FIX ---

// This function now counts both species and special alert types
function calculateHotspots(detections) {
  const counts = new Map();
  for (const alert of detections) {
    
    // Add to species count
    const species = alert.species;
    counts.set(species, (counts.get(species) || 0) + 1);

    // --- NEW: Count high-risk alerts ---
    if (alert.priority === "critical") {
      counts.set("CRITICAL ALERTS", (counts.get("CRITICAL ALERTS") || 0) + 1);
    }
  }
  // Sort by count, but make sure "CRITICAL ALERTS" is always at the top
  return Array.from(counts.entries()).sort((a, b) => {
    if (a[0] === "CRITICAL ALERTS") return -1;
    if (b[0] === "CRITICAL ALERTS") return 1;
    return b[1] - a[1];
  });
}

export default function AnalyticsSidebar({ detections }) {
  const hotspots = calculateHotspots(detections);
  const recentMarkers = detections.slice(0, 10).filter(alert => alert.location);
  // Default center: Your test video's hardcoded location
  const mapCenter = [11.0168, 76.9558]; 

  return (
    <div style={{ flex: 1 }}>
      {/* --- 1. The Hotspot Map --- */}
      <h2>Hotspot Map</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden', height: '400px', marginBottom: '20px' }}>
        <MapContainer 
          center={mapCenter} 
          zoom={13} 
          scrollWheelZoom={false} 
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {recentMarkers.map(alert => (
            <Marker 
              key={alert.id} 
              position={[alert.location.lat, alert.location.lon]}
            >
              <Popup>
                <b>{alert.species}</b> detected <br />
                {alert.priority === "critical" && <b style={{color: 'red'}}>WITH HUMAN</b>}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* --- 2. The "Number of Times" List --- */}
      <h2>Detection Summary</h2>
      <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px" }}>
        {hotspots.length === 0 && <p style={{padding: "10px"}}>No detections yet.</p>}
        {hotspots.map(([item, count]) => {
          // --- NEW: Style high-risk alerts ---
          const isCritical = item === "CRITICAL ALERTS";
          return (
            <div 
              key={item} 
              className="card" 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '15px',
                background: isCritical ? "#ffebee" : "#fff",
                border: isCritical ? "2px solid #D32F2F" : "1px solid #eee"
              }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '1.1em', color: isCritical ? "#D32F2F" : "#000" }}>
                {item}
              </span>
              <span style={{ fontSize: '1.2em', color: isCritical ? "#D32F2F" : '#2E7D32' }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}