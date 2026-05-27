import { useState, useEffect } from "react";
import { getToken, setToken, logout as apiLogout } from "./api.js";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [displayName, setDisplayName] = useState(
    localStorage.getItem("garmin_name") || ""
  );

  const handleLogin = (tok, name) => {
    setToken(tok);
    setTokenState(tok);
    setDisplayName(name);
    localStorage.setItem("garmin_name", name || "");
  };

  const handleLogout = async () => {
    try { await apiLogout(); } catch (_) {}
    setToken(null);
    setTokenState(null);
    setDisplayName("");
    localStorage.removeItem("garmin_name");
  };

  if (!token) return <Login onLogin={handleLogin} />;
  return <Dashboard displayName={displayName} onLogout={handleLogout} />;
}
