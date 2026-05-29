import { useState, useEffect } from 'react';
import { Activity, Flame, Clock, Calendar, Heart, Zap, BarChart2, Info } from 'lucide-react';
import { BASE_URL } from '../config.js';

// Dicionário Oficial Garmin (Fenix PT-BR / PT-PT)
const pt = (val) => {
  if (val === null || val === undefined || val === '--') return '--';
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

const getLatest = (data) => {
  if (!data) return {};
  if (Array.isArray(data)) return data[data.length - 1] || {};
  return data;
};

const getComponentStatus = (readinessObj, keyword) => {
  if (!readinessObj) return '--';
  const comps = readinessObj.components || readinessObj.latestDailyReadinessDTO?.components || [];
  if (Array.isArray(comps)) {
    const comp = comps.find(c => c.componentType && c.componentType.toUpperCase().includes(keyword));
    return comp ? (comp.status || comp.statusText || '--') : '--';
  }
  return '--';
};

export default function ActivitiesPanel() {
  const [activities, setActivities] = useState([]);
  const [focusData, setFocusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState('distance'); 
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [hoverInfo, setHoverInfo] = useState(null);
  
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

  useEffect(() => {
    let shouldFetchActivities = true;
    const token = localStorage.getItem("garmin_token");
    
    // Controlo inteligente de Cache (1 Hora TTL)
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

        const resFocus = await fetch(`${BASE_URL}/training-focus`, { 
          headers: { "Authorization": `Bearer ${token}` } 
        });
        
        if (resFocus.status === 401) { 
          localStorage.removeItem("garmin_token"); window.location.reload(); return; 
        }
        
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
  }, []);

  const latestReadiness = getLatest(focusData?.readiness);
  const latestStatus = getLatest(focusData?.status);

  const rScoreRaw = latestReadiness.readinessValue ?? latestReadiness.readinessScore ?? latestReadiness.latestDailyReadinessDTO?.readinessValue;
  const rScore = rScoreRaw !== undefined ? rScoreRaw : '--';
  const rIndicatorRaw = latestReadiness.readinessIndicator ?? latestReadiness.statusText ?? latestReadiness.latestDailyReadinessDTO?.readinessIndicator;
  const rIndicator = rIndicatorRaw !== undefined ? rIndicatorRaw : 'A Sincronizar';
  
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

  const sleepStatus = getComponentStatus(latestReadiness, 'SLEEP');
  const recoveryStatus = getComponentStatus(latestReadiness, 'RECOVERY');
  const hrvStatusComp = getComponentStatus(latestReadiness, 'HRV');
  const acuteLoadStatus = getComponentStatus(latestReadiness, 'LOAD');

  const tStatusRaw = latestStatus.trainingStatus ?? latestStatus.latestTrainingStatusDTO?.trainingStatus;
  const tStatus = tStatusRaw !== undefined ? tStatusRaw : 'A Sincronizar';
  
  const tLoadFocusRaw = latestStatus.loadFocus ?? latestStatus.latestTrainingStatusDTO?.loadFocus;
  const tLoadFocus = tLoadFocusRaw !== undefined ? tLoadFocusRaw : '--';
  
  const tVo2Raw = latestStatus.mostRecentVO2Max?.vo2MaxValue ?? latestStatus.vo2MaxValue ?? latestStatus.latestTrainingStatusDTO?.vo2MaxStatus;
  const tVo2 = typeof tVo2Raw === 'number' ? tVo2Raw.toFixed(1) : (tVo2Raw ?? '--');
  
  const tLoadRaw = latestStatus.loadStatus ?? latestStatus.latestTrainingStatusDTO?.loadStatus;
  const tLoad = tLoadRaw !== undefined ? tLoadRaw : '--';
  
  const tHrvStatusRaw = latestStatus.hrvStatus ?? latestStatus.latestTrainingStatusDTO?.hrvStatus;
  const tHrvStatus = tHrvStatusRaw !== undefined ? tHrvStatusRaw : '--';

  const runs = activities.filter(a => a.activityType.includes('running'));
  const totalDistance = runs.reduce((acc, curr) => acc + (curr.distance || 0), 0).toFixed(1);
  const totalCalories = activities.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const totalDurationMins = activities.reduce((acc, curr) => acc + (curr.duration || 0), 0);
  const totalDurationHours = Math.floor(totalDurationMins / 60);

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
  const max7d = Math.max(...chart7d.map(d => d.val), 1) * 1.3; 

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

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const filteredActivities = activities.filter(act => {
    if (!act.startTimeLocal) return false;
    const actDate = new Date(act.startTimeLocal);
    if (showAllActivities) return true;
    return actDate.getMonth() === currentMonth && actDate.getFullYear() === currentYear;
  }).sort((a, b) => new Date(b.startTimeLocal) - new Date(a.startTimeLocal));

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
                const hPercentage = d.val > 0 ? Math.max((d.val / max7d) * 100, 5) : 0;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                    {d.val > 0 && (
                      <span style={{ fontSize: '11px', color: '#DDE6F5', fontWeight: 700, marginBottom: '6px' }}>
                        {d.val.toFixed(1)}
                      </span>
                    )}
                    <div style={{ width: '20px', height: `${hPercentage}%`, background: '#00BFFF', borderRadius: '4px 4px 0 0' }}></div>
                    <span style={{ fontSize: '10px', color: '#8b949e', marginTop: '8px' }}>{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', border: '1px solid #2C2C2E', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DDE6F5', fontSize: '13px', fontWeight: 600 }}>
                <BarChart2 size={16} color="#8B7FFF" /> Estado de Treino
              </div>
              <div onMouseEnter={() => setHoverInfo('status')} onMouseLeave={() => setHoverInfo(null)} style={{ cursor: 'help', position: 'relative' }}>
                <Info size={16} color="#5C738F" />
                <Tooltip visible={hoverInfo === 'status'} title="Estado de Treino" text="Muda com base na sua Carga Aguda, no seu VO2 Max e na Variabilidade da Frequência Cardíaca (VFC). Funciona como um excelente guia para manter o treino no caminho certo evitando sobrecargas." />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ width: '40px', height: '40px', borderRadius: '20px', background: '#00BFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Activity size={20} color="#0B1221" />
                </div>
                <div style={{ color: '#DDE6F5', fontSize: '22px', fontWeight: 700, textTransform: 'capitalize' }}>{pt(tStatus)}</div>
                <div style={{ color: '#DDE6F5', fontSize: '12px', marginTop: '2px', textTransform: 'capitalize' }}>Foco: {pt(tLoadFocus)}</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', position: 'relative' }}>
                <div onMouseEnter={() => setHoverInfo('vo2')} onMouseLeave={() => setHoverInfo(null)}>
                  <div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'}}>
                    {tVo2} <Info size={12} color="#5C738F" />
                  </div>
                  <div style={{color: '#8b949e', fontSize: '11px'}}>VO2 Max</div>
                  <Tooltip visible={hoverInfo === 'vo2'} title="VO2 Max Estimado" text="Indicador da aptidão cardiovascular. Volume máximo de oxigénio consumido no máximo da sua performance. Valores de corrida e ciclismo podem diferir pela ativação muscular." />
                </div>

                <div>
                  <div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize'}}>{pt(tLoad)}</div>
                  <div style={{color: '#8b949e', fontSize: '11px'}}>Carga</div>
                </div>

                <div onMouseEnter={() => setHoverInfo('hrv')} onMouseLeave={() => setHoverInfo(null)}>
                  <div style={{color: '#DDE6F5', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'}}>
                    {pt(tHrvStatus)} <Info size={12} color="#5C738F" />
                  </div>
                  <div style={{color: '#8b949e', fontSize: '11px'}}>Estado VFC</div>
                  <Tooltip visible={hoverInfo === 'hrv'} title="Estado da VFC (HRV Status)" text="Média de 7 dias durante o sono. Mede as alterações de tempo entre batimentos sucessivos e sinaliza a resiliência do seu sistema nervoso autónomo (equilíbrio esforço/recuperação)." />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
              <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ flex: 1, background: '#FF3A5C' }}></div>
                <div style={{ flex: 2, background: '#F59E0B', borderLeft: '2px solid #1c1c1e', borderRight: '2px solid #1c1c1e' }}></div>
                <div style={{ flex: 5, background: '#00D47E' }}></div>
                <div style={{ flex: 2, background: '#FF6230', borderLeft: '2px solid #1c1c1e', borderRight: '2px solid #1c1c1e' }}></div>
                <div style={{ flex: 1, background: '#FF3A5C' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', fontSize: '10px', marginTop: '6px' }}>
                <span>Últimas 4s</span>
                <span>Túnel Ideal</span>
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