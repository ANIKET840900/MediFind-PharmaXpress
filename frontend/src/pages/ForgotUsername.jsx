import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function ForgotUsername() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setError("");
      setMessage("");
      setLoading(true);
      const response = await api.post("/auth/forgot-username/", { email });
      if (response.data.username) {
        setMessage(`Your username is ${response.data.username}.`);
      } else if (Array.isArray(response.data.usernames)) {
        setMessage(`Matching usernames: ${response.data.usernames.join(", ")}.`);
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.detail || "Unable to recover username.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Recover Username</h1>
          <p>Enter the email you used during signup.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="recovery-email">Email</label>
            <input
              id="recovery-email"
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <div className="input-focus"></div>
          </div>

          {error && <div className="error-box">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Looking up..." : "Recover Username"}
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
