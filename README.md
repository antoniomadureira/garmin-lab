# Garmin Dashboard

Dashboard pessoal para visualizar os dados da conta Garmin Connect.
Construído com FastAPI (backend) + React + Recharts (frontend).

## Funcionalidades

- **Atividades** — lista de corridas, ciclismo, caminhadas com métricas detalhadas
- **Frequência Cardíaca** — gráfico diário + tendência semanal de FC repouso vs. máxima
- **Sono** — fases (profundo/REM/leve/acordado), score e tendência semanal
- **Passos & Calorias** — progresso diário, gráfico semanal, Body Battery

---

## Pré-requisitos

- Python 3.10+
- Node.js 18+
- Conta Garmin Connect

---

## Instalação

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

O backend fica em: http://localhost:8000
Documentação da API: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend fica em: http://localhost:5173

---

## Utilização

1. Abre http://localhost:5173
2. Introduz o teu email e password do **Garmin Connect**
3. As credenciais são enviadas apenas para o backend local (localhost:8000)
4. Navega pelos painéis: Atividades, FC, Sono, Passos

---

## Notas de Segurança

- As credenciais **nunca** saem do teu computador — o backend é local.
- O token de sessão é guardado no `localStorage` do browser.
- Para sair, clica no ícone de logout no topo da dashboard.

---

## Tecnologias

| Camada   | Stack                                          |
|----------|------------------------------------------------|
| Backend  | Python · FastAPI · garminconnect · uvicorn     |
| Frontend | React 18 · Vite · Recharts · Lucide · date-fns |

---

## Estrutura do Projeto

```
garmin-dashboard/
├── backend/
│   ├── main.py              # API FastAPI com todos os endpoints
│   └── requirements.txt
└── frontend/
    ├── vite.config.js       # Proxy /api → localhost:8000
    ├── index.html
    └── src/
        ├── App.jsx
        ├── api.js           # Cliente HTTP para o backend
        └── components/
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── ActivitiesPanel.jsx
            ├── HeartRatePanel.jsx
            ├── SleepPanel.jsx
            ├── StepsPanel.jsx
            └── ui.jsx       # Componentes partilhados
```

---

## Resolução de Problemas

**Erro de autenticação Garmin**
> A Garmin pode pedir verificação por email na primeira ligação de um novo dispositivo/IP. Verifica a caixa de entrada e tenta de novo.

**CORS error no browser**
> Certifica-te que o backend está em execução em `localhost:8000` antes de abrir o frontend.

**Rate limiting (429)**
> A Garmin tem limites de pedidos. Aguarda alguns minutos entre tentativas.
