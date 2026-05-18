import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { api, clearAuthToken } from "../api";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navbarRef = useRef(null);
  const navigate = useNavigate();

  const navItems = [
    { to: "/home", icon: "⌂", label: "Home", end: true },
    { to: "/search", icon: "🔎", label: "Search Medicines" },
    { to: "/orders", icon: "✦", label: "My Orders" },
    { to: "/cart", icon: "♡", label: "My Cart" },
    { to: "/wishlist", icon: "❤", label: "Wishlist" },
    { to: "/notifications", icon: "🔔", label: "Notifications" },
    { to: "/my-medicines", icon: "🎁", label: "My Medicines" },
    { to: "/profile", icon: "👤", label: "My Profile" },
  ];

  const closeMenu = () => setOpen(false);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout/");
    } catch (error) {
      // Clear local state even if the server token is already gone.
    } finally {
      clearAuthToken();
      closeMenu();
      navigate("/login", { replace: true });
    }
  };

  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target)) {
        closeMenu();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    const handleScroll = () => {
      closeMenu();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleEscapeKey);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleEscapeKey);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <nav className="navbar navbar-menu-shell" aria-label="Primary" ref={navbarRef}>
      <button
        type="button"
        className={`navbar-toggle ${open ? "is-open" : ""}`}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="primary-nav-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="navbar-toggle-line" />
        <span className="navbar-toggle-line" />
        <span className="navbar-toggle-line" />
      </button>

      {open && (
        <div className="navbar-menu" id="primary-nav-menu" role="menu">
          <div className="navbar-menu-header">
            <div>
              <span>Quick navigation</span>
              <p className="navbar-menu-subtitle">Compare, track, and reorder medicines fast.</p>
            </div>
            <Link to="/home" onClick={closeMenu} className="navbar-menu-signup">
              Dashboard
            </Link>
          </div>

          <div className="navbar-menu-list">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                onClick={closeMenu}
                className={({ isActive }) => `navbar-menu-item ${isActive ? "active" : ""}`}
                role="menuitem"
              >
                <span className="navbar-menu-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="navbar-menu-item navbar-logout-btn"
              role="menuitem"
            >
              <span className="navbar-menu-icon">↪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}