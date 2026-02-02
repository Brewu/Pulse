import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Signup from "./components/Signup";
import Login from "./components/Login";
import SignInPhone from "./components/SignInPhone";
import FollowersPage from './components/FollowersPage';
import Home from "./components/Home";
import Search from "./components/Search";
import FollowingPage from './components/FolowingPage';
import EditProfile from './components/EditProfile';
import Reels from './components/Reels';
import Tag from './components/Tag';
import Create from "./components/Create";
import Profile from "./components/Profile";
import Post from "./components/Post";
import AppLayout from "./layouts/AppLayout";
import Terms from './components/Terms'
import PrivacyPolicy from "./components/PrivacyPolicy";
function App() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  // Listen for PWA install event
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault(); // Prevent automatic prompt
      setDeferredPrompt(e); // Save the event for later
      setShowInstall(true); // Show our custom modal/button
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); // Show native install prompt
    const choice = await deferredPrompt.userChoice;
    console.log("User choice:", choice.outcome);
    setDeferredPrompt(null);
    setShowInstall(false);
  };

  return (
    <>
      {showInstall && (
        <div style={installBannerStyle}>
          <p style={{ margin: 0 }}>Install Pulse App for a better experience!</p>
          <button style={installButtonStyle} onClick={handleInstallClick}>
            Add to Home Screen
          </button>
        </div>
      )}

      <Router>
        <Routes>
          {/* Redirect root */}
          <Route path="/" element={<Navigate to="/home" />} />
          <Route path="/tag/:tag" element={<Tag />} />

          {/* AUTH ROUTES (no bottom nav) */}
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login-phone" element={<SignInPhone />} />
          <Route path="/profile/:uid" element={<Profile />} />

          {/* APP ROUTES (WITH bottom nav) */}
          <Route element={<AppLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/post/:postId" element={<Post />} />
            <Route path="/profile/:uid/followers" element={<FollowersPage />} />
            <Route path="/profile/:uid/following" element={<FollowingPage />} />
            <Route path="/create" element={<Create />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/reels/:postId" element={<Reels />} />
            <Route path="/editprofile" element={<EditProfile />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />

          </Route>
        </Routes>
      </Router>
    </>
  );
}

// Simple inline styles for the banner
const installBannerStyle = {
  position: "fixed",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  backgroundColor: "#ff4d4d",
  color: "#fff",
  padding: "12px 20px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  zIndex: 1000,
  boxShadow: "0 4px 8px rgba(0,0,0,0.2)"
};

const installButtonStyle = {
  backgroundColor: "#fff",
  color: "#ff4d4d",
  border: "none",
  padding: "8px 14px",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "bold"
};

export default App;
