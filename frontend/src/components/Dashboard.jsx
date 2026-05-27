import { useState } from "react";
import { Activity, Heart, Moon, BarChart2, Watch, LogOut, RefreshCw } from "lucide-react";
import ActivitiesPanel from "./ActivitiesPanel.jsx";
import HeartRatePanel from "./HeartRatePanel.jsx";
import SleepPanel from "./SleepPanel.jsx";
import StepsPanel from "./StepsPanel.jsx";

const C = {
  bg0: "#05090F", bg1: "#0B1221", border: "#1C2D47",
  accent: "#00BFFF", run: "#FF6230", heart: "#FF3A5C",
  sleep: "#8B7FFF", steps: "#00D47E", muted: "#5C738F", text: "#DDE6F5",
};

const TABS = [
  { id: "activities", label: "Atividades", icon: Activity, color: C.run },
  { id: "heartrate",  label: "Frequência Cardíaca", icon: Heart, color: C.heart },
  { id: "sleep",      label: "Sono", icon: Moon, color: C.sleep },
  { id: "steps",      label: "Passos & Calorias", icon: BarChart2, color: C.steps },
];

export default function Dashboard({ displayName, onLogout }) {
  const [tab, setTab] = useState("activities");
  const [refreshKey, setRefreshKey] = useState(0);

  const activeTab = TABS.find(t => t.id === tab);

  const panels = {
    activities: <ActivitiesPanel key={`act-${refreshKey}`} />,
    heartrate:  <HeartRatePanel  key={`hr-${refreshKey}`} />,
    sleep:      <SleepPanel      key={`sl-${refreshKey}`} />,
    steps:      <StepsPanel      key={`st-${refreshKey}`} />,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg0, display: "flex", flexDirection: "column" }}>
      {/* ── Top bar ── */}
      <header style={{
        background: C.bg1, borderBottom: `1px solid ${C.border}`,
        padding: "14px 28px", display: "flex", alignItems: "center", gap: 14,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, background: C.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 18px ${C.accent}50`, flexShrink: 0,
        }}>
          <Watch size={20} color={C.bg0} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>Garmin Dashboard</div>
          {displayName && <div style={{ color: C.muted, fontSize: 12 }}>{displayName}</div>}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            title="Atualizar dados"
            style={{ color: C.muted, padding: 8, borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = C.accent}
            onMouseLeave={e => e.currentTarget.style.color = C.muted}
          >
            <RefreshCw size={17} />
          </button>
          <button
            onClick={onLogout}
            title="Sair"
            style={{ color: C.muted, padding: 8, borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = C.heart}
            onMouseLeave={e => e.currentTarget.style.color = C.muted}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <nav style={{
        background: C.bg1, borderBottom: `1px solid ${C.border}`,
        padding: "0 28px", display: "flex", gap: 2,
        position: "sticky", top: 66, zIndex: 99,
      }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "13px 20px", display: "flex", alignItems: "center", gap: 8,
                color: active ? t.color : C.muted,
                borderBottom: active ? `2px solid ${t.color}` : "2px solid transparent",
                fontSize: 14, fontWeight: active ? 600 : 400,
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = C.muted; }}
            >
              <Icon size={17} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* ── Content ── */}
      <main style={{ flex: 1, padding: "28px", maxWidth: 1140, width: "100%", margin: "0 auto", alignSelf: "stretch" }}>
        {panels[tab]}
      </main>
    </div>
  );
}
