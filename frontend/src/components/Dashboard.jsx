import { useState } from "react";
import { Activity, Heart, Moon, BarChart2, Watch, LogOut, RefreshCw, Brain, TrendingUp } from "lucide-react";
import ActivitiesPanel from "./ActivitiesPanel.jsx";
import ProgressPanel from "./ProgressPanel.jsx";
import HeartRatePanel from "./HeartRatePanel.jsx";
import SleepPanel from "./SleepPanel.jsx";
import StepsPanel from "./StepsPanel.jsx";
import AICoach from "../AICoach.jsx"; 

const C = {
  bg0: "#05090F", bg1: "#0B1221", border: "#1C2D47",
  accent: "#00BFFF", run: "#FF6230", heart: "#FF3A5C",
  sleep: "#8B7FFF", steps: "#00D47E", ai: "#1f6feb", progress: "#F59E0B", muted: "#5C738F", text: "#DDE6F5",
};

const TABS = [
  { id: "activities", label: "Home", icon: Activity, color: C.run },
  { id: "progress",   label: "Progresso", icon: TrendingUp, color: C.progress },
  { id: "heartrate",  label: "FC", icon: Heart, color: C.heart },
  { id: "sleep",      label: "Sono", icon: Moon, color: C.sleep },
  { id: "steps",      label: "Passos", icon: BarChart2, color: C.steps },
  { id: "coach",      label: "Treinador", icon: Brain, color: C.ai },
];

export default function Dashboard({ displayName, onLogout }) {
  const [tab, setTab] = useState("activities");
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Cache de memória para a IA (Evita chamadas infinitas ao mudar de tab)
  const [aiBriefing, setAiBriefing] = useState(null);

  const handleRefresh = () => {
    setAiBriefing(null); // Limpa a cache da IA no refresh manual
    setRefreshKey(k => k + 1);
  };

  const panels = {
    activities: <ActivitiesPanel key={`act-${refreshKey}`} />,
    progress:   <ProgressPanel   key={`prg-${refreshKey}`} />,
    heartrate:  <HeartRatePanel  key={`hr-${refreshKey}`} />,
    sleep:      <SleepPanel      key={`sl-${refreshKey}`} />,
    steps:      <StepsPanel      key={`st-${refreshKey}`} />,
    coach:      <AICoach         key={`co-${refreshKey}`} briefing={aiBriefing} setBriefing={setAiBriefing} />
  };

  return (
    <>
      <style>{`
        .app-container { min-height: 100vh; background: ${C.bg0}; display: flex; flex-direction: column; padding-bottom: 70px; }
        .main-content { flex: 1; padding: 16px; max-width: 1140px; width: 100%; margin: 0 auto; }
        .nav-bar { background: ${C.bg1}; border-top: 1px solid ${C.border}; position: fixed; bottom: 0; left: 0; right: 0; z-index: 999; display: flex; justify-content: space-around; padding: 12px 8px calc(12px + env(safe-area-inset-bottom)) 8px; box-shadow: 0 -4px 20px rgba(0,0,0,0.4); }
        .nav-btn { background: transparent; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 10px; font-weight: 600; flex: 1; transition: all 0.2s; }
        .top-header { background: ${C.bg1}; border-bottom: 1px solid ${C.border}; padding: 12px 16px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 100; }
        @media (min-width: 768px) {
          .app-container { padding-bottom: 0; }
          .main-content { padding: 28px; }
          .top-header { padding: 14px 28px; }
          .nav-bar { border-top: none; border-bottom: 1px solid ${C.border}; position: sticky; top: 66px; justify-content: flex-start; padding: 0 28px; box-shadow: none; }
          .nav-btn { flex: unset; flex-direction: row; gap: 8px; font-size: 14px; padding: 13px 20px; }
        }
      `}</style>

      <div className="app-container">
        <header className="top-header">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 16px ${C.accent}40`, flexShrink: 0 }}>
            <Watch size={18} color={C.bg0} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em", color: C.text }}>Garmin Dashboard</div>
            {displayName && <div style={{ color: C.muted, fontSize: 11 }}>{displayName}</div>}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={handleRefresh} title="Atualizar dados" style={{ color: C.muted, padding: 8, borderRadius: 8, transition: "color 0.2s", background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = C.accent} onMouseLeave={e => e.currentTarget.style.color = C.muted}>
              <RefreshCw size={18} />
            </button>
            <button onClick={onLogout} title="Sair" style={{ color: C.muted, padding: 8, borderRadius: 8, transition: "color 0.2s", background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = C.heart} onMouseLeave={e => e.currentTarget.style.color = C.muted}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <nav className="nav-bar">
          {TABS.map(t => {
            const Icon = t.icon; const active = tab === t.id;
            return (
              <button key={t.id} className="nav-btn" onClick={() => setTab(t.id)} style={{ color: active ? t.color : C.muted }} onMouseEnter={e => { if (!active) e.currentTarget.style.color = C.text; }} onMouseLeave={e => { if (!active) e.currentTarget.style.color = C.muted; }}>
                <Icon size={20} style={{ filter: active ? `drop-shadow(0 0 4px ${t.color}60)` : 'none' }} /><span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <main className="main-content">
          {panels[tab]}
        </main>
      </div>
    </>
  );
}