export const C = {
  bg0: "#05090F", bg1: "#0B1221", bg2: "#111D35", bg3: "#172645",
  border: "#1C2D47", accent: "#00BFFF", accentDim: "#00406B",
  run: "#FF6230", heart: "#FF3A5C", sleep: "#8B7FFF",
  steps: "#00D47E", battery: "#FFB800",
  text: "#DDE6F5", muted: "#5C738F", error: "#FF4757",
};

export const StatCard = ({ icon, label, value, unit, color, sub }) => (
  <div style={{
    background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 16,
    padding: "20px 22px", display: "flex", flexDirection: "column", gap: 8,
    transition: "border-color 0.2s",
  }}
    onMouseEnter={e => e.currentTarget.style.borderColor = color}
    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      <span style={{ color }}>{icon}</span>
      {label}
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <span className="stat-num" style={{ fontSize: 32, color, lineHeight: 1 }}>{value}</span>
      {unit && <span style={{ color: C.muted, fontSize: 13 }}>{unit}</span>}
    </div>
    {sub && <div style={{ color: C.muted, fontSize: 12 }}>{sub}</div>}
  </div>
);

export const Card = ({ title, children, style = {} }) => (
  <div style={{
    background: C.bg2, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: "20px 24px", ...style,
  }}>
    {title && (
      <div style={{
        color: C.muted, fontSize: 12, textTransform: "uppercase",
        letterSpacing: "0.07em", marginBottom: 18, fontWeight: 500,
      }}>
        {title}
      </div>
    )}
    {children}
  </div>
);

export const Tooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.bg3, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    }}>
      {label && <div style={{ color: C.muted, marginBottom: 5 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {formatter ? formatter(p.value, p.name) : p.value}
        </div>
      ))}
    </div>
  );
};

export const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: C.muted }}>
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      border: `3px solid ${C.border}`, borderTopColor: C.accent,
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export const ErrorBanner = ({ msg }) => (
  <div style={{
    padding: "14px 18px", borderRadius: 10,
    background: "#FF475718", border: "1px solid #FF475750",
    color: "#FF4757", fontSize: 14,
  }}>
    {msg}
  </div>
);

export const toMinSec = (totalSecs) => {
  const m = Math.floor(totalSecs / 60);
  const s = Math.floor(totalSecs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const toHM = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const secsToHM = (secs) => toHM((secs || 0) / 60);

export const actTypeLabel = (typeKey) => {
  const map = {
    running: "Corrida", cycling: "Ciclismo", walking: "Caminhada",
    swimming: "Natação", strength_training: "Musculação",
    cardio_training: "Cardio", trail_running: "Trail",
    road_biking: "Ciclismo Estrada", mountain_biking: "BTT",
  };
  return map[typeKey] || typeKey || "Atividade";
};

export const actEmoji = (typeKey) => {
  const map = {
    running: "🏃", cycling: "🚴", walking: "🚶",
    swimming: "🏊", strength_training: "🏋️",
    cardio_training: "💪", trail_running: "⛰️",
    road_biking: "🚴", mountain_biking: "🚵",
  };
  return map[typeKey] || "⚡";
};

export const actColor = (typeKey, C) => {
  const map = {
    running: C.run, trail_running: C.run,
    cycling: C.accent, road_biking: C.accent, mountain_biking: C.accent,
    walking: C.steps, swimming: "#00D4FF",
    strength_training: C.sleep, cardio_training: C.battery,
  };
  return map[typeKey] || C.muted;
};
