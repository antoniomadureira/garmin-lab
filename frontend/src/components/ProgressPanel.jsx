import { useState, useEffect } from 'react';
import { Activity, Clock, Flame } from 'lucide-react';
import { BASE_URL } from '../config.js';

export default function ProgressPanel() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState('distance'); 
  const [period, setPeriod] = useState('YTD'); 
  const [hoveredPoint, setHoveredPoint] = useState(null); 

  useEffect(() => {
    let shouldFetchActivities = true;
    const token = localStorage.getItem("garmin_token");
    
    // Controlo de Cache
    const cachedData = localStorage.getItem("garmin_activities_ytd");
    const cachedTs = localStorage.getItem("garmin_activities_ytd_ts");
    
    if (cachedData && cachedTs && (Date.now() - parseInt(cachedTs) < 3600000)) {
      setActivities(JSON.parse(cachedData));
      setLoading(false);
      shouldFetchActivities = false;
    }

    const fetchYTD = async () => {
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
      } catch (error) {
        if (!activities.length) setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    fetchYTD();
  }, []);

  const getChartData = () => {
    if (activities.length === 0) return [];
    
    const runs = activities.filter(a => a.activityType.includes('running') && a.startTimeLocal);
    const now = new Date();
    now.setHours(23,59,59,999);
    
    let points = [];

    if (period === '7D') {
      for (let i = 6; i >= 0; i--) {
        let d = new Date(now);
        d.setDate(now.getDate() - i);
        points.push({
          key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
          label: d.toLocaleDateString('pt-PT', { weekday: 'short' }).toUpperCase(),
          distance: 0, duration: 0, calories: 0
        });
      }
    } else if (period === '1M') {
      for (let i = 4; i >= 0; i--) {
         let start = new Date(now);
         start.setDate(now.getDate() - (i * 6 + 5));
         start.setHours(0,0,0,0);
         let end = new Date(now);
         end.setDate(now.getDate() - (i * 6));
         end.setHours(23,59,59,999);
         points.push({
           start: start.getTime(),
           end: end.getTime(),
           label: `${end.getDate()} ${end.toLocaleString('pt-PT', { month: 'short' }).toUpperCase()}`,
           distance: 0, duration: 0, calories: 0
         });
      }
    } else {
      let numMonths = 3;
      if (period === '6M') numMonths = 6;
      if (period === 'YTD') numMonths = now.getMonth() + 1;
      if (period === '1Y') numMonths = 12;

      for (let i = numMonths - 1; i >= 0; i--) {
        let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        points.push({
          key: `${d.getFullYear()}-${d.getMonth()}`,
          label: d.toLocaleString('pt-PT', { month: 'short' }).toUpperCase(),
          distance: 0, duration: 0, calories: 0
        });
      }
    }

    runs.forEach(run => {
      if (!run.startTimeLocal) return;
      const runDate = new Date(run.startTimeLocal);

      if (period === '7D') {
        const key = `${runDate.getFullYear()}-${runDate.getMonth()}-${runDate.getDate()}`;
        const p = points.find(p => p.key === key);
        if (p) { p.distance += run.distance || 0; p.duration += run.duration || 0; p.calories += run.calories || 0; }
      } else if (period === '1M') {
        const t = runDate.getTime();
        const p = points.find(p => t >= p.start && t <= p.end);
        if (p) { p.distance += run.distance || 0; p.duration += run.duration || 0; p.calories += run.calories || 0; }
      } else {
        const key = `${runDate.getFullYear()}-${runDate.getMonth()}`;
        const p = points.find(p => p.key === key);
        if (p) { p.distance += run.distance || 0; p.duration += run.duration || 0; p.calories += run.calories || 0; }
      }
    });

    return points;
  };

  const chartData = getChartData();
  const maxVal = Math.max(...chartData.map(d => d[activeMetric]), 1) * 1.1; 
  const totalVal = chartData.reduce((acc, curr) => acc + curr[activeMetric], 0);

  if (loading && activities.length === 0) return <div style={{ color: '#5C738F' }}>A processar a tua curva de evolução...</div>;

  const width = 800;
  const height = 300;
  const paddingX = 40;
  const paddingY = 40;
  
  const pointsString = chartData.map((d, i) => {
    const x = paddingX + (i * ((width - paddingX * 2) / Math.max(chartData.length - 1, 1)));
    const y = height - paddingY - ((d[activeMetric] / maxVal) * (height - paddingY * 2));
    return `${x},${y}`;
  }).join(' ');

  const polygonPoints = `${paddingX},${height - paddingY} ${pointsString} ${width - paddingX},${height - paddingY}`;

  const renderTitle = () => {
    if (activeMetric === 'distance') return { title: 'Distância Total', val: totalVal.toFixed(1), unit: 'km', color: '#FF6230' };
    if (activeMetric === 'duration') return { title: 'Tempo Total', val: Math.round(totalVal), unit: 'min', color: '#00BFFF' };
    return { title: 'Calorias Totais', val: Math.round(totalVal).toLocaleString(), unit: 'kcal', color: '#FBBF24' };
  };

  const { title, val, unit, color } = renderTitle();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '100%', margin: '0 auto' }}>
      
      <div style={{ background: '#0B1221', padding: '32px', borderRadius: '16px', border: '1px solid #1C2D47' }}>
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveMetric('distance')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', color: activeMetric === 'distance' ? '#FF6230' : '#DDE6F5', border: `1px solid ${activeMetric === 'distance' ? '#FF6230' : '#1C2D47'}`, padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: '0.2s' }}>
            <Activity size={16} /> Distância
          </button>
          <button onClick={() => setActiveMetric('duration')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', color: activeMetric === 'duration' ? '#00BFFF' : '#DDE6F5', border: `1px solid ${activeMetric === 'duration' ? '#00BFFF' : '#1C2D47'}`, padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: '0.2s' }}>
            <Clock size={16} /> Tempo
          </button>
          <button onClick={() => setActiveMetric('calories')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', color: activeMetric === 'calories' ? '#FBBF24' : '#DDE6F5', border: `1px solid ${activeMetric === 'calories' ? '#FBBF24' : '#1C2D47'}`, padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: '0.2s' }}>
            <Flame size={16} /> Calorias
          </button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ color: '#DDE6F5', fontSize: '16px', margin: '0 0 4px 0', fontWeight: 600 }}>{title}</h2>
          <div style={{ fontSize: '48px', fontWeight: 800, color: '#DDE6F5', letterSpacing: '-1px' }}>
            {val} <span style={{ fontSize: '18px', color: '#5C738F', fontWeight: 600 }}>{unit}</span>
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', marginTop: '40px' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '600px', display: 'block', overflow: 'visible' }}>
            
            <line x1={0} y1={paddingY} x2={width} y2={paddingY} stroke="#1C2D47" strokeWidth="1" />
            <text x={width - 40} y={paddingY - 8} fill="#5C738F" fontSize="12">{Math.round(maxVal)} {unit}</text>
            
            <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#1C2D47" strokeWidth="1" />
            <text x={width - 40} y={(height / 2) - 8} fill="#5C738F" fontSize="12">{Math.round(maxVal / 2)} {unit}</text>

            <line x1={0} y1={height - paddingY} x2={width} y2={height - paddingY} stroke="#1C2D47" strokeWidth="1" />
            <text x={width - 40} y={height - paddingY - 8} fill="#5C738F" fontSize="12">0 {unit}</text>
            
            <polygon points={polygonPoints} fill="url(#grad)" opacity="0.3" />
            <defs>
              <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} />
                <stop offset="100%" stopColor="#0B1221" stopOpacity="0" />
              </linearGradient>
            </defs>

            {hoveredPoint && (
              <line 
                x1={hoveredPoint.x} y1={paddingY} 
                x2={hoveredPoint.x} y2={height - paddingY} 
                stroke="#DDE6F5" strokeWidth="1" strokeDasharray="4" opacity="0.6" 
              />
            )}

            <polyline points={pointsString} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            
            {chartData.map((d, i) => {
              const x = paddingX + (i * ((width - paddingX * 2) / Math.max(chartData.length - 1, 1)));
              const y = height - paddingY - ((d[activeMetric] / maxVal) * (height - paddingY * 2));
              const stepX = (width - paddingX * 2) / Math.max(chartData.length - 1, 1);

              return (
                <g key={`point-${i}`}>
                  <circle cx={x} cy={y} r={hoveredPoint && hoveredPoint.index === i ? "6" : "4"} fill="#0B1221" stroke={color} strokeWidth={hoveredPoint && hoveredPoint.index === i ? "3" : "2"} style={{ transition: 'r 0.2s' }} />
                  <text x={x} y={height - 10} fill={hoveredPoint && hoveredPoint.index === i ? "#DDE6F5" : "#5C738F"} fontSize="11" textAnchor="middle" style={{ transition: 'fill 0.2s' }}>{d.label}</text>
                  
                  <rect 
                    x={x - (stepX / 2)} y={paddingY} width={stepX} height={height - paddingY * 2} 
                    fill="transparent" style={{ cursor: 'crosshair' }}
                    onMouseEnter={() => setHoveredPoint({ x, y, data: d, index: i })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              );
            })}
          </svg>

          {hoveredPoint && (
            <div style={{
              position: 'absolute',
              left: hoveredPoint.x > width * 0.7 ? `calc(${(hoveredPoint.x / width) * 100}% - 140px)` : `calc(${(hoveredPoint.x / width) * 100}% + 15px)`,
              top: `calc(${(hoveredPoint.y / height) * 100}% - 20px)`,
              background: '#162233',
              border: '1px solid #1C2D47',
              padding: '12px 16px',
              borderRadius: '8px',
              pointerEvents: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              zIndex: 10,
              minWidth: '110px'
            }}>
              <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {hoveredPoint.data.label}
              </div>
              <div style={{ color: color, fontSize: '18px', fontWeight: 800 }}>
                {activeMetric === 'distance' ? hoveredPoint.data[activeMetric].toFixed(1) : Math.round(hoveredPoint.data[activeMetric])}
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#5C738F', marginLeft: '4px' }}>{unit}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '32px', borderTop: '1px solid #1C2D47', paddingTop: '24px', flexWrap: 'wrap' }}>
          {['7D', '1M', '3M', '6M', 'YTD', '1Y'].map(p => (
            <button 
              key={p} 
              onClick={() => setPeriod(p)}
              style={{ 
                background: period === p ? color : 'transparent', 
                color: period === p ? '#000' : color, 
                border: 'none', borderRadius: '20px', padding: '8px 16px', 
                cursor: 'pointer', fontSize: '13px', fontWeight: 700, transition: '0.2s'
              }}
            >
              {p}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}