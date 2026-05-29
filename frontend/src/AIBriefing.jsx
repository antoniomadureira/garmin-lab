import { useState, useEffect } from 'react';

export default function AIBriefing() {
  const [briefing, setBriefing] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBriefing = async () => {
      // Vai buscar o token que o teu login guardou
      const token = localStorage.getItem("garmin_token"); 
      // Substitui pelo teu localhost durante os testes, se necessário
      const baseUrl = "https://garmin-lab.onrender.com"; 

      try {
        const response = await fetch(`${baseUrl}/briefing`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error("Falha na autenticação da IA");
        
        const data = await response.json();
        setBriefing(data.briefing);
      } catch (error) {
        console.error(error);
        setBriefing("🔴 Não foi possível gerar o briefing de hoje. Verifica a ligação.");
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();
  }, []);

  return (
    <div style={{
      background: 'linear-gradient(145deg, #161b22, #0d1117)',
      border: '1px solid #00c3ff',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '32px',
      color: '#c9d1d9',
      boxShadow: '0 4px 20px rgba(0, 195, 255, 0.15)',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '24px', marginRight: '12px' }}>🧠</span>
        <h2 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: '600' }}>
          Briefing de Alta Performance
        </h2>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#00c3ff' }}>
          <div className="spinner" style={{
             width: '20px', height: '20px', border: '3px solid', 
             borderColor: '#00c3ff transparent transparent transparent', 
             borderRadius: '50%', animation: 'spin 1s linear infinite'
          }}></div>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          <span>A analisar dados de recuperação e carga do microciclo...</span>
        </div>
      ) : (
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '15px' }}>
          {briefing}
        </div>
      )}
    </div>
  );
}