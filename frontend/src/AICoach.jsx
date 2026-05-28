import { useState, useEffect } from 'react';

export default function AICoach() {
  const [briefing, setBriefing] = useState("");
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  
  const [chatMessages, setChatMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const token = localStorage.getItem("garmin_token");
  const baseUrl = "https://garmin-lab.onrender.com"; // Volta a colocar localhost:8000 se testares localmente

  useEffect(() => {
    const fetchBriefing = async () => {
      try {
        const response = await fetch(`${baseUrl}/briefing`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        setBriefing(data.briefing);
      } catch (error) {
        setBriefing("🔴 Erro ao comunicar com o modelo analítico.");
      } finally {
        setLoadingBriefing(false);
      }
    };
    fetchBriefing();
  }, []);

  const handleSendMessage = async () => {
    if (!currentInput.trim()) return;
    
    const userMsg = currentInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setCurrentInput("");
    setIsTyping(true);

    try {
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'pt', text: data.reply }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'pt', text: "Erro de ligação. Tenta novamente." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px', color: '#c9d1d9', marginTop: '20px' }}>
      
      {/* Coluna da Esquerda: Análise Diária */}
      <div style={{ flex: 1, background: '#161b22', padding: '24px', borderRadius: '12px', border: '1px solid #30363d' }}>
        <h2 style={{ color: '#fff', borderBottom: '1px solid #30363d', paddingBottom: '12px' }}>📊 Análise Fisiológica</h2>
        {loadingBriefing ? (
          <p style={{ color: '#00c3ff' }}>A processar volumetria de dados...</p>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '15px' }}>{briefing}</div>
        )}
      </div>

      {/* Coluna da Direita: Chat PT Interativo */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#161b22', padding: '24px', borderRadius: '12px', border: '1px solid #00c3ff' }}>
        <h2 style={{ color: '#fff', borderBottom: '1px solid #30363d', paddingBottom: '12px' }}>🧠 Pergunta ao Treinador</h2>
        
        <div style={{ flex: 1, minHeight: '300px', maxHeight: '400px', overflowY: 'auto', marginBottom: '16px', paddingRight: '10px' }}>
          {chatMessages.length === 0 && <p style={{ color: '#8b949e', fontStyle: 'italic' }}>Pergunta sobre o teu descanso, HRV ou plano de corrida...</p>}
          
          {chatMessages.map((msg, idx) => (
            <div key={idx} style={{ 
              margin: '12px 0', textAlign: msg.role === 'user' ? 'right' : 'left',
              background: msg.role === 'user' ? '#003d5b' : '#21262d',
              padding: '12px', borderRadius: '8px', display: 'inline-block', maxWidth: '85%'
            }}>
              <strong style={{ color: msg.role === 'user' ? '#00c3ff' : '#58a6ff' }}>{msg.role === 'user' ? 'Tu: ' : 'Treinador: '}</strong>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: '4px' }}>{msg.text}</div>
            </div>
          ))}
          {isTyping && <div style={{ color: '#00c3ff', fontSize: '12px' }}>O treinador está a escrever...</div>}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ex: Como está a minha carga comparada com ontem?"
            style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: '#fff' }}
          />
          <button onClick={handleSendMessage} style={{ padding: '0 24px', background: '#00c3ff', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Enviar
          </button>
        </div>
      </div>

    </div>
  );
}