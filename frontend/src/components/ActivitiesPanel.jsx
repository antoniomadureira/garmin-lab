import { useState, useEffect } from 'react';
import { Activity, Flame, Clock, Calendar, Heart, Zap, BarChart2, Info, RefreshCw, ArrowDown } from 'lucide-react';
import { BASE_URL } from '../config.js';

// Dicionário Oficial Garmin
const pt = (val) => {
  if (val === null || val === undefined || val === '') return '--';
  const str = String(val).toUpperCase();
  const dict = {
    'POOR': 'Fraca', 'LOW': 'Baixa', 'MODERATE': 'Moderada', 'HIGH': 'Alta', 
    'EXCELLENT': 'Excelente', 'PRIME': 'Máxima', 'BALANCED': 'Equilibrado', 
    'UNBALANCED': 'Desequilibrado', 'OPTIMAL': 'Ideal', 'MAINTAINING': 'Manutenção', 
    'PRODUCTIVE': 'Produtivo', 'RECOVERY': 'Recuperação', 'UNPRODUCTIVE': 'Improdutivo', 
    'DETRAINING': 'Destreino', 'OVERREACHING': 'Esforço Excessivo', 'PEAKING': 'Pico', 
    'SHORTAGE': 'Em Falta', 'STRAINED': 'Tenso', 'NO STATUS': 'Sem Estado',
    'AEROBIC SHORTAGE': 'Escassez Aeróbica', 'ANAEROBIC SHORTAGE': 'Escassez Anaeróbica'
  };
  return dict[str] || String(val);
};

// Cores Oficiais do Manual Garmin
const garminColors = {
  'OVERREACHING': '#FF3A5C', // Vermelho
  'PEAKING': '#8B7FFF',      // Roxo
  'PRODUCTIVE': '#00D47E',   // Verde
  'MAINTAINING': '#F59E0B',  // Amarelo
  'RECOVERY': '#00BFFF',     // Azul
  'STRAINED': '#D946EF',     // Magenta
  'UNPRODUCTIVE': '#FF6230', // Laranja
  'DETRAINING': '#5C738F',   // Cinzento Escuro
  'NO STATUS': '#5C738F'     // Cinzento
};

const getStatusColor = (statusText) => {
  if (!statusText || statusText === '--') return '#5C738F';
  return garminColors[String(statusText).toUpperCase()] || '#5C738F';
};

const Tooltip = ({ title, text, visible }) => {
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute', top: '100%', left: '0', zIndex: 50, marginTop: '8px',
      background: '#162233', border: '1px solid #1C2D47', padding: '16px', borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.8)', width: '300px', color: '#8b949e', fontSize: '12px', lineHeight: '1.5'
    }}>
      <div style={{ color: '#DDE6F5', fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>{title}</div>
      <div dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  );
};

// Motor Extrator Rigoroso (Verifica Chave + Tipo de Dado + Valores Válidos)
const findGarminData = (obj, keys, typeCheck = null, validValues = null) => {
  let result = null;
  const search = (node) => {
    if (result !== null || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) search(node[i]);
      return;
    }
    for (let key of keys) {
      if (node[key] !== undefined && node[key] !== null && node[key] !== '') {
        let val = node[key];
        if (!typeCheck || typeof val === typeCheck) {
          if (!validValues || validValues.includes(String(val).toUpperCase())) {
            result = val;
            return;
          }
        }
      }
    }
    Object.values(node).forEach(search);
  };
  search(obj);
  return result;
};

// Extrator para os sub-componentes (Sono, VFC, Carga)
const getComponentStatus = (obj, type) => {
  let status = '--';
  const search = (node) => {
    if (status !== '--' || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) search(node[i]);
      return;
    }
    if (node.componentType && String(node.componentType).toUpperCase().includes(type.toUpperCase())) {
      status = node.statusText || node.status || '--';
      return;
    }
    Object.values(node).forEach(search);
  };
  search(obj);
  return status;
};

