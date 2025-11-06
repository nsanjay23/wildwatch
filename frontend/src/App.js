// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PhoneLogin from "./pages/PhoneLogin";
import RangerDashboard from "./pages/RangerDashboard";
import UserDashboard from "./pages/UserDashboard"; // <-- CHANGED

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PhoneLogin />} />
        <Route path="/ranger" element={<RangerDashboard />} />
        <Route path="/user" element={<UserDashboard />} /> {/* <-- CHANGED */}
      </Routes>
    </BrowserRouter>
  );
}