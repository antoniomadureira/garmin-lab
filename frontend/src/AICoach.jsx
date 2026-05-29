import { useState, useEffect } from 'react';
import { Brain, Send, Loader2 } from 'lucide-react';
import { BASE_URL } from './config.js'; 

export default function AICoach({ briefing, setBriefing }) {
  const [loadingBriefing, setLoadingBriefing] = useState(!briefing);
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => {
    if (briefing) return; 

    const fetchBriefing = async () => {
      try {
        const token = localStorage.getItem("garmin_token");
        const res = await fetch(`${BASE_URL}/briefing`, { 
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.status === 401) {
          localStorage.removeItem("garmin_token");
          window.location.reload();
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setBriefing(data.briefing); 
        } else {
          setBriefing("Erro ao contactar a IA.");
        }
      } catch (err) {
        console.error(err);
        setBriefing("Falha de rede ao contactar a IA.");
      } finally {
        setLoadingBriefing(false);
      }
    };

    fetchBriefing();
  }, [briefing, setBriefing]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMsg = message;
    setMessage("");
    setChatLog(prev => [...prev, { role: "user", text: userMsg }]);
    setLoadingChat(true);

    try {
      const token = localStorage.getItem("garmin_token");
      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: userMsg })
      });

      if (res.status === 401) {
        localStorage.removeItem("garmin_token");
        window.location.reload();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setChatLog(prev => [...prev, { role: "ai", text: data.reply }]);
      } else {
        setChatLog(prev => [...prev, { role: "ai", text: "Erro na resposta do servidor." }]);
      }
    } catch (error) {
      setChatLog(prev => [...prev, { role: "ai", text: "Erro de ligação à API." }]);
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ background: '#0B1221', padding: '24px', borderRadius: '12px', border: '1px solid #1C2D47' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Brain size={24} color="#1f6feb" />
          <h2 style={{ color: '#DDE6F5', fontSize: '18px', margin: 0 }}>Briefing Diário</h2>
        </div>
        
        {loadingBriefing ? (
          <div style={{ color: '#5C738F', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={16} className="animate-spin" /> A analisar a tua biometria de hoje...
          </div>
        ) : (
          <div style={{ color: '#DDE6F5', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {briefing}
          </div>
        )}
      </div>

      <div style={{ background: '#0B1221', padding: '24px', borderRadius: '12px', border: '1px solid #1C2D47', display: 'flex', flexDirection: 'column', height: '400px' }}>
        <h3 style={{ color: '#DDE6F5', fontSize: '16px', margin: '0 0 16px 0' }}>Chat de Performance</h3>
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
          {chatLog.length === 0 && (
            <div style={{ color: '#5C738F', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
              Faz uma pergunta sobre o teu treino, recuperação ou planeamento.
            </div>
          )}
          {chatLog.map((msg, i) => (
            <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? '#1f6feb' : '#1C2D47', color: '#DDE6F5', padding: '12px 16px', borderRadius: '12px', maxWidth: '80%', fontSize: '14px', lineHeight: '1.4' }}>
              {msg.text}
            </div>
          ))}
          {loadingChat && (
            <div style={{ alignSelf: 'flex-start', background: '#1C2D47', color: '#5C738F', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={14} className="animate-spin" /> A escrever...
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            value={message} 
            onChange={e => setMessage(e.target.value)} 
            placeholder="Ex: Devo fazer treino de séries hoje?"
            style={{ flex: 1, background: '#05090F', border: '1px solid #1C2D47', color: '#DDE6F5', padding: '12px 16px', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
          />
          <button type="submit" disabled={loadingChat || !message.trim()} style={{ background: '#1f6feb', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', cursor: (loadingChat || !message.trim()) ? 'not-allowed' : 'pointer', opacity: (loadingChat || !message.trim()) ? 0.7 : 1 }}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}