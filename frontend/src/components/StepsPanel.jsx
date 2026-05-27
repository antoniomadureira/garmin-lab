import { useEffect, useState } from "react";
import { BarChart2, Flame, Zap } from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Cell, ReferenceLine,
} from "recharts";
import { fetchSteps, fetchBodyBattery, fetchStats } from "../api.js";
import { C, StatCard, Card, Tooltip, Spinner, ErrorBanner } from "./ui.jsx";

const STEP_GOAL = 10000;

export default function StepsPanel() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [stepsData, setStepsData] = useState([]);
  const [batteryData, setBatteryData] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetchSteps(7),
      fetchBodyBattery(7),
      fetchStats(today),
    ])
      .then(([steps, battery, stats]) => {
        setStepsData(steps || []);
        setBatteryData(battery || []);
        setTodayStats(stats);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner msg={error} />;

  // Steps chart
  const stepsChart = stepsData.map(d => ({
    day: d.calendarDate ? format(new Date(d.calendarDate), "EEE") : "",
    steps: d.totalSteps || 0,
    goal: d.stepGoal || STEP_GOAL,
  }));

  // Battery chart (flatten daily arrays)
  const battChart = batteryData.flatMap(day =>
    (day.bodyBatteryValuesArray || []).map(([ts, val]) => ({
      time: format(new Date(ts), "HH:mm"),
      battery: val,
      date: format(new Date(ts), "dd/MM"),
    }))
  ).slice(-48); // last 48 datapoints

  const todayEntry = stepsData.find(d => d.calendarDate === today) || stepsData[stepsData.length - 1];
  const todaySteps = todayEntry?.totalSteps || todayStats?.totalSteps || 0;
  const todayCal = todayStats?.totalKilocalories || todayEntry?.totalKilocalories || 0;
  const activeCal = todayStats?.activeKilocalories || 0;
  const progress = Math.min((todaySteps / STEP_GOAL) * 100, 100);

  const currentBattery = battChart.length > 0 ? battChart[battChart.length - 1].battery : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <StatCard icon={<BarChart2 size={15} />} label="Passos Hoje" value={todaySteps.toLocaleString("pt-PT")} unit="passos" color={C.steps} sub={`${Math.round(progress)}% do objetivo`} />
        <StatCard icon={<Flame size={15} />} label="Calorias Hoje" value={Math.round(todayCal).toLocaleString("pt-PT")} unit="kcal" color={C.battery} sub={activeCal ? `${Math.round(activeCal)} kcal ativas` : ""} />
        <StatCard icon={<Zap size={15} />} label="Body Battery" value={currentBattery != null ? currentBattery : "—"} unit="%" color={C.battery} sub="Energia atual" />
      </div>

      {/* Progress bar */}
      <Card title="Objetivo Diário de Passos">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ color: C.muted, fontSize: 13 }}>
            {todaySteps.toLocaleString("pt-PT")} / {STEP_GOAL.toLocaleString("pt-PT")} passos
          </span>
          <span style={{ color: progress >= 100 ? C.steps : C.battery, fontWeight: 700, fontSize: 13 }}>
            {progress >= 100 ? "✓ Objetivo atingido!" : `${Math.round(progress)}%`}
          </span>
        </div>
        <div style={{ background: C.bg3, borderRadius: 999, height: 14, overflow: "hidden" }}>
          <div style={{
            width: `${progress}%`, height: "100%",
            background: `linear-gradient(90deg, ${C.steps}, #00FFB3)`,
            borderRadius: 999, transition: "width 0.8s ease",
            boxShadow: `0 0 12px ${C.steps}80`,
          }} />
        </div>
      </Card>

      {/* Steps chart */}
      {stepsChart.length > 0 && (
        <Card title="Passos — Últimos 7 dias">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stepsChart} barSize={30}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="day" stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} />
              <YAxis stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} />
              <RTooltip content={<Tooltip formatter={(v) => v.toLocaleString("pt-PT")} />} />
              <ReferenceLine y={STEP_GOAL} stroke={`${C.accent}50`} strokeDasharray="4 4" label={{ value: "Objetivo", fill: C.muted, fontSize: 11 }} />
              <Bar dataKey="steps" radius={[6, 6, 0, 0]} name="Passos">
                {stepsChart.map((entry, i) => (
                  <Cell key={i} fill={entry.steps >= entry.goal ? C.steps : `${C.steps}60`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Body battery */}
      {battChart.length > 0 && (
        <Card title="Body Battery — Últimas 48h">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={battChart}>
              <defs>
                <linearGradient id="battGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.battery} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={C.battery} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="time" stroke={C.muted} tick={{ fontSize: 10, fill: C.muted }} interval={Math.floor(battChart.length / 8)} />
              <YAxis stroke={C.muted} tick={{ fontSize: 11, fill: C.muted }} domain={[0, 100]} unit="%" />
              <RTooltip content={<Tooltip formatter={(v) => `${v}%`} />} />
              <Area type="monotone" dataKey="battery" stroke={C.battery} strokeWidth={2.5} fill="url(#battGrad)" dot={false} name="Battery" />
            </AreaChart>
          </ResponsiveContainer>
          {/* Battery zones */}
          <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
            {[["76-100 Alta", "#00D47E"], ["51-75 Média", "#FFB800"], ["26-50 Baixa", "#FF8C00"], ["0-25 Crítica", C.heart]].map(([label, color]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted }}>
                <div style={{ width: 8, height: 8, background: color, borderRadius: "50%" }} />{label}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