export default function ActivitiesPanel() {
  const [activities, setActivities] = useState([]);
  const [focusData, setFocusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState('distance'); 
  const [monthsLoaded, setMonthsLoaded] = useState(1); 
  const [hoverInfo, setHoverInfo] = useState(null);
  const [loadingFocus, setLoadingFocus] = useState(true);

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

  const handleRefresh = () => {
    localStorage.removeItem("garmin_activities_ytd");
    localStorage.removeItem("garmin_activities_ytd_ts");
    window.location.reload();
  };

  useEffect(() => {
    let shouldFetchActivities = true;
    const token = localStorage.getItem("garmin_token");
    
    const cachedData = localStorage.getItem("garmin_activities_ytd");
    const cachedTs = localStorage.getItem("garmin_activities_ytd_ts");
    
    if (cachedData && cachedTs && (Date.now() - parseInt(cachedTs) < 3600000)) {
      setActivities(JSON.parse(cachedData));
      setLoading(false);
      shouldFetchActivities = false;
    }

    const fetchAllData = async () => {
      try {
        if (shouldFetchActivities) {
          const resAct = await fetch(`${BASE_URL}/activities/ytd`, { 
            headers: { "Authorization": `Bearer ${token}` } 
          });
          if (resAct.status === 401) { 
            localStorage.removeItem("garmin_token"); window.location.reload(); return; 
          }
          if (resAct.ok) {
            const data = await resAct.json();
            const validData = Array.isArray(data) ? data : [];
            setActivities(validData);
            localStorage.setItem("garmin_activities_ytd", JSON.stringify(validData));
            localStorage.setItem("garmin_activities_ytd_ts", Date.now().toString());
          }
        }

        setLoadingFocus(true);
        const resFocus = await fetch(`${BASE_URL}/training-focus`, { 
          headers: { "Authorization": `Bearer ${token}` } 
        });
        if (resFocus.status === 401) { 
          localStorage.removeItem("garmin_token"); window.location.reload(); return; 
        }
        if (resFocus.ok) {
          const data = await resFocus.json();
          setFocusData(data);
        }
      } catch (error) {
        console.error("Erro a carregar dados:", error);
      } finally {
        setLoading(false);
        setLoadingFocus(false);
      }
    };
    fetchAllData();
  }, []);

  // --- EXTRAÇÃO VALIDADA DE DADOS ---

  // 1. Prontidão
  const rScore = findGarminData(focusData?.readiness, ['readinessValue', 'readinessScore', 'score'], 'number') ?? '--';
  const rIndicator = findGarminData(focusData?.readiness, ['readinessIndicator', 'statusText', 'status'], 'string') ?? 'A Sincronizar';
  
  const getReadinessColor = (val) => {
    if(val === '--') return '#5C738F';
    const num = Number(val);
    if(isNaN(num)) return '#5C738F';
    if(num < 30) return '#FF3A5C'; 
    if(num < 50) return '#F59E0B'; 
    if(num < 70) return '#00D47E'; 
    if(num < 85) return '#00BFFF'; 
    return '#8B7FFF';              
  };

  const sleepStatus = getComponentStatus(focusData?.readiness, 'SLEEP');
  const recoveryStatus = getComponentStatus(focusData?.readiness, 'RECOVERY');
  const hrvStatusComp = getComponentStatus(focusData?.readiness, 'HRV');
  const acuteLoadStatus = getComponentStatus(focusData?.readiness, 'LOAD');

  // 2. Estado de Treino (Com filtro estrito pela lista oficial de estados)
  const validStatuses = Object.keys(garminColors);
  const tStatusRaw = findGarminData(focusData?.status, ['trainingStatus', 'statusText', 'trainingStatusText'], 'string', validStatuses);
  const tStatus = tStatusRaw ?? 'A Sincronizar';
  const tStatusColor = getStatusColor(tStatusRaw);

  const tLoadFocus = findGarminData(focusData?.status, ['loadFocus', 'primaryLoadFocus', 'trainingLoadFocus'], 'string') ?? '--';
  const tLoad = findGarminData(focusData?.status, ['loadStatus', 'acuteLoadStatus', 'acuteTrainingLoadStatus'], 'string') ?? '--';
  const tHrvStatus = findGarminData(focusData?.status, ['hrvStatus', 'hrvStatusText', 'hrvStatusValue'], 'string') ?? '--';
  
  const tVo2Raw = findGarminData(focusData?.status, ['vo2MaxValue', 'vo2Max', 'genericVo2Max'], 'number');
  const tVo2 = typeof tVo2Raw === 'number' ? tVo2Raw.toFixed(1) : '--';

  // --- CÁLCULOS YTD ---
  const runs = activities.filter(a => a.activityType.includes('running'));
  const totalDistance = runs.reduce((acc, curr) => acc + (curr.distance || 0), 0).toFixed(1);
  const totalCalories = activities.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const totalDurationMins = activities.reduce((acc, curr) => acc + (curr.duration || 0), 0);
  const totalDurationHours = Math.floor(totalDurationMins / 60);

  // --- CORRIDA 7 DIAS ---
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
      if (!r.startTimeLocal) return false;
      const rd = new Date(r.startTimeLocal);
      // Validar se a data foi parseada corretamente
      if (isNaN(rd.getTime())) return false;
      // Comparar ano, mês e dia para garantir correspondência exata
      return rd.getFullYear() === d.getFullYear() &&
             rd.getMonth() === d.getMonth() &&
             rd.getDate() === d.getDate();
    });
    const dayDist = dayRuns.reduce((acc, r) => acc + (r.distance || 0), 0);
    chart7d.push({ label: d.toLocaleDateString('pt-PT', {weekday:'short'}).charAt(0).toUpperCase(), val: dayDist });
  }
  const max7d = Math.max(...chart7d.map(d => d.val), 1) * 1.3; 

  // --- GRÁFICO DE VOLUME ---
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
      // Validar se a data foi parseada corretamente
      if (isNaN(actDate.getTime())) return;
      // Normalizar para comparação fiável (ignorar componente de hora)
      const actDateNorm = new Date(actDate.getFullYear(), actDate.getMonth(), actDate.getDate());
      const startNorm = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endNorm = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      if (actDateNorm >= startNorm && actDateNorm <= endNorm) {
        const index = Math.floor((actDateNorm - startNorm) / (1000 * 60 * 60 * 24));
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

  // --- FILTRO MENSAL (Carregamento Progressivo) ---
  const filteredActivities = activities.filter(act => {
    if (!act.startTimeLocal) return false;
    const actDate = new Date(act.startTimeLocal);
    // Validar se a data foi parseada corretamente
    if (isNaN(actDate.getTime())) return false;
    const diffMonths = (now.getFullYear() - actDate.getFullYear()) * 12 + (now.getMonth() - actDate.getMonth());
    return diffMonths < monthsLoaded;
  }).sort((a, b) => {
    const dateA = new Date(a.startTimeLocal);
    const dateB = new Date(b.startTimeLocal);
    // Se alguma data for inválida, manter a ordem original
    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
    return dateB - dateA;
  });

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

  if (loading && activities.length === 0) return <div style={{ color: '#5C738F' }}>A processar o teu painel central...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. SECÇÃO: EM FOCO */}
      <div>
        <h2 style={{ color: '#DDE6F5', fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Em Foco</h2>
        
        {loadingFocus ? (
            <div style={{ color: '#5C738F', padding: '24px', background: '#1c1c1e', borderRadius: '12px', border: '1px solid #2C2C2E' }}>
              A analisar a tua biometria diária da Garmin...
            </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          
          {/* SLIDE 1: Prontidão */}
          <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #2C2C2E', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DDE6F5', fontSize: '13px', fontWeight: 600 }}>
                <Zap size={16} color="#00BFFF" /> Prontidão de Treino
              </div>
              <div onMouseEnter={() => setHoverInfo('readiness')} onMouseLeave={() => setHoverInfo(null)} style={{ cursor: 'help', position: 'relative' }}>
                <Info size={16} color="#5C738F" />
                <Tooltip visible={hoverInfo === 'readiness'} title="Prontidão (Readiness)" text="Determina o seu nível de prontidão para um treino intenso no dia atual. Baseia-se no seu sono (qualidade e histórico), tempo de recuperação, carga de treino recente e estado da VFC." />
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '70px', height: '70px', overflow: 'visible' }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2C2C2E" strokeWidth="3.5" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={getReadinessColor(rScore)} strokeWidth="3.5" strokeDasharray={`${rScore === '--' ? 0 : rScore}, 100`} strokeLinecap="round" />
                <text x="18" y="23" fontSize="12" fill="#DDE6F5" textAnchor="middle" fontWeight="700">{rScore}</text>
              </svg>
              <div>
                <div style={{ color: '#DDE6F5', fontSize: '22px', fontWeight: 700, textTransform: 'capitalize' }}>{pt(rIndicator)}</div>
                <div style={{ color: '#8b949e', fontSize: '12px' }}>Atualizado hoje</div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px', textTransform:'capitalize'}}>{pt(sleepStatus)}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Sono</div></div>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px', textTransform:'capitalize'}}>{pt(recoveryStatus)}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Recuperação</div></div>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px', textTransform:'capitalize'}}>{pt(hrvStatusComp)}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Estado VFC</div></div>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px', textTransform:'capitalize'}}>{pt(acuteLoadStatus)}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Carga Aguda</div></div>
            </div>
          </div>

          {/* SLIDE 2: Corrida 7 Dias */}
          <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #2C2C2E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DDE6F5', fontSize: '13px', fontWeight: 600 }}>
              <Activity size={16} color="#FF6230" /> Corrida • Últimos 7 Dias
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', color: '#DDE6F5', fontSize: '32px', fontWeight: 700 }}>
              {dist7d} <span style={{ fontSize: '16px', color: '#8b949e' }}>km</span>
              <span style={{ fontSize: '16px', color: '#8b949e', marginLeft: 'auto' }}>{time7dStr}</span>
              <span style={{ fontSize: '16px', color: '#8b949e' }}>Tempo Total</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '80px', gap: '4px' }}>
              {chart7d.map((day, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '100%', height: `${(day.val / max7d) * 100}%`, background: '#FF6230', borderRadius: '2px' }}></div>
                  <div style={{ color: '#8b949e', fontSize: '10px' }}>{day.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SLIDE 3: Estado de Treino (Cores Garmin e Túnel de Carga Ideal Real) */}
          <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #2C2C2E', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DDE6F5', fontSize: '13px', fontWeight: 600 }}>
                <BarChart2 size={16} color={tStatusColor} /> Estado de Treino
              </div>
              <div onMouseEnter={() => setHoverInfo('trainingStatus')} onMouseLeave={() => setHoverInfo(null)} style={{ cursor: 'help', position: 'relative' }}>
                <Info size={16} color="#5C738F" />
                <Tooltip visible={hoverInfo === 'trainingStatus'} title="Estado de Treino" text="Avalia a eficácia do seu treino atual. A cor reflete a classificação oficial da Garmin." />
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: tStatusColor, boxShadow: `0 0 10px ${tStatusColor}60` }}></div>
              <div>
                <div style={{ color: '#DDE6F5', fontSize: '22px', fontWeight: 700, textTransform: 'capitalize' }}>{pt(tStatus)}</div>
                <div style={{ color: '#8b949e', fontSize: '12px' }}>Foco: {pt(tLoadFocus)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px'}}>{tVo2}</div><div style={{color: '#8b949e', fontSize: '11px'}}>VO2 Max</div></div>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px'}}>{pt(tLoad)}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Carga Aguda</div></div>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px'}}>{pt(tHrvStatus)}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Estado VFC</div></div>
            </div>

            {/* Barra Segmentada: Túnel de Carga Ideal Oficial */}
            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
              <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ flex: 1, background: '#00BFFF' }}></div> {/* Baixa (Azul) */}
                <div style={{ flex: 4, background: '#00D47E', borderLeft: '2px solid #1c1c1e', borderRight: '2px solid #1c1c1e' }}></div> {/* Ideal (Verde) */}
                <div style={{ flex: 1, background: '#FF3A5C' }}></div> {/* Alta (Vermelha) */}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', fontSize: '10px', marginTop: '6px' }}>
                <span>Baixa</span>
                <span>Túnel Ideal</span>
                <span>Alta</span>
              </div>
            </div>
          </div>

        </div>
        )}
      </div>

      {/* 2. TOTAIS YTD */}
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

      {/* 3. GRÁFICO DE ANÁLISE DE VOLUME */}
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

      {/* 4. ATIVIDADES RECENTES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ color: '#DDE6F5', fontSize: '20px', fontWeight: 700 }}>Atividades Recentes</h2>
        <button 
          onClick={handleRefresh}
          title="Sincronizar com a Garmin e forçar carregamento de novos treinos."
          style={{ 
            background: 'none', border: '1px solid #2C2C2E', borderRadius: '8px', 
            padding: '8px 12px', color: '#DDE6F5', fontSize: '13px', cursor: 'pointer', 
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
          onMouseEnter={e => {e.currentTarget.style.background = '#1c1c1e';}}
          onMouseLeave={e => {e.currentTarget.style.background = 'none';}}
        >
          <RefreshCw size={14} /> Atualizar Agora
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {filteredActivities.map(activity => (
          <div key={activity.activityId} style={{ background: '#1c1c1e', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #2C2C2E' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DDE6F5', fontSize: '13px', fontWeight: 600 }}>
                <Activity size={16} color="#FF6230" /> {activity.activityName || 'Atividade Desconhecida'}
              </div>
              <div style={{ color: '#8b949e', fontSize: '12px' }}>
                {new Date(activity.startTimeLocal).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', color: '#DDE6F5', fontSize: '32px', fontWeight: 700 }}>
              {activity.distance} <span style={{ fontSize: '16px', color: '#8b949e' }}>km</span>
              <span style={{ fontSize: '16px', color: '#8b949e', marginLeft: 'auto' }}>{formatDuration(activity.duration)}</span>
              <span style={{ fontSize: '16px', color: '#8b949e' }}>Duração</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px'}}>{calculatePace(activity.duration, activity.distance)}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Ritmo Médio</div></div>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px'}}>{activity.averageHR || '--'} bpm</div><div style={{color: '#8b949e', fontSize: '11px'}}>FC Média</div></div>
              <div><div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '13px'}}>{activity.calories || '--'} kcal</div><div style={{color: '#8b949e', fontSize: '11px'}}>Calorias</div></div>
              <div><div style={{color: getRunType(activity.distance).color, fontWeight: 600, fontSize: '13px'}}>{getRunType(activity.distance).label}</div><div style={{color: '#8b949e', fontSize: '11px'}}>Tipo de Corrida</div></div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Botão de Histórico (Exclusivamente no fundo) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
        <button 
          onClick={() => setMonthsLoaded(m => m + 1)}
          style={{ 
            background: 'transparent', border: '1px solid #2C2C2E', borderRadius: '8px', 
            padding: '10px 24px', color: '#DDE6F5', fontSize: '14px', fontWeight: 600, cursor: 'pointer', 
            display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s'
          }}
          onMouseEnter={e => {e.currentTarget.style.background = '#1c1c1e'; e.currentTarget.style.borderColor = '#5C738F';}}
          onMouseLeave={e => {e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#2C2C2E';}}
        >
          <ArrowDown size={16} color="#00BFFF" /> Carregar atividades do mês seguinte
        </button>
      </div>

    </div>
  );
}