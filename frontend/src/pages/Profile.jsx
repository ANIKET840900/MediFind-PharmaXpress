import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getAuthToken } from "../api";

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!getAuthToken()) {
        setError("Please login to view your profile.");
        return;
      }

      try {
        const res = await api.get("/auth/profile/");
        setProfile(res.data);
        setFullName(res.data.full_name || "");
        setEmail(res.data.email || "");
        setMobileNumber(res.data.mobile_number || "");
      } catch (err) {
        setError("Unable to load profile.");
      }
    };

    fetchProfile();
  }, []);

  const saveMobile = async () => {
    try {
      setError("");
      const res = await api.patch("/auth/profile/", {
        full_name: fullName.trim(),
        email: email.trim(),
        mobile_number: mobileNumber.trim(),
      });
      setProfile(res.data);
      setMessage("Profile saved successfully.");
      setTimeout(() => setMessage(""), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to save profile.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>👤 My Profile</h1>
        <p>Manage your account information</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      {profile && (
        <section className="profile-banner">
          <div>
            <span className="market-kicker">Account center</span>
            <h2>Manage your shopping identity and contact details.</h2>
            <p>Keep your orders, notifications, and payment-related actions tied to one active profile.</p>
          </div>
          <div className="profile-banner-actions">
            <button className="btn-hero btn-primary" onClick={() => navigate("/search")}>Shop now</button>
            <button className="btn-hero" onClick={() => navigate("/orders")}>View orders</button>
          </div>
        </section>
      )}
      
      {profile ? (
        <div className="profile-card">
          <div className="profile-field">
            <label>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
            />
          </div>

          <div className="profile-field">
            <label>Username</label>
            <div className="profile-field-value">{profile.username}</div>
          </div>
          
          <div className="profile-field">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
            />
            <div className="form-actions" style={{ marginTop: 8 }}>
              <button className="btn-action btn-secondary" onClick={saveMobile}>Save Profile</button>
            </div>
            <div className="profile-field-value">Email saved in profile.</div>
          </div>

          <div className="profile-field">
            <label>Role</label>
            <div className="profile-field-value">{(profile.role || "buyer").toUpperCase()}</div>
          </div>

          <div className="profile-field">
            <label>Mobile Number</label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="Enter mobile number"
            />
            <div className="form-actions" style={{ marginTop: 8 }}>
              <button className="btn-action btn-secondary" onClick={saveMobile}>Save Mobile</button>
            </div>
            <div className="profile-field-value">Mobile saved in profile.</div>
          </div>

          <div className="profile-field">
            <label>Account Status</label>
            <div className="profile-field-value" style={{color: '#1aa260', fontWeight: '700'}}>✓ Active</div>
          </div>
        </div>
      ) : error ? null : (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <h3>Loading profile...</h3>
        </div>
      )}
    </div>
  );
}