"""
Garmin Dashboard – Backend API
Usa: garminconnect + FastAPI
Inicia com: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date, timedelta
import secrets

import garminconnect

app = FastAPI(title="Garmin Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Sessões em memória (app pessoal mono-utilizador) ──────────────
sessions: dict[str, garminconnect.Garmin] = {}


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
async def login(req: LoginRequest):
    """Autentica com Garmin Connect via SSO."""
    try:
        api = garminconnect.Garmin(req.email, req.password)
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
    except garminconnect.GarminConnectTooManyRequestsError:
        raise HTTPException(status_code=429, detail="Demasiadas tentativas. Aguarda uns minutos.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    sessions.pop(token, None)
    return {"ok": True}


# ── Atividades ────────────────────────────────────────────────────
@app.get("/activities")
async def get_activities(limit: int = 20, api: garminconnect.Garmin = Depends(get_api)):
    """Últimas N atividades (corridas, ciclismo, caminhadas, etc.)."""
    try:
        data = api.get_activities(0, limit)
        # Normalizar campos relevantes
        result = []
        for a in data:
            result.append({
                "activityId": a.get("activityId"),
                "activityName": a.get("activityName", ""),
                "activityType": a.get("activityType", {}).get("typeKey", "unknown"),
                "startTimeLocal": a.get("startTimeLocal", ""),
                "distance": round((a.get("distance") or 0) / 1000, 2),       # m → km
                "duration": round((a.get("duration") or 0) / 60, 1),          # s → min
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
async def get_heartrate(
    date_str: str = None,
    api: garminconnect.Garmin = Depends(get_api)
):
    """FC detalhada para um dia específico (YYYY-MM-DD)."""
    d = date_str or date.today().strftime("%Y-%m-%d")
    try:
        return api.get_heart_rates(d)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/heartrate/weekly")
async def get_heartrate_weekly(
    days: int = 7,
    api: garminconnect.Garmin = Depends(get_api)
):
    """FC de repouso dos últimos N dias."""
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


# ── Sono ──────────────────────────────────────────────────────────
@app.get("/sleep")
async def get_sleep(
    date_str: str = None,
    api: garminconnect.Garmin = Depends(get_api)
):
    """Dados de sono para um dia específico."""
    d = date_str or date.today().strftime("%Y-%m-%d")
    try:
        return api.get_sleep_data(d)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sleep/weekly")
async def get_sleep_weekly(
    days: int = 7,
    api: garminconnect.Garmin = Depends(get_api)
):
    """Resumo de sono para os últimos N dias."""
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


# ── Passos & Calorias ─────────────────────────────────────────────
@app.get("/steps")
async def get_steps(
    days: int = 7,
    api: garminconnect.Garmin = Depends(get_api)
):
    """Passos diários nos últimos N dias."""
    today = date.today()
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")
    try:
        return api.get_daily_steps(start, end)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats")
async def get_stats(
    date_str: str = None,
    api: garminconnect.Garmin = Depends(get_api)
):
    """Estatísticas diárias (calorias, passos, distância, stress, etc.)."""
    d = date_str or date.today().strftime("%Y-%m-%d")
    try:
        return api.get_stats(d)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Body Battery & Stress ─────────────────────────────────────────
@app.get("/body-battery")
async def get_body_battery(
    days: int = 7,
    api: garminconnect.Garmin = Depends(get_api)
):
    """Body Battery dos últimos N dias."""
    today = date.today()
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")
    try:
        return api.get_body_battery(start, end)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stress")
async def get_stress(
    date_str: str = None,
    api: garminconnect.Garmin = Depends(get_api)
):
    """Dados de stress para um dia específico."""
    d = date_str or date.today().strftime("%Y-%m-%d")
    try:
        return api.get_stress_data(d)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Health check ──────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
