import { useState, useEffect, useRef } from 'react';

export default function AICoach() {
  const [briefing, setBriefing] = useState("");
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  
  const [chatMessages, setChatMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const chatEndRef = useRef(null);

  const token = localStorage.getItem("garmin_token");
  const baseUrl = "https://garmin-lab.onrender.com"; // O teu backend

  useEffect(() => {
    const fetchBriefing = async () => {
      try {
        const response = await fetch(`${baseUrl}/briefing`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        setBriefing(data.briefing);
      } catch (error) {
        setBriefing("Falha na comunicação com o motor analítico.");
      } finally {
        setLoadingBriefing(false);
      }
    };
    fetchBriefing();
  }, []);

  // Auto-scroll do chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

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
      if (!response.ok) throw new Error("Erro no endpoint /chat");
      
      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'pt', text: data.reply }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'pt', text: "Erro de ligação ao servidor. Verifica o deploy no Render." }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Ícones limpos em SVG (Estética Garmin)
  const IconBriefing = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  );

  const IconBrain = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path>
    </svg>
  );

  return (
    <div style={{ display: 'flex', gap: '24px', color: '#c9d1d9', marginTop: '10px', height: '70vh' }}>
      
      {/* Coluna da Esquerda: Análise Diária */}
      <div style={{ flex: '1', background: '#0d1117', padding: '24px', borderRadius: '12px', border: '1px solid #30363d', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '16px', marginBottom: '20px' }}>
          <IconBriefing />
          <h2 style={{ color: '#fff', fontSize: '18px', margin: 0, fontWeight: '500' }}>Análise Fisiológica</h2>
        </div>
        
        {loadingBriefing ? (
          <p style={{ color: '#8b949e', fontSize: '14px' }}>A extrair e processar biometria...</p>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '14px', color: '#c9d1d9' }}>
            {briefing}
          </div>
        )}
      </div>

      {/* Coluna da Direita: Chat PT Interativo */}
      <div style={{ flex: '1.2', display: 'flex', flexDirection: 'column', background: '#0d1117', padding: '24px', borderRadius: '12px', border: '1px solid #30363d' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '16px', marginBottom: '20px' }}>
          <IconBrain />
          <h2 style={{ color: '#fff', fontSize: '18px', margin: 0, fontWeight: '500' }}>Laboratório de Treino</h2>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', paddingRight: '10px', display: 'flex', flexDirection: 'column' }}>
          {chatMessages.length === 0 && (
            <p style={{ color: '#8b949e', fontSize: '14px', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
              Inicia uma sessão para debateres métricas ou ajustes de carga.
            </p>
          )}
          
          {chatMessages.map((msg, idx) => (
            <div key={idx} style={{ 
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? '#1f6feb' : '#21262d',
              color: '#fff',
              padding: '12px 16px', 
              borderRadius: '8px', 
              marginBottom: '12px',
              maxWidth: '80%',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              {msg.text}
            </div>
          ))}
          
          {isTyping && (
            <div style={{ alignSelf: 'flex-start', background: '#21262d', color: '#8b949e', padding: '12px 16px', borderRadius: '8px', fontSize: '13px' }}>
              A processar biometria...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ex: Considerando o stress de hoje, devo manter as séries?"
            style={{ 
              flex: 1, padding: '14px', borderRadius: '6px', border: '1px solid #30363d', 
              background: '#161b22', color: '#fff', outline: 'none', fontSize: '14px' 
            }}
          />
          <button 
            onClick={handleSendMessage} 
            disabled={isTyping}
            style={{ 
              padding: '0 24px', background: isTyping ? '#30363d' : '#1f6feb', color: '#fff', 
              border: 'none', borderRadius: '6px', cursor: isTyping ? 'not-allowed' : 'pointer', fontWeight: '500' 
            }}>
            Enviar
          </button>
        </div>
      </div>

    </div>
  );
}