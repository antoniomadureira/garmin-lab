import { useEffect, useState } from "react";
import { Heart, TrendingUp, Zap } from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";
import { fetchHeartRateDay, fetchHeartRateWeekly } from "../api.js";
import { C, StatCard, Card, Tooltip, Spinner, ErrorBanner } from "./ui.jsx";

export default function HeartRatePanel() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [dayData, setDayData] = useState(null);
  const [weekData, setWeekData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetchHeartRateDay(today),
      fetchHeartRateWeekly(7),
    ])
      .then(([day, week]) => {
        setDayData(day);
        setWeekData(week);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner msg={error} />;

  // Build hourly chart from heartRateValues
  const hrValues = (dayData?.heartRateValues || [])
    .filter(([, v]) => v !== null && v > 0)
    .map(([ts, v]) => ({
      time: format(new Date(ts), "HH:mm"),
      hr: v,
    }));

  // Weekly chart data
  const weekChart = weekData.map(d => ({
    day: d.date ? format(new Date(d.date), "EEE", { locale: undefined }) : d.date,
    resting: d.restingHR,
    max: d.maxHR,
  }));

  const restingHR = dayData?.restingHeartRate || weekData.find(d => d.restingHR)?.restingHR || "—";
  const maxHR = dayData?.maxHeartRate || Math.max(...weekData.map(d => d.maxHR || 0)) || "—";
  const minHR = dayData?.minHeartRate || "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats */}
      <style>{`
        .hr-stats-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 480px) { .hr-stats-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
      <div className="hr-stats-grid">
        <StatCard icon={<Heart size={15} />} label="FC Repouso" value={restingHR} unit="bpm" color={C.heart} sub="Hoje" />
        <StatCard icon={<TrendingUp size={15} />} label="FC Máxima" value={maxHR} unit="bpm" color={C.run} sub="Esta semana" />
        <StatCard icon={<Zap size={15} />} label="FC Mínima" value={minHR} unit="bpm" color={C.accent} sub="Hoje" />
      </div>

      {/* Today's HR chart */}
      {hrValues.length > 0 && (
        <Card title="Frequência Cardíaca — Hoje">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hrValues}>
              <defs>
                <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.heart} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={C.heart} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="time" stroke={C.muted} tick={{ fontSize: 10, fill: C.muted }} interval={Math.floor(hrValues.length / 8)} />
              <YAxis stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} domain={["auto", "auto"]} unit=" bpm" />
              <RTooltip content={<Tooltip formatter={(v) => `${v} bpm`} />} />
              <Area type="monotone" dataKey="hr" stroke={C.heart} strokeWidth={2} fill="url(#hrGrad)" name="FC" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Weekly HR */}
      {weekChart.length > 0 && (
        <Card title="FC Repouso vs Máxima — Semana">
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={weekChart}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="day" stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} />
              <YAxis stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} unit=" bpm" />
              <RTooltip content={<Tooltip formatter={(v) => `${v} bpm`} />} />
              <Bar dataKey="max" fill={`${C.run}30`} radius={[4, 4, 0, 0]} name="FC Máx" />
              <Line type="monotone" dataKey="resting" stroke={C.accent} strokeWidth={2.5} dot={{ fill: C.accent, r: 4, strokeWidth: 0 }} name="FC Repouso" />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
              <div style={{ width: 10, height: 10, background: C.accent, borderRadius: "50%" }} /> FC Repouso
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
              <div style={{ width: 10, height: 10, background: `${C.run}80`, borderRadius: 2 }} /> FC Máxima
            </div>
          </div>
        </Card>
      )}

      {/* Stress if available */}
      {dayData?.startStressTimestampGMT && (
        <Card title="Stress — Hoje">
          <div style={{ color: C.muted, fontSize: 13 }}>
            Stress médio: <span style={{ color: C.battery, fontWeight: 700 }}>{dayData.avgStressLevel}</span> · 
            Stress máximo: <span style={{ color: C.run, fontWeight: 700 }}>{dayData.maxStressLevel}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
