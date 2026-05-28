import { useState } from "react";
import { getToken, setToken, logout as apiLogout } from "./api.js";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import AICoach from "./AICoach.jsx"; 

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [displayName, setDisplayName] = useState(localStorage.getItem("garmin_name") || "");
  const [activeTab, setActiveTab] = useState("dashboard"); // Estado da navegação

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
  
  const navStyle = (tabName) => ({
    padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', border: 'none',
    background: activeTab === tabName ? '#00c3ff' : '#161b22',
    color: activeTab === tabName ? '#000' : '#c9d1d9',
    borderRadius: '6px'
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      
      {/* Menu Superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setActiveTab("dashboard")} style={navStyle("dashboard")}>📈 Métricas Brutas</button>
          <button onClick={() => setActiveTab("coach")} style={navStyle("coach")}>🧠 Treinador IA</button>
        </div>
        <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Sair</button>
      </div>

      {/* Conteúdo Dinâmico */}
      {activeTab === "dashboard" ? (
        <Dashboard displayName={displayName} onLogout={handleLogout} />
      ) : (
        <AICoach />
      )}
    </div>
  );
}