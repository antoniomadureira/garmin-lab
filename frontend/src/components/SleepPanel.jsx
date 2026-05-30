import { useEffect, useState } from "react";
import { Moon, Zap, Activity, Clock } from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";
import { fetchSleepWeekly } from "../api.js";
import { C, StatCard, Card, Tooltip, Spinner, ErrorBanner, secsToHM } from "./ui.jsx";

const STAGE_COLORS = {
  deep: "#5BE8FF", rem: C.sleep, light: `${C.sleep}55`, awake: `${C.muted}40`,
};

export default function SleepPanel() {
  const [weekData, setWeekData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSleepWeekly(7)
      .then(setWeekData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner msg={error} />;

  // Last valid night
  const lastNight = [...weekData].reverse().find(d => d.deepSleepSeconds != null) || {};

  const chartData = weekData.map(d => ({
    day: d.date ? format(new Date(d.date), "EEE") : "",
    deep: Math.round((d.deepSleepSeconds || 0) / 60),
    rem: Math.round((d.remSleepSeconds || 0) / 60),
    light: Math.round((d.lightSleepSeconds || 0) / 60),
    awake: Math.round((d.awakeSleepSeconds || 0) / 60),
    score: d.sleepScore || null,
  }));

  const totalMinLast = (
    (lastNight.deepSleepSeconds || 0) +
    (lastNight.lightSleepSeconds || 0) +
    (lastNight.remSleepSeconds || 0)
  ) / 60;

  const avgScore = weekData.filter(d => d.sleepScore).reduce((s, d, _, a) => s + d.sleepScore / a.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`
        .sleep-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .sleep-distribution { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (min-width: 768px) {
          .sleep-stats-grid { grid-template-columns: repeat(4, 1fr); }
          .sleep-distribution { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>

      {/* Stats */}
      <div className="sleep-stats-grid">
        <StatCard icon={<Moon size={15} />} label="Score Sono" value={lastNight.sleepScore ?? "—"} unit="/100" color={C.sleep} sub="Ontem" />
        <StatCard icon={<Clock size={15} />} label="Duração Total" value={secsToHM((lastNight.deepSleepSeconds || 0) + (lastNight.lightSleepSeconds || 0) + (lastNight.remSleepSeconds || 0))} unit="" color={C.text} sub="Ontem" />
        <StatCard icon={<Zap size={15} />} label="Sono Profundo" value={secsToHM(lastNight.deepSleepSeconds)} unit="" color="#5BE8FF" sub="Ontem" />
        <StatCard icon={<Activity size={15} />} label="Score Médio" value={avgScore ? Math.round(avgScore) : "—"} unit="/100" color={C.accent} sub="7 dias" />
      </div>

      {/* Sleep stages stacked */}
      <Card title="Fases do Sono — Semana (minutos)">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="day" stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} />
            <YAxis stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} unit=" m" />
            <RTooltip content={<Tooltip formatter={(v) => `${v} min`} />} />
            <Bar dataKey="deep" stackId="s" fill={STAGE_COLORS.deep} radius={0} name="Profundo" />
            <Bar dataKey="rem" stackId="s" fill={STAGE_COLORS.rem} radius={0} name="REM" />
            <Bar dataKey="light" stackId="s" fill={STAGE_COLORS.light} radius={0} name="Leve" />
            <Bar dataKey="awake" stackId="s" fill={STAGE_COLORS.awake} radius={[4, 4, 0, 0]} name="Acordado" />
          </BarChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
          {[["Profundo", STAGE_COLORS.deep], ["REM", STAGE_COLORS.rem], ["Leve", STAGE_COLORS.light], ["Acordado", STAGE_COLORS.awake]].map(([name, color]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
              <div style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
              {name}
            </div>
          ))}
        </div>
      </Card>

      {/* Score trend */}
      <Card title="Score de Sono — Tendência">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData.filter(d => d.score)}>
            <defs>
              <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.sleep} stopOpacity={0.4} />
                <stop offset="95%" stopColor={C.sleep} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="day" stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} />
            <YAxis stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} domain={[40, 100]} />
            <RTooltip content={<Tooltip formatter={(v) => `${v} pts`} />} />
            <Area type="monotone" dataKey="score" stroke={C.sleep} strokeWidth={2.5} fill="url(#sleepGrad)" dot={{ fill: C.sleep, r: 4, strokeWidth: 0 }} name="Score" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Stages breakdown for last night */}
      {totalMinLast > 0 && (
        <Card title="Distribuição — Ontem">
          <div className="sleep-distribution">
            {[
              { label: "Profundo", secs: lastNight.deepSleepSeconds, color: STAGE_COLORS.deep, pct: Math.round((lastNight.deepSleepSeconds / (totalMinLast * 60)) * 100) },
              { label: "REM", secs: lastNight.remSleepSeconds, color: STAGE_COLORS.rem, pct: Math.round((lastNight.remSleepSeconds / (totalMinLast * 60)) * 100) },
              { label: "Leve", secs: lastNight.lightSleepSeconds, color: STAGE_COLORS.light, pct: Math.round((lastNight.lightSleepSeconds / (totalMinLast * 60)) * 100) },
              { label: "Acordado", secs: lastNight.awakeSleepSeconds, color: STAGE_COLORS.awake, pct: Math.round((lastNight.awakeSleepSeconds / (totalMinLast * 60)) * 100) },
            ].map(s => (
              <div key={s.label} style={{
                background: C.bg3, borderRadius: 12, padding: "14px 10px",
                border: `1px solid ${C.border}`, textAlign: "center",
              }}>
                <div className="stat-num" style={{ fontSize: 22, color: s.color }}>{secsToHM(s.secs)}</div>
                <div style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: 11, fontWeight: 600, marginTop: 2 }}>{s.pct}%</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
