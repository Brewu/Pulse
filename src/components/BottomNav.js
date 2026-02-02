import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./BottomNav.css";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [ripple, setRipple] = useState(null);

  const isActive = (path) => location.pathname === path;

  const navItems = [
    {
      path: "/home",
      label: "Home",
      icon: HomeIcon,
    },
    {
      path: "/search",
      label: "Discover",
      icon: SearchIcon,
    },
    {
      path: "/create",
      label: "Create",
      icon: PlusIcon,
      isFab: true,
    },
    {
      path: "/profile",
      label: "Profile",
      icon: ProfileIcon,
    },
  ];

  const handleClick = (e, path, label) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      label,
    });

    navigate(path);
    setTimeout(() => setRipple(null), 600);
  };

  return (
    <nav className="bottom-nav">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        const active = isActive(item.path);

        return (
          <button
            key={item.path}
            className={`nav-item ${item.isFab ? "fab" : ""} ${
              active ? "active" : ""
            }`}
            onClick={(e) => handleClick(e, item.path, item.label)}
            aria-label={item.label}
          >
            {ripple?.label === item.label && (
              <span
                className="ripple"
                style={{ left: ripple.x, top: ripple.y }}
              />
            )}

            <div className="nav-icon">
              <Icon active={active} />
            </div>

            {!item.isFab && (
              <span className={`nav-label ${active ? "active" : ""}`}>
                {item.label}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;

/* ================= ICONS ================= */

const HomeIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}>
    <path
      d="M3 10L12 3L21 10V20A1 1 0 0 1 20 21H4A1 1 0 0 1 3 20Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SearchIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle
      cx="11"
      cy="11"
      r="7"
      stroke="currentColor"
      strokeWidth="1.8"
      fill={active ? "currentColor" : "none"}
    />
    <path
      d="M21 21L16.65 16.65"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24">
    <path
      d="M12 5V19M5 12H19"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const ProfileIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}>
    <circle cx="12" cy="8" r="4" />
    <path
      d="M4 20C4 15.58 7.58 12 12 12C16.42 12 20 15.58 20 20"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);