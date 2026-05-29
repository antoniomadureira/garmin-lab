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

app = FastAPI(title="Garmin Dashboard API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://garmin-lab.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: dict[str, garminconnect.Garmin] = {}
api_cache: dict[str, dict] = {}
CACHE_TTL = 3600  

def fetch_with_cache(cache_key: str, fetch_func):
    now = time.time()
    if cache_key in api_cache and api_cache[cache_key]["expires"] > now:
        return api_cache[cache_key]["data"]
    data = fetch_func()
    api_cache[cache_key] = {"data": data, "expires": now + CACHE_TTL}
    return data

class LoginRequest(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    message: str

def get_api(request: Request) -> garminconnect.Garmin:
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    if not token or token not in sessions:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    return sessions[token]

@app.post("/login")
def login(req: LoginRequest):
    try:
        token_store = "/tmp/garmin_tokens"
        env_token = os.getenv("GARMIN_SESSION_TOKEN")
        
        if env_token:
            env_token = re.sub(r'[^a-zA-Z0-9+/=]', '', env_token)
            padding = len(env_token) % 4
            if padding > 0:
                env_token += "=" * (4 - padding)

            os.makedirs(token_store, exist_ok=True)
            tokens_data = json.loads(base64.b64decode(env_token).decode('utf-8'))
            for filename, content in tokens_data.items():
                with open(os.path.join(token_store, filename), "w") as f:
                    f.write(content)
                    
        api = garminconnect.Garmin(req.email, req.password)
        
        if env_token and os.path.exists(token_store):
            api.login(token_store)
        else:
            api.login() 
            
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

# ── EM FOCO (Readiness & Status) ──────────────────────────────────
@app.get("/training-focus")
def get_training_focus(api: garminconnect.Garmin = Depends(get_api)):
    try:
        today = date.today().strftime("%Y-%m-%d")
        def fetch_readiness():
            try: return api.get_training_readiness(today)
            except Exception: return {}
        def fetch_status():
            try: return api.get_training_status(today)
            except Exception: return {}

        return {
            "readiness": fetch_with_cache(f"readiness_{id(api)}_{today}", fetch_readiness),
            "status": fetch_with_cache(f"status_{id(api)}_{today}", fetch_status)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── IA Briefing & Chat ────────────────────────────────────────────
@app.get("/briefing")
def get_ai_briefing(api: garminconnect.Garmin = Depends(get_api)):
    try:
        today = date.today().strftime("%Y-%m-%d")
        try:
            sleep_data = api.get_sleep_data(today) or {}
            stats = api.get_stats(today) or {}
            body_battery = api.get_body_battery(today, today) or []
        except Exception as api_err:
            return {"briefing": f"Erro a obter dados da Garmin. Detalhe: {str(api_err)}"}
            
        sleep_score = sleep_data.get("dailySleepDTO", {}).get("sleepScores", {}).get("overall", {}).get("value", "N/A")
        stress = stats.get("averageStressLevel", "N/A")
        bb_highest = body_battery[0].get("bodyBatteryHighestValue", "N/A") if len(body_battery) > 0 else "N/A"

        prompt = f"""
        Atua como fisiologista de desporto. O atleta tem um volume de treino de 60km/semana (preparação Maratona de Madrid), complementado com força corporal e percursos do Caminho de Santiago.
        Dados extraídos hoje ({today}): Sono: {sleep_score}/100 | Stress: {stress}/100 | Body Battery Pico: {bb_highest}/100.
        Escreve um briefing analítico nestes 3 pontos: 1. EVIDÊNCIA BIOMÉTRICA, 2. ESTADO DO SNC, 3. PRESCRIÇÃO FUNDAMENTADA.
        """

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key: return {"briefing": "🔴 Erro: Chave GEMINI_API_KEY em falta."}
            
        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(model='gemini-2.5-flash', contents=prompt)
            return {"briefing": response.text}
        except Exception as err:
            return {"briefing": f"🔴 Erro de IA: {str(err)}"}
    except Exception as e:
        return {"briefing": f"Erro de servidor: {str(e)}"}

@app.post("/chat")
def ask_pt(req: ChatRequest, api: garminconnect.Garmin = Depends(get_api)):
    try:
        today = date.today().strftime("%Y-%m-%d")
        stats = api.get_stats(today) or {}
        stress = stats.get("averageStressLevel", "Desconhecido")
        prompt = f"És o treinador pessoal do Tomás. Ele corre para a Maratona de Madrid, faz reforço com peso corporal e gere o Caminho de Santiago. Stress médio hoje: {stress}/100. Responde à pergunta: {req.message}"
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key: return {"reply": "🔴 Erro: GEMINI_API_KEY em falta."}
        try:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(model='gemini-2.5-flash', contents=prompt)
            return {"reply": response.text}
        except Exception as err:
            return {"reply": f"🔴 Erro de IA: {str(err)}"}
    except Exception as e:
        return {"reply": f"Erro interno: {str(e)}"}

# ── Atividades & Biometria ────────────────────────────────────────
@app.get("/activities")
def get_activities(limit: int = 20, api: garminconnect.Garmin = Depends(get_api)):
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
                "distance": round((a.get("distance") or 0) / 1000, 2),
                "duration": round((a.get("duration") or 0) / 60, 1),
                "calories": a.get("calories"),
                "averageHR": a.get("averageHR"),
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/activities/ytd")
def get_activities_ytd(api: garminconnect.Garmin = Depends(get_api)):
    try:
        hoje = date.today()
        inicio_ano = date(hoje.year, 1, 1).strftime("%Y-%m-%d")
        fim = hoje.strftime("%Y-%m-%d")
        cache_key = f"activities_ytd_{id(api)}_{inicio_ano}_{fim}"
        data = fetch_with_cache(cache_key, lambda: api.get_activities_by_date(inicio_ano, fim, ""))
        
        result = []
        if data:
            for a in data:
                result.append({
                    "activityId": a.get("activityId"),
                    "activityName": a.get("activityName", ""),
                    "activityType": a.get("activityType", {}).get("typeKey", "unknown"),
                    "startTimeLocal": a.get("startTimeLocal", ""),
                    "distance": round((a.get("distance") or 0) / 1000, 2),
                    "duration": round((a.get("duration") or 0) / 60, 1),
                    "calories": a.get("calories", 0),
                    "averageHR": a.get("averageHR", 0),
                })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/heartrate")
def get_heartrate(date_str: str = None, api: garminconnect.Garmin = Depends(get_api)):
    d = date_str or date.today().strftime("%Y-%m-%d")
    return fetch_with_cache(f"hr_{id(api)}_{d}", lambda: api.get_heart_rates(d))

@app.get("/heartrate/weekly")
def get_heartrate_weekly(days: int = 7, api: garminconnect.Garmin = Depends(get_api)):
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

@app.get("/sleep")
def get_sleep(date_str: str = None, api: garminconnect.Garmin = Depends(get_api)):
    d = date_str or date.today().strftime("%Y-%m-%d")
    return fetch_with_cache(f"sleep_{id(api)}_{d}", lambda: api.get_sleep_data(d))

@app.get("/sleep/weekly")
def get_sleep_weekly(days: int = 7, api: garminconnect.Garmin = Depends(get_api)):
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
                })
            except Exception:
                results.append({"date": d})
        return results
    try:
        return fetch_with_cache(cache_key, fetch_weekly_sleep)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/steps")
def get_steps(days: int = 7, api: garminconnect.Garmin = Depends(get_api)):
    today = date.today()
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")
    return fetch_with_cache(f"steps_{id(api)}_{start}_{end}", lambda: api.get_daily_steps(start, end))

@app.get("/stats")
def get_stats(date_str: str = None, api: garminconnect.Garmin = Depends(get_api)):
    d = date_str or date.today().strftime("%Y-%m-%d")
    return fetch_with_cache(f"stats_{id(api)}_{d}", lambda: api.get_stats(d))

@app.get("/body-battery")
def get_body_battery(days: int = 7, api: garminconnect.Garmin = Depends(get_api)):
    today = date.today()
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")
    return fetch_with_cache(f"bb_{id(api)}_{start}_{end}", lambda: api.get_body_battery(start, end))

@app.get("/stress")
def get_stress(date_str: str = None, api: garminconnect.Garmin = Depends(get_api)):
    d = date_str or date.today().strftime("%Y-%m-%d")
    return fetch_with_cache(f"stress_{id(api)}_{d}", lambda: api.get_stress_data(d))

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.1.0"}