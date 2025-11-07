import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// --- THIS IS THE FIX ---
// Import the new unified Login page
import Login from "./pages/Login"; 

// Import the dashboard pages
import RangerDashboard from "./pages/RangerDashboard";
import UserDashboard from "./pages/UserDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main login page */}
        <Route path="/" element={<Login />} />

        {/* Dashboard routes */}
        <Route path="/ranger" element={<RangerDashboard />} />
        <Route path="/user" element={<UserDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}