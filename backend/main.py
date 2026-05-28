"""
Garmin Dashboard – Backend API
Usa: garminconnect + FastAPI + Gemini AI
"""
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date, timedelta
import secrets
import time
import os
import json
import base64
import re

import garminconnect
from google import genai

app = FastAPI(title="Garmin Dashboard API", version="1.0.3")

# ── Configuração de CORS para permitir a ligação do Vercel ────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://garmin-lab.vercel.app",  # Permite pedidos da versão online!
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Sessões e Cache em memória ────────────────────────────────────
sessions: dict[str, garminconnect.Garmin] = {}
api_cache: dict[str, dict] = {}
CACHE_TTL = 3600  # Tempo de vida da cache em segundos (1 hora)


def fetch_with_cache(cache_key: str, fetch_func):
    """Devolve dados em cache se existirem e forem válidos, senão executa a função."""
    now = time.time()
    if cache_key in api_cache and api_cache[cache_key]["expires"] > now:
        return api_cache[cache_key]["data"]
    
    data = fetch_func()
    api_cache[cache_key] = {"data": data, "expires": now + CACHE_TTL}
    return data


# ── Modelos ───────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str


# ── Auth helpers ──────────────────────────────────────────────────
def get_api(request: Request) -> garminconnect.Garmin:
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    if not token or token not in sessions:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    return sessions[token]


# ── Auth endpoints ────────────────────────────────────────────────
@app.post("/login")
def login(req: LoginRequest):
    """Autentica usando os Tokens de Sessão do Render para evitar bloqueios."""
    try:
        # 1. Preparar a pasta temporária para os tokens
        token_store = "/tmp/garmin_tokens"
        env_token = os.getenv("GARMIN_SESSION_TOKEN")
        
        # Se existir a variável de ambiente, recria a pasta de sessão para o Garth ler
        if env_token:
            # 1. A Bomba Nuclear: Remove absolutamente TUDO o que não seja texto Base64 puro
            env_token = re.sub(r'[^a-zA-Z0-9+/=]', '', env_token)
            
            # 2. Garantir que o tamanho é múltiplo de 4 (adiciona o símbolo '=' se faltar)
            padding = len(env_token) % 4
            if padding > 0:
                env_token += "=" * (4 - padding)

            os.makedirs(token_store, exist_ok=True)
            tokens_data = json.loads(base64.b64decode(env_token).decode('utf-8'))
            for filename, content in tokens_data.items():
                with open(os.path.join(token_store, filename), "w") as f:
                    f.write(content)
                    
        # 2. Inicializar a API
        api = garminconnect.Garmin(req.email, req.password)
        
        # 3. Tentar o login com a sessão guardada (Isto salta a porta bloqueada!)
        if env_token and os.path.exists(token_store):
            api.login(token_store)
        else:
            api.login() # Fallback caso estejas a correr no teu computador local sem a variável de ambiente
            
        token = secrets.token_urlsafe(32)
        sessions[token] = api

        full_name = ""
        try:
            profile = api.get_full_name()
            full_name = profile or ""
        except Exception:
            pass

        return {"token": token, "displayName": full_name}

    except garminconnect.GarminConnectAuthenticationError:
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    sessions.pop(token, None)
    return {"ok": True}


# ── IA Briefing ───────────────────────────────────────────────────
@app.get("/briefing")
def get_ai_briefing(api: garminconnect.Garmin = Depends(get_api)):
    """Gera um resumo inteligente do dia usando IA baseada em dados reais."""
    try:
        today = date.today().strftime("%Y-%m-%d")
        
        # 1. Camada Determinística (Os números reais)
        sleep_data = api.get_sleep_data(today)
        stats = api.get_stats(today)
        body_battery = api.get_body_battery(today, today)
        
        # Extração segura dos valores
        sleep_score = sleep_data.get("dailySleepDTO", {}).get("sleepScores", {}).get("overall", {}).get("value", "Desconhecido") if sleep_data else "Desconhecido"
        stress = stats.get("averageStressLevel", "Desconhecido") if stats else "Desconhecido"
        
        bb_highest = "Desconhecido"
        if body_battery and len(body_battery) > 0:
            bb_highest = body_battery[0].get("bodyBatteryHighestValue", "Desconhecido")

        # 2. Construção do Contexto para a IA
        contexto_dados = f"""
        Métricas de Hoje ({today}):
        - Sleep Score: {sleep_score}/100
        - Nível de Stress Médio: {stress}/100
        - Body Battery Máximo ao acordar: {bb_highest}/100
        """

        prompt = f"""
        Atua como um treinador de alto rendimento para um maratonista que corre cerca de 60km por semana.
        Com base exclusivamente nos dados determinísticos abaixo, gera um briefing diário curto.
        
        {contexto_dados}
        
        O teu briefing tem de seguir exatamente esta estrutura:
        1. Usa semáforos (🟢🟡🔴) para avaliar a Recuperação, a Carga recomendada e a Performance esperada.
        2. Termina com uma 'Ação do Dia' (ex: fazer treino de séries, corrida de recuperação, ou descanso absoluto).
        3. Dirige-te a mim como Tomás. Sê direto, sem rodeios e não inventes métricas.
        """

        # 3. Camada de Interpretação (Chamada à IA)
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return {"briefing": "Aviso: A chave GEMINI_API_KEY não está configurada no Render."}
            
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        return {"briefing": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Atividades ────────────────────────────────────────────────────
@app.get("/activities")
def get_activities(limit: int = 20, api: garminconnect.Garmin = Depends(get_api)):
    """Últimas N atividades (corridas, ciclismo, caminhadas, etc.)."""
    try:
        cache_key = f"activities_{id(api)}_{limit}"
        data = fetch_with_cache(cache_key, lambda: api.get_activities(0, limit))
        
        result = []
        for a in data:
            result.append({
                "activityId": a.get("activityId"),
                "activityName": a.get("activityName", ""),
                "activityType": a.get("activityType", {}).get("typeKey", "unknown"),
                "startTimeLocal": a.get("startTimeLocal", ""),
                "distance": round((a.get("distance") or 0) / 1000, 2),       # m → km
                "duration": round((a.get("duration") or 0) / 60, 1),           # s → min
                "elapsedDuration": a.get("elapsedDuration", 0),
                "averageHR": a.get("averageHR"),
                "maxHR": a.get("maxHR"),
                "calories": a.get("calories"),
                "averageSpeed": a.get("averageSpeed"),
                "maxSpeed": a.get("maxSpeed"),
                "elevationGain": a.get("elevationGain"),
                "averagePower": a.get("averagePower"),
                "vo2MaxValue": a.get("vO2MaxValue"),
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Frequência Cardíaca ───────────────────────────────────────────
@app.get("/heartrate")
def get_heartrate(
    date_str: str = None,
    api: garminconnect.Garmin = Depends(get_api)
):
    d = date_str or date.today().strftime("%Y-%m-%d")
    cache_key = f"hr_{id(api)}_{d}"
    try:
        return fetch_with_cache(cache_key, lambda: api.get_heart_rates(d))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/heartrate/weekly")
def get_heartrate_weekly(
    days: int = 7,
    api: garminconnect.Garmin = Depends(get_api)
):
    cache_key = f"hr_weekly_{id(api)}_{days}_{date.today()}"
    
    def fetch_weekly_hr():
        results = []
        today = date.today()
        for i in range(days - 1, -1, -1):
            d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            try:
                data = api.get_heart_rates(d)
                results.append({
                    "date": d,
                    "restingHR": data.get("restingHeartRate"),
                    "maxHR": data.get("maxHeartRate"),
                    "minHR": data.get("minHeartRate"),
                })
            except Exception:
                results.append({"date": d, "restingHR": None, "maxHR": None})
        return results

    try:
        return fetch_with_cache(cache_key, fetch_weekly_hr)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Sono ──────────────────────────────────────────────────────────
@app.get("/sleep")
def get_sleep(
    date_str: str = None,
    api: garminconnect.Garmin = Depends(get_api)
):
    d = date_str or date.today().strftime("%Y-%m-%d")
    cache_key = f"sleep_{id(api)}_{d}"
    try:
        return fetch_with_cache(cache_key, lambda: api.get_sleep_data(d))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sleep/weekly")
def get_sleep_weekly(
    days: int = 7,
    api: garminconnect.Garmin = Depends(get_api)
):
    cache_key = f"sleep_weekly_{id(api)}_{days}_{date.today()}"
    
    def fetch_weekly_sleep():
        results = []
        today = date.today()
        for i in range(days - 1, -1, -1):
            d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            try:
                raw = api.get_sleep_data(d)
                summary = raw.get("dailySleepDTO", {})
                results.append({
                    "date": d,
                    "sleepScore": summary.get("sleepScores", {}).get("overall", {}).get("value"),
                    "deepSleepSeconds": summary.get("deepSleepSeconds"),
                    "lightSleepSeconds": summary.get("lightSleepSeconds"),
                    "remSleepSeconds": summary.get("remSleepSeconds"),
                    "awakeSleepSeconds": summary.get("awakeSleepSeconds"),
                    "sleepStartTimestampLocal": summary.get("sleepStartTimestampLocal"),
                    "sleepEndTimestampLocal": summary.get("sleepEndTimestampLocal"),
                })
            except Exception:
                results.append({"date": d})
        return results

    try:
        return fetch_with_cache(cache_key, fetch_weekly_sleep)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Passos & Calorias ─────────────────────────────────────────────
@app.get("/steps")
def get_steps(
    days: int = 7,
    api: garminconnect.Garmin = Depends(get_api)
):
    today = date.today()
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")
    cache_key = f"steps_{id(api)}_{start}_{end}"
    try:
        return fetch_with_cache(cache_key, lambda: api.get_daily_steps(start, end))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats")
def get_stats(
    date_str: str = None,
    api: garminconnect.Garmin = Depends(get_api)
):
    d = date_str or date.today().strftime("%Y-%m-%d")
    cache_key = f"stats_{id(api)}_{d}"
    try:
        return fetch_with_cache(cache_key, lambda: api.get_stats(d))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Body Battery & Stress ─────────────────────────────────────────
@app.get("/body-battery")
def get_body_battery(
    days: int = 7,
    api: garminconnect.Garmin = Depends(get_api)
):
    today = date.today()
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")
    cache_key = f"bb_{id(api)}_{start}_{end}"
    try:
        return fetch_with_cache(cache_key, lambda: api.get_body_battery(start, end))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stress")
def get_stress(
    date_str: str = None,
    api: garminconnect.Garmin = Depends(get_api)
):
    d = date_str or date.today().strftime("%Y-%m-%d")
    cache_key = f"stress_{id(api)}_{d}"
    try:
        return fetch_with_cache(cache_key, lambda: api.get_stress_data(d))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Health check ──────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.3"}