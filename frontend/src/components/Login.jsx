import { useState } from "react";
import { login } from "../api.js";
import { Watch, Eye, EyeOff, Loader } from "lucide-react";

const C = {
  bg0: "#05090F", bg1: "#0B1221", bg2: "#111D35",
  border: "#1C2D47", accent: "#00BFFF",
  text: "#DDE6F5", muted: "#5C738F", error: "#FF4757",
};

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email || !password) { setError("Preenche o email e a password."); return; }
    setLoading(true); setError("");
    try {
      const data = await login(email, password);
      onLogin(data.token, data.displayName);
    } catch (e) {
      setError(e.message || "Erro ao ligar à conta Garmin.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "13px 16px",
    background: C.bg2, border: `1px solid ${C.border}`,
    borderRadius: 10, color: C.text, fontSize: 15,
    outline: "none", transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, opacity: 0.04,
        backgroundImage: "linear-gradient(#00BFFF 1px, transparent 1px), linear-gradient(90deg, #00BFFF 1px, transparent 1px)",
        backgroundSize: "48px 48px", pointerEvents: "none",
      }} />

      <style>{`
        @media (max-width: 480px) {
          .login-box { padding: 32px 20px !important; margin: 0 12px !important; border-radius: 16px !important; }
          .login-logo-text { font-size: 18px !important; }
        }
      `}</style>
      <div className="login-box" style={{
        background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: "48px 40px", width: "100%", maxWidth: 420, position: "relative", zIndex: 1,
        boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 36 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, background: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 24px ${C.accent}60`,
          }}>
            <Watch size={24} color={C.bg0} />
          </div>
          <div>
            <div className="login-logo-text" style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em" }}>Garmin Dashboard</div>
            <div style={{ color: C.muted, fontSize: 13 }}>Liga-te à tua conta</div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", color: C.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
              Email Garmin Connect
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="exemplo@email.com" style={inputStyle}
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div>
            <label style={{ display: "block", color: C.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" style={{ ...inputStyle, paddingRight: 46 }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
              <button onClick={() => setShowPw(!showPw)} style={{
                position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                color: C.muted, padding: 2,
              }}>
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 14, padding: "11px 14px", borderRadius: 8,
            background: `${C.error}18`, border: `1px solid ${C.error}40`,
            color: C.error, fontSize: 13,
          }}>{error}</div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit} disabled={loading}
          style={{
            marginTop: 22, width: "100%", padding: "14px",
            background: loading ? `${C.accent}40` : C.accent,
            color: C.bg0, borderRadius: 10, fontSize: 15, fontWeight: 700,
            letterSpacing: "0.02em", transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? <><Loader size={17} style={{ animation: "spin 1s linear infinite" }} /> A ligar...</> : "Entrar"}
        </button>

        <p style={{ marginTop: 18, color: C.muted, fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>
          As credenciais são enviadas apenas para o backend local.<br />
          Nunca são partilhadas com terceiros.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
