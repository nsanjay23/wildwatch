import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // <-- THE MAP TILE FIX
import L from 'leaflet'; // Import L for custom icons

// --- FIX FOR BROKEN MARKER ICONS ---
// This is another common bug. We have to manually re-import the marker icons.
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


// --- This function calculates the "counts" you wanted ---
function calculateHotspots(detections) {
  const counts = new Map();
  // Count each species
  for (const alert of detections) {
    const species = alert.species;
    counts.set(species, (counts.get(species) || 0) + 1);
  }
  // Convert from Map to array and sort by count
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export default function AnalyticsSidebar({ detections }) {
  // Get the hotspot counts (e.g., [["Elephant", 10], ["Tiger", 3]])
  const hotspots = calculateHotspots(detections);
  
  // Get the 10 most recent detections to plot on the map
  const recentMarkers = detections.slice(0, 10).filter(alert => alert.location);

  // Set a default center for the map (I'm using your cam_01 location)
  // This is the Arasur/Neelambur area from your screenshot
  const mapCenter = [11.0573, 77.1135]; 

  return (
    <div style={{ flex: 1 }}>
      {/* --- 1. The Hotspot Map --- */}
      <h2>Hotspot Map</h2>
      {/* Ensure the map container has a defined height */}
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
          
          {/* --- Plot the "pointers" for recent animals --- */}
          {recentMarkers.map(alert => (
            <Marker 
              key={alert.id} 
              position={[alert.location.lat, alert.location.lon]}
            >
              <Popup>
                <b>{alert.species}</b> detected <br />
                {new Date(alert.timestamp?.seconds * 1000).toLocaleTimeString()}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* --- 2. The "Number of Times" List --- */}
      <h2>Detection Summary</h2>
      <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px" }}>
        {hotspots.length === 0 && <p style={{padding: "10px"}}>No detections yet.</p>}
        {hotspots.map(([species, count]) => (
          <div 
            key={species} 
            className="card" 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '15px'
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{species}</span>
            <span style={{ fontSize: '1.2em', color: '#2E7D32' }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}