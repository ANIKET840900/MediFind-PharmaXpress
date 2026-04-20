import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setError("");
      setMessage("");
      setLoading(true);
      const response = await api.post("/auth/forgot-password/", {
        username,
        email,
        new_password: newPassword,
      });
      setMessage(response.data.detail || "Password updated successfully.");
      setLoading(false);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.detail || "Unable to reset password.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Reset Password</h1>
          <p>Use your username and registered email to set a new password.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="reset-username">Username</label>
            <input
              id="reset-username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <div className="input-focus"></div>
          </div>

          <div className="form-group">
            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <div className="input-focus"></div>
          </div>

          <div className="form-group">
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              placeholder="Create a new password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <div className="input-focus"></div>
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            <div className="input-focus"></div>
          </div>

          {error && <div className="error-box">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            <Link to="/login" className="auth-link">Back to Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
