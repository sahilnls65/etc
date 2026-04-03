import React, { useState, useEffect } from "react";
import { login } from "./api";

function Login({ onLogin, onClose, isModal }) {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId.trim() || !password) {
      setError("Please enter both fields");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await login(employeeId.trim(), password);
      onLogin(user);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    if (!isModal) return;
    const handleKey = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isModal, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && onClose) onClose();
  };

  return (
    <div
      className={isModal ? "login-modal-overlay" : "login-screen"}
      onClick={isModal ? handleBackdropClick : undefined}
    >
      <form className="login-card" onSubmit={handleSubmit}>
        {isModal && onClose && (
          <button type="button" className="login-close" onClick={onClose} title="Close">
            &times;
          </button>
        )}
        <div className="login-header">
          <svg viewBox="0 0 80 80" className="login-icon">
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4f6ef7" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <rect width="80" height="80" rx="20" fill="url(#lg)" />
            <circle cx="40" cy="40" r="22" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
            <line x1="40" y1="40" x2="40" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="40" x2="52" y2="48" stroke="rgba(255,255,255,0.7)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="40" cy="40" r="2.5" fill="#fff" />
          </svg>
          <h1 className="login-title">Time Calculator</h1>
          <p className="login-sub">Sign in with your employee ID</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="login-field">
          <label className="login-label">Employee ID</label>
          <input
            type="text"
            className="login-input"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="e.g. 101"
            autoFocus
            disabled={loading}
          />
        </div>

        <div className="login-field">
          <label className="login-label">Password</label>
          <input
            type="password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            disabled={loading}
          />
        </div>

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default Login;
