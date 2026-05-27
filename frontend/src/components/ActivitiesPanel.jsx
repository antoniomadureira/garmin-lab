import { useState, useEffect } from "react";
import { Activity, Flame, Timer, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Cell } from "recharts";
import { fetchActivities } from "../api.js";
import { C, StatCard, Card, Tooltip, Spinner, ErrorBanner, toMinSec, actTypeLabel, actEmoji, actColor } from "./ui.jsx";

const paceFromSpeed = (mps) => {
  if (!mps || mps <= 0) return null;
  const minkm = 1000 / mps / 60;
  const m = Math.floor(minkm);
  const s = Math.round((minkm - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function ActivitiesPanel() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchActivities(25)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner msg={error} />;

  const runs = data.filter(a => ["running", "trail_running"].includes(a.activityType));
  const totalDistRun = runs.reduce((s, a) => s + (a.distance || 0), 0);
  const totalCal = data.reduce((s, a) => s + (a.calories || 0), 0);

  // Weekly distance chart
  const weekChart = data.slice(0, 7).reverse().map(a => ({
    name: new Date(a.startTimeLocal).toLocaleDateString("pt-PT", { weekday: "short" }),
    km: a.distance || 0,
    type: a.activityType,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <StatCard icon={<TrendingUp size={15} />} label="Distância (corridas)" value={totalDistRun.toFixed(1)} unit="km" color={C.run} sub={`${runs.length} corridas`} />
        <StatCard icon={<Flame size={15} />} label="Calorias totais" value={totalCal.toLocaleString("pt-PT")} unit="kcal" color={C.battery} sub={`${data.length} atividades`} />
        <StatCard icon={<Activity size={15} />} label="Atividades recentes" value={data.length} unit="sessões" color={C.accent} />
      </div>

      {/* Distance chart */}
      {weekChart.length > 0 && (
        <Card title="Distância — Últimas atividades">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weekChart} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="name" stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} />
              <YAxis stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} unit=" km" />
              <RTooltip content={<Tooltip formatter={(v) => `${v.toFixed(2)} km`} />} />
              <Bar dataKey="km" radius={[6, 6, 0, 0]} name="Distância">
                {weekChart.map((entry, i) => (
                  <Cell key={i} fill={actColor(entry.type, C)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Activity list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map(a => {
          const color = actColor(a.activityType, C);
          const pace = paceFromSpeed(a.averageSpeed);
          const dateStr = a.startTimeLocal
            ? new Date(a.startTimeLocal).toLocaleDateString("pt-PT", { day: "numeric", month: "short" })
            : "—";

          return (
            <div key={a.activityId} style={{
              background: C.bg2, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: "15px 20px",
              display: "flex", alignItems: "center", gap: 16,
              transition: "border-color 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = color}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${color}20`, display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0,
              }}>
                {actEmoji(a.activityType)}
              </div>

              {/* Name + type */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.activityName || actTypeLabel(a.activityType)}
                </div>
                <div style={{ color: C.muted, fontSize: 12 }}>
                  {dateStr} · {actTypeLabel(a.activityType)}
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display: "flex", gap: 20, flexShrink: 0, alignItems: "center" }}>
                {a.distance > 0 && (
                  <div style={{ textAlign: "center" }}>
                    <div className="stat-num" style={{ fontSize: 18, color }}>{a.distance.toFixed(2)}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>km</div>
                  </div>
                )}
                {pace && (
                  <div style={{ textAlign: "center" }}>
                    <div className="stat-num" style={{ fontSize: 18, color: C.text }}>{pace}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>min/km</div>
                  </div>
                )}
                {a.averageHR && (
                  <div style={{ textAlign: "center" }}>
                    <div className="stat-num" style={{ fontSize: 18, color: C.heart }}>{a.averageHR}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>bpm avg</div>
                  </div>
                )}
                {a.calories > 0 && (
                  <div style={{ textAlign: "center" }}>
                    <div className="stat-num" style={{ fontSize: 18, color: C.battery }}>{Math.round(a.calories)}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>kcal</div>
                  </div>
                )}
                {a.duration > 0 && (
                  <div style={{ textAlign: "center" }}>
                    <div className="stat-num" style={{ fontSize: 18, color: C.muted }}>{Math.round(a.duration)}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>min</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
