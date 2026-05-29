import { useState, useEffect } from 'react';
import { Activity, Flame, Clock, Calendar, Heart, Zap, BarChart2 } from 'lucide-react';

// O "SUPER CAÇADOR DE CHAVES": Encontra a chave em qualquer pasta do JSON da Garmin
const findGarminValue = (obj, possibleKeys) => {
  let result = null;
  const search = (node) => {
    if (result !== null || !node || typeof node !== 'object') return;
    for (let key of possibleKeys) {
      if (key in node && node[key] !== null && node[key] !== undefined && node[key] !== '') {
        result = node[key];
        return;
      }
    }
    Object.values(node).forEach(search);
  };
  search(obj);
  return result;
};

// Extrator específico para os sub-componentes de Prontidão (Sono, Recuperação, etc.)
const getComponentStatus = (focusData, keyword) => {
  let status = '--';
  const search = (node) => {
    if (status !== '--' || !node || typeof node !== 'object') return;
    if (node.componentType && typeof node.componentType === 'string' && node.componentType.includes(keyword)) {
      status = node.status || node.statusText || '--';
      return;
    }
    Object.values(node).forEach(search);
  };
  search(focusData?.readiness);
  return status;
};

export default function ActivitiesPanel() {
  const [activities, setActivities] = useState([]);
  const [focusData, setFocusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState('distance'); 
  const [showAllActivities, setShowAllActivities] = useState(false);
  
  const getInitialDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; 
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  };

  const [startDate, setStartDate] = useState(getInitialDates().start);
  const [endDate, setEndDate] = useState(getInitialDates().end);

  const token = localStorage.getItem("garmin_token");
  const baseUrl = "https://garmin-lab.onrender.com";

  useEffect(() => {
    const cachedData = localStorage.getItem("garmin_activities_ytd");
    if (cachedData) { setActivities(JSON.parse(cachedData)); setLoading(false); }

    const fetchAllData = async () => {
      try {
        const resAct = await fetch(`${baseUrl}/activities/ytd`, { headers: { "Authorization": `Bearer ${token}` } });
        if (resAct.ok) {
          const data = await resAct.json();
          const validData = Array.isArray(data) ? data : [];
          setActivities(validData);
          localStorage.setItem("garmin_activities_ytd", JSON.stringify(validData));
        }

        const resFocus = await fetch(`${baseUrl}/training-focus`, { headers: { "Authorization": `Bearer ${token}` } });
        if (resFocus.ok) {
          setFocusData(await resFocus.json());
        }
      } catch (error) {
        console.error("Erro a carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [baseUrl, token]);

  // Cálculos YTD
  const runs = activities.filter(a => a.activityType.includes('running'));
  const totalDistance = runs.reduce((acc, curr) => acc + (curr.distance || 0), 0).toFixed(1);
  const totalCalories = activities.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const totalDurationMins = activities.reduce((acc, curr) => acc + (curr.duration || 0), 0);
  const totalDurationHours = Math.floor(totalDurationMins / 60);

  // --- LÓGICA DO "EM FOCO" (Extração Blindada) ---
  const rScore = findGarminValue(focusData?.readiness, ['readinessValue', 'readinessScore', 'score', 'value']) ?? '--';
  const rIndicator = findGarminValue(focusData?.readiness, ['readinessIndicator', 'indicatorText', 'statusLabel']) ?? 'A Sincronizar';
  
  const getReadinessColor = (val) => {
    if(val === '--') return '#5C738F';
    if(val < 30) return '#FF3A5C'; 
    if(val < 50) return '#F59E0B'; 
    if(val < 70) return '#00D47E'; 
    if(val < 85) return '#00BFFF'; 
    return '#8B7FFF';              
  };

  const sleepStatus = getComponentStatus(focusData, 'SLEEP');
  const recoveryStatus = getComponentStatus(focusData, 'RECOVERY');
  const hrvStatus = getComponentStatus(focusData, 'HRV');
  const acuteLoadStatus = getComponentStatus(focusData, 'LOAD');

  const tStatus = findGarminValue(focusData?.status, ['trainingStatus', 'statusText']) ?? 'A Sincronizar';
  const tLoadFocus = findGarminValue(focusData?.status, ['loadFocus']) ?? '--';
  const tVo2 = findGarminValue(focusData?.status, ['vo2MaxStatus', 'vo2Max']) ?? '--';
  const tLoad = findGarminValue(focusData?.status, ['loadStatus']) ?? '--';
  const tHrvStatus = findGarminValue(focusData?.status, ['hrvStatus', 'hrvStatusText']) ?? '--';

  // Corrida dos últimos 7 dias (Gráfico atualizado)
  const now = new Date();
  const start7d = new Date();
  start7d.setDate(now.getDate() - 6);
  start7d.setHours(0,0,0,0);
  const runs7d = runs.filter(a => new Date(a.startTimeLocal) >= start7d);
  const dist7d = runs7d.reduce((acc, a) => acc + (a.distance || 0), 0).toFixed(2);
  const time7dMins = runs7d.reduce((acc, a) => acc + (a.duration || 0), 0);
  const time7dStr = `${Math.floor(time7dMins/60)}:${Math.round(time7dMins%60).toString().padStart(2, '0')}h`;

  const chart7d = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start7d);
    d.setDate(d.getDate() + i);
    const dayRuns = runs7d.filter(r => {
      const rd = new Date(r.startTimeLocal);
      return rd.getDate() === d.getDate() && rd.getMonth() === d.getMonth();
    });
    const dayDist = dayRuns.reduce((acc, r) => acc + (r.distance || 0), 0);
    chart7d.push({ label: d.toLocaleDateString('pt-PT', {weekday:'short'}).charAt(0).toUpperCase(), val: dayDist });
  }
  const max7d = Math.max(...chart7d.map(d => d.val), 1) * 1.2; // 20% de margem no topo

  // --- Lógica do Gráfico de Volume ---
  const getChartData = () => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    start.setHours(0,0,0,0);
    const end = new Date(endDate);
    end.setHours(23,59,59,999);

    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    let localChartData = [];
    const displayDays = diffDays > 31 ? 31 : diffDays;
    const isLongRange = displayDays > 7; 

    for (let i = 0; i < displayDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      let labelStr = isLongRange 
        ? d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
        : d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' });
      localChartData.push({ label: labelStr, date: d, distance: 0, calories: 0, duration: 0 });
    }

    activities.forEach(act => {
      if (!act.startTimeLocal) return;
      const actDate = new Date(act.startTimeLocal);
      if (actDate >= start && actDate <= end) {
        const index = Math.floor((actDate - start) / (1000 * 60 * 60 * 24));
        if (localChartData[index]) {
          localChartData[index].distance += act.distance || 0;
          localChartData[index].calories += act.calories || 0;
          localChartData[index].duration += act.duration || 0;
        }
      }
    });
    return localChartData;
  };

  const chartData = getChartData();
  const maxMetricValue = Math.max(...chartData.map(d => d[activeMetric]), 1) * 1.1; 
  const showIconsOnBars = chartData.length <= 7;

  // --- Filtro de Atividades ---
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const filteredActivities = activities.filter(act => {
    if (!act.startTimeLocal) return false;
    const actDate = new Date(act.startTimeLocal);
    if (showAllActivities) return true;
    return actDate.getMonth() === currentMonth && actDate.getFullYear() === currentYear;
  }).sort((a, b) => new Date(b.startTimeLocal) - new Date(a.startTimeLocal));

  // --- Helpers ---
  const formatDuration = (mins) => {
    if (!mins) return "-";
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}m`;
  };
  const calculatePace = (mins, km) => {
    if (!mins || !km || km === 0) return "-";
    const pDec = mins / km;
    const pMin = Math.floor(pDec);
    const pSec = Math.round((pDec - pMin) * 60);
    return `${pMin}:${pSec.toString().padStart(2, '0')}/km`;
  };
  const getRunType = (km) => {
    if (!km) return { label: 'Outro', color: '#5C738F' };
    if (km >= 21) return { label: 'Meia Maratona+', color: '#8B7FFF' };
    if (km > 15) return { label: 'Longo', color: '#FF3A5C' };
    if (km > 10) return { label: 'Médio-Longo', color: '#1f6feb' };
    return { label: 'Curto', color: '#5C738F' };
  };
  const getHeartRateZone = (bpm) => {
    if (!bpm) return { color: '#5C738F' };
    if (bpm <= 109) return { color: '#8b949e' }; 
    if (bpm <= 139) return { color: '#00D47E' }; 
    if (bpm <= 149) return { color: '#FBBF24' }; 
    if (bpm <= 167) return { color: '#FF6230' }; 
    return { color: '#FF3A5C' };                 
  };

  if (loading && activities.length === 0) return <div style={{ color: '#5C738F' }}>A sincronizar histórico local...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div>
        <h2 style={{ color: '#DDE6F5', fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Em Foco</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          
          <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #2C2C2E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DDE6F5', fontSize: '13px', fontWeight: 600 }}>
              <Zap size={16} color="#00BFFF" /> Prontidão de Treino
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '70px', height: '70px', overflow: 'visible' }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2C2C2E" strokeWidth="3.5" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={getReadinessColor(rScore)} strokeWidth="3.5" strokeDasharray={`${rScore === '--' ? 0 : rScore}, 100`} strokeLinecap="round" />
                <text x="18" y="23" fontSize="12" fill="#DDE6F5" textAnchor="middle" fontWeight="700">{rScore}</text>
              </svg>
              <div>
                <div style={{ color: '#DDE6F5', fontSize: '22px', fontWeight: 700, textTransform: 'capitalize' }}>{rIndicator.toLowerCase()}</div>
                <div style={{ color: '#8b949e', fontSize: '12px' }}>Atualizado hoje</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px', textTransform:'capitalize'}}>{sleepStatus.toLowerCase()}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Sono</div></div>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px', textTransform:'capitalize'}}>{recoveryStatus.toLowerCase()}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Recuperação</div></div>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px', textTransform:'capitalize'}}>{hrvStatus.toLowerCase()}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Estado VFC</div></div>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px', textTransform:'capitalize'}}>{acuteLoadStatus.toLowerCase()}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Carga Aguda</div></div>
            </div>
          </div>

          <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', border: '1px solid #2C2C2E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DDE6F5', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>
              <Activity size={16} color="#F59E0B" /> Corrida • Últimos 7 Dias
            </div>
            
            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
              <div>
                <div style={{ color: '#DDE6F5', fontSize: '28px', fontWeight: 700 }}>{dist7d} <span style={{fontSize: '14px', fontWeight: 500}}>km</span></div>
              </div>
              <div>
                <div style={{ color: '#DDE6F5', fontSize: '18px', fontWeight: 600, marginTop: '4px' }}>{time7dStr}</div>
                <div style={{ color: '#8b949e', fontSize: '11px' }}>Tempo Total</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '110px', marginTop: 'auto', borderBottom: '1px solid #2C2C2E', paddingBottom: '4px' }}>
              {chart7d.map((d, i) => {
                const hPercentage = d.val > 0 ? Math.max((d.val / max7d) * 100, 5) : 0; // Altura minima de 5%
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                    {d.val > 0 && (
                      <span style={{ fontSize: '10px', color: '#DDE6F5', fontWeight: 600, marginBottom: '4px' }}>
                        {d.val.toFixed(1)}
                      </span>
                    )}
                    <div style={{ width: '16px', height: `${hPercentage}%`, background: '#00BFFF', borderRadius: '4px 4px 0 0' }}></div>
                    <span style={{ fontSize: '10px', color: '#8b949e', marginTop: '8px' }}>{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', border: '1px solid #2C2C2E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DDE6F5', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>
              <BarChart2 size={16} color="#8B7FFF" /> Estado de Treino
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ width: '40px', height: '40px', borderRadius: '20px', background: '#00BFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Activity size={20} color="#0B1221" />
                </div>
                <div style={{ color: '#DDE6F5', fontSize: '22px', fontWeight: 700, textTransform: 'capitalize' }}>{tStatus.toLowerCase()}</div>
                <div style={{ color: '#DDE6F5', fontSize: '12px', marginTop: '2px', textTransform: 'capitalize' }}>Foco: {tLoadFocus.toLowerCase()}</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize'}}>{tVo2}</div><div style={{color: '#8b949e', fontSize: '11px'}}>VO2 Max</div></div>
                <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize'}}>{tLoad.toLowerCase()}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Carga</div></div>
                <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize'}}>{tHrvStatus.toLowerCase()}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Estado VFC</div></div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
              <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ flex: 1, background: '#FF3A5C' }}></div>
                <div style={{ flex: 2, background: '#F59E0B', borderLeft: '2px solid #1c1c1e', borderRight: '2px solid #1c1c1e' }}></div>
                <div style={{ flex: 5, background: '#FF6230' }}></div>
                <div style={{ flex: 2, background: '#00D47E', borderLeft: '2px solid #1c1c1e', borderRight: '2px solid #1c1c1e' }}></div>
                <div style={{ flex: 1, background: '#00BFFF' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', fontSize: '10px', marginTop: '6px' }}>
                <span>Últimas 4s</span>
                <span>Hoje</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div style={{ background: '#0B1221', padding: '24px', borderRadius: '12px', border: '1px solid #1C2D47' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5C738F', marginBottom: '12px' }}>
            <Activity size={18} color="#FF6230" />
            <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}>DISTÂNCIA (CORRIDAS)</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#FF6230' }}>
            {totalDistance} <span style={{ fontSize: '16px', color: '#5C738F', fontWeight: 500 }}>km</span>
          </div>
          <div style={{ color: '#5C738F', fontSize: '13px', marginTop: '8px' }}>{runs.length} corridas YTD</div>
        </div>

        <div style={{ background: '#0B1221', padding: '24px', borderRadius: '12px', border: '1px solid #1C2D47' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5C738F', marginBottom: '12px' }}>
            <Clock size={18} color="#00BFFF" />
            <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}>TEMPO TOTAL (YTD)</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#00BFFF' }}>
            {totalDurationHours} <span style={{ fontSize: '16px', color: '#5C738F', fontWeight: 500 }}>horas</span>
          </div>
          <div style={{ color: '#5C738F', fontSize: '13px', marginTop: '8px' }}>{activities.length} atividades totais</div>
        </div>

        <div style={{ background: '#0B1221', padding: '24px', borderRadius: '12px', border: '1px solid #1C2D47' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5C738F', marginBottom: '12px' }}>
            <Flame size={18} color="#FBBF24" />
            <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}>CALORIAS TOTAIS (YTD)</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#FBBF24' }}>
            {totalCalories.toLocaleString()} <span style={{ fontSize: '16px', color: '#5C738F', fontWeight: 500 }}>kcal</span>
          </div>
          <div style={{ color: '#5C738F', fontSize: '13px', marginTop: '8px' }}>Combustão metabólica</div>
        </div>
      </div>

      <div style={{ background: '#0B1221', padding: '24px', borderRadius: '12px', border: '1px solid #1C2D47' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '1px', color: '#5C738F', textTransform: 'uppercase' }}>
              Análise de Volume
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#5C738F" />
              <input 
                type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} 
                style={{ background: '#1C2D47', border: 'none', color: '#DDE6F5', fontSize: '13px', padding: '6px 10px', borderRadius: '6px', outline: 'none', colorScheme: 'dark', cursor: 'pointer' }} 
              />
              <span style={{ color: '#5C738F', fontSize: '13px' }}>até</span>
              <input 
                type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} 
                style={{ background: '#1C2D47', border: 'none', color: '#DDE6F5', fontSize: '13px', padding: '6px 10px', borderRadius: '6px', outline: 'none', colorScheme: 'dark', cursor: 'pointer' }} 
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setActiveMetric('distance')} style={{ background: activeMetric === 'distance' ? '#FF6230' : 'transparent', color: activeMetric === 'distance' ? '#000' : '#5C738F', border: `1px solid ${activeMetric === 'distance' ? '#FF6230' : '#1C2D47'}`, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: '0.2s' }}>Distância</button>
            <button onClick={() => setActiveMetric('calories')} style={{ background: activeMetric === 'calories' ? '#FBBF24' : 'transparent', color: activeMetric === 'calories' ? '#000' : '#5C738F', border: `1px solid ${activeMetric === 'calories' ? '#FBBF24' : '#1C2D47'}`, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: '0.2s' }}>Calorias</button>
            <button onClick={() => setActiveMetric('duration')} style={{ background: activeMetric === 'duration' ? '#00BFFF' : 'transparent', color: activeMetric === 'duration' ? '#000' : '#5C738F', border: `1px solid ${activeMetric === 'duration' ? '#00BFFF' : '#1C2D47'}`, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: '0.2s' }}>Tempo</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '260px', borderBottom: '1px solid #1C2D47', paddingBottom: '8px', width: '100%', gap: '4px' }}>
          {chartData.map((data, idx) => {
            const val = data[activeMetric];
            const heightPercentage = val > 0 ? Math.max((val / maxMetricValue) * 100, 2) : 0; 
            const barColor = activeMetric === 'distance' ? '#FF6230' : activeMetric === 'calories' ? '#FBBF24' : '#00BFFF';
            
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0, height: '100%' }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {val > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: showIconsOnBars ? '12px' : '10px', color: '#DDE6F5', fontWeight: 600, marginBottom: '6px' }}>
                      {showIconsOnBars && activeMetric === 'distance' && <Activity size={10} color={barColor} />}
                      {showIconsOnBars && activeMetric === 'calories' && <Flame size={10} color={barColor} />}
                      {showIconsOnBars && activeMetric === 'duration' && <Clock size={10} color={barColor} />}
                      {activeMetric === 'distance' ? val.toFixed(1) : Math.round(val)}
                    </div>
                  )}
                  <div style={{ width: '100%', maxWidth: '32px', height: `${heightPercentage}%`, background: barColor, borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease-out' }}></div>
                </div>
                <div style={{ height: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', overflow: 'hidden', marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#5C738F', textAlign: 'center', whiteSpace: 'nowrap' }}>{data.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: '#0B1221', padding: '24px', borderRadius: '12px', border: '1px solid #1C2D47' }}>
        <h3 style={{ color: '#DDE6F5', fontSize: '16px', margin: '0 0 24px 0' }}>Histórico de Atividades</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredActivities.length === 0 ? (
            <div style={{ padding: '16px', color: '#5C738F', textAlign: 'center' }}>Nenhuma atividade neste período.</div>
          ) : (
            filteredActivities.map(act => {
              const isRun = act.activityType.includes('running');
              const hrZone = getHeartRateZone(act.averageHR);
              const runType = getRunType(act.distance);

              return (
                <div key={act.activityId} style={{ background: '#05090F', borderRadius: '12px', padding: '20px', border: '1px solid #1C2D47' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#DDE6F5' }}>
                        {act.activityName || act.activityType}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: hrZone.color, fontWeight: 700, fontSize: '14px' }}>
                      <Heart size={14} fill={hrZone.color} /> {act.averageHR || '--'}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    {isRun && act.distance > 0 && (
                      <span style={{ background: 'transparent', color: runType.color, border: `1px solid ${runType.color}40`, padding: '4px 10px', borderRadius: '16px', fontSize: '11px', fontWeight: 600 }}>
                        {runType.label}
                      </span>
                    )}
                    <span style={{ color: '#5C738F', fontSize: '13px' }}>
                      {new Date(act.startTimeLocal).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div style={{ background: '#0B1221', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1C2D47' }}>
                      <div style={{ color: '#5C738F', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Distância</div>
                      <div style={{ color: '#DDE6F5', fontSize: '18px', fontWeight: 700 }}>
                        {act.distance ? act.distance.toFixed(1) : '-'} <span style={{ fontSize: '12px', color: '#5C738F', fontWeight: 500 }}>km</span>
                      </div>
                    </div>
                    <div style={{ background: '#0B1221', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1C2D47' }}>
                      <div style={{ color: '#5C738F', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Ritmo</div>
                      <div style={{ color: '#DDE6F5', fontSize: '18px', fontWeight: 700 }}>
                        {isRun && act.distance > 0 ? calculatePace(act.duration, act.distance) : '-'}
                      </div>
                    </div>
                    <div style={{ background: '#0B1221', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1C2D47' }}>
                      <div style={{ color: '#5C738F', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Tempo</div>
                      <div style={{ color: '#DDE6F5', fontSize: '18px', fontWeight: 700 }}>
                        {formatDuration(act.duration)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button 
            onClick={() => setShowAllActivities(!showAllActivities)}
            style={{ background: 'transparent', color: '#00BFFF', border: '1px solid #00BFFF', padding: '8px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            {showAllActivities ? "Mostrar Apenas Este Mês" : "Carregar Histórico Completo"}
          </button>
        </div>
      </div>
    </div>
  );
}