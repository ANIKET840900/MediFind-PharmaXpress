import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setAuthToken } from "../api";
import "../styles/auth.css";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login/", { username, password });
      setAuthToken(response.data.token);
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container auth-galaxy">
      <div className="auth-galaxy-topbar">
        <span className="auth-brand-mark">MedCompare</span>
        <Link className="auth-top-link" to="/signup">Create account</Link>
      </div>

      <div className="auth-card auth-card-galaxy">
        <div className="auth-header">
          <h1>Sign in to your workspace</h1>
          <p>Use your username and password to continue.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
            <div className="input-focus" />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <div className="input-focus" />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Need help? <Link to="/forgot-password" className="auth-link">Reset password</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
