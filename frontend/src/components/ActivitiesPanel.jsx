import { useState, useEffect } from 'react';
import { Activity, Flame, Clock } from 'lucide-react';

export default function ActivitiesPanel() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState('distance'); // 'distance', 'calories', 'duration'

  const token = localStorage.getItem("garmin_token");
  const baseUrl = "https://garmin-lab.onrender.com";

  useEffect(() => {
    const fetchYTD = async () => {
      try {
        const res = await fetch(`${baseUrl}/activities/ytd`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        // Proteção 1: Força o erro se o servidor falhar (ex: 404 ou 500)
        if (!res.ok) throw new Error("Erro na resposta do servidor");
        
        const data = await res.json();
        
        // Proteção 2: Garante que os dados são uma lista (array) antes de guardar no estado
        setActivities(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro a carregar YTD:", error);
        // Em caso de falha grave de rede, define um array vazio para não quebrar o React
        setActivities([]); 
      } finally {
        setLoading(false);
      }
    };
    fetchYTD();
  }, [baseUrl, token]);

  // Cálculos do Ano (YTD)
  const runs = activities.filter(a => a.activityType.includes('running'));
  const totalDistance = runs.reduce((acc, curr) => acc + (curr.distance || 0), 0).toFixed(1);
  const totalCalories = activities.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const totalActivities = activities.length;

  // Lógica para a Semana Atual (Segunda a Domingo)
  const getWeeklyData = () => {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // Ajusta para que Domingo seja 7 em vez de 0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);

    const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    let chartData = weekDays.map(day => ({ day, distance: 0, calories: 0, duration: 0 }));

    activities.forEach(act => {
      if (!act.startTimeLocal) return;
      const actDate = new Date(act.startTimeLocal);
      
      // Se a atividade aconteceu a partir de segunda-feira desta semana
      if (actDate >= monday) {
        const actDayIndex = (actDate.getDay() || 7) - 1; // 0 = Segunda, 6 = Domingo
        if (actDayIndex >= 0 && actDayIndex < 7) {
          chartData[actDayIndex].distance += act.distance || 0;
          chartData[actDayIndex].calories += act.calories || 0;
          chartData[actDayIndex].duration += act.duration || 0;
        }
      }
    });
    return chartData;
  };

  const weeklyData = getWeeklyData();
  const maxMetricValue = Math.max(...weeklyData.map(d => d[activeMetric])) || 1; // Evita divisão por zero

  if (loading) return <div style={{ color: '#5C738F' }}>A sincronizar histórico anual e a desenhar gráficos...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Cards (YTD) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div style={{ background: '#0B1221', padding: '24px', borderRadius: '12px', border: '1px solid #1C2D47' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5C738F', marginBottom: '12px' }}>
            <Activity size={18} color="#FF6230" />
            <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}>DISTÂNCIA (CORRIDAS YTD)</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#FF6230' }}>
            {totalDistance} <span style={{ fontSize: '16px', color: '#5C738F', fontWeight: 500 }}>km</span>
          </div>
          <div style={{ color: '#5C738F', fontSize: '13px', marginTop: '8px' }}>{runs.length} corridas este ano</div>
        </div>

        <div style={{ background: '#0B1221', padding: '24px', borderRadius: '12px', border: '1px solid #1C2D47' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5C738F', marginBottom: '12px' }}>
            <Flame size={18} color="#FBBF24" />
            <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}>CALORIAS TOTAIS (YTD)</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#FBBF24' }}>
            {totalCalories.toLocaleString()} <span style={{ fontSize: '16px', color: '#5C738F', fontWeight: 500 }}>kcal</span>
          </div>
          <div style={{ color: '#5C738F', fontSize: '13px', marginTop: '8px' }}>{totalActivities} atividades registadas</div>
        </div>
      </div>

      {/* Gráfico Interativo da Semana */}
      <div style={{ background: '#0B1221', padding: '24px', borderRadius: '12px', border: '1px solid #1C2D47' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '1px', color: '#5C738F' }}>
            RESUMO DA SEMANA ATUAL
          </span>
          
          {/* Botões de Seleção de Métrica */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setActiveMetric('distance')}
              style={{ 
                background: activeMetric === 'distance' ? '#FF6230' : 'transparent', 
                color: activeMetric === 'distance' ? '#000' : '#5C738F', 
                border: `1px solid ${activeMetric === 'distance' ? '#FF6230' : '#1C2D47'}`, 
                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              Distância
            </button>
            <button 
              onClick={() => setActiveMetric('calories')}
              style={{ 
                background: activeMetric === 'calories' ? '#FBBF24' : 'transparent', 
                color: activeMetric === 'calories' ? '#000' : '#5C738F', 
                border: `1px solid ${activeMetric === 'calories' ? '#FBBF24' : '#1C2D47'}`, 
                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              Calorias
            </button>
            <button 
              onClick={() => setActiveMetric('duration')}
              style={{ 
                background: activeMetric === 'duration' ? '#00BFFF' : 'transparent', 
                color: activeMetric === 'duration' ? '#000' : '#5C738F', 
                border: `1px solid ${activeMetric === 'duration' ? '#00BFFF' : '#1C2D47'}`, 
                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              Tempo
            </button>
          </div>
        </div>

        {/* Desenho do Gráfico */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '200px', borderBottom: '1px solid #1C2D47', paddingBottom: '10px' }}>
          {weeklyData.map((data, idx) => {
            const heightPercentage = (data[activeMetric] / maxMetricValue) * 100;
            const barColor = activeMetric === 'distance' ? '#FF6230' : activeMetric === 'calories' ? '#FBBF24' : '#00BFFF';
            
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#DDE6F5', fontWeight: 500 }}>
                  {data[activeMetric] > 0 ? (activeMetric === 'distance' ? `${data[activeMetric].toFixed(1)}` : Math.round(data[activeMetric])) : ''}
                </span>
                <div style={{ 
                  width: '32px', 
                  height: `${heightPercentage}%`, 
                  background: barColor, 
                  borderRadius: '4px 4px 0 0',
                  minHeight: data[activeMetric] > 0 ? '4px' : '0',
                  transition: 'height 0.4s ease-out, background 0.2s'
                }}></div>
                <span style={{ fontSize: '11px', color: '#5C738F', marginTop: '4px' }}>{data.day.substring(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}