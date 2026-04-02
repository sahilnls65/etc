import React from "react";
import "./Loader.css";

const Loader = () => (
  <div className="loader-screen">
    <div className="loader-clock">
      <svg viewBox="0 0 80 80" className="loader-svg">
        <circle cx="40" cy="40" r="34" className="loader-ring" />
        <line x1="40" y1="40" x2="40" y2="18" className="loader-hand loader-min" />
        <line x1="40" y1="40" x2="52" y2="48" className="loader-hand loader-hr" />
        <circle cx="40" cy="40" r="3" className="loader-center" />
      </svg>
    </div>
    <span className="loader-label">Loading...</span>
  </div>
);

export default Loader;
