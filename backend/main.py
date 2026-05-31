"""
Garmin Dashboard Backend v2.0
Sem garminconnect. Sem OAuth. Sem rate limiting.
Auth via cookies de browser (JWT_WEB + GARMIN-SSO-GUID).
"""
from __future__ import annotations
import os, time, secrets, logging
from datetime import date, timedelta

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from google import genai

from garmin_client import GarminClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("main")

app = FastAPI(title="Garmin Dashboard API", version="2.0.0")

# ── CORS ──────────────────────────────────────────────────────────
_cors = os.environ.get("CORS_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _cors.split(",") if o.strip()] or [
    "http://localhost:5173", "http://localhost:3000",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ── Estado ────────────────────────────────────────────────────────
sessions:  dict[str, GarminClient] = {}
api_cache: dict[str, dict]         = {}
CACHE_TTL = 3600

def _cache_get(k: str):
    e = api_cache.get(k)
    return e["data"] if e and e["expires"] > time.time() else None

def _cache_set(k: str, v):
    api_cache[k] = {"data": v, "expires": time.time() + CACHE_TTL}
    return v

# ── Modelos ───────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    message: str

# ── Auth ──────────────────────────────────────────────────────────
def get_client(request: Request) -> GarminClient:
    tok = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    if not tok or tok not in sessions:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    return sessions[tok]

# ── Login ─────────────────────────────────────────────────────────
@app.post("/login")
async def login(req: LoginRequest):
    sso = os.environ.get("GARMIN_SSO_GUID", "")
    if not sso:
        raise HTTPException(status_code=503, detail=(
            "GARMIN_SSO_GUID não configurado no Render."
        ))
    try:
        client = GarminClient()
        display = await run_in_threadpool(client.get_full_name)
        tok = secrets.token_urlsafe(32)
        sessions[tok] = client
        log.info("Login OK — %s", display or req.email)
        return {"token": tok, "displayName": display or req.email}
    except Exception as e:
        log.error("Login falhou: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/logout")
async def logout(request: Request):
    tok = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    sessions.pop(tok, None)
    return {"ok": True}

# ── Debug ─────────────────────────────────────────────────────────
@app.get("/debug")
async def debug(c: GarminClient = Depends(get_client)):
    """Testa todos os endpoints Garmin e devolve raw responses para diagnóstico."""
    today = date.today().strftime("%Y-%m-%d")
    dn    = c.display_name or "me"
    proxy = "https://connect.garmin.com/modern/proxy"

    tests = [
        ("profile",    f"{proxy}/userprofile-service/socialProfile"),
        ("heartrate",  f"{proxy}/wellness-service/wellness/dailyHeartRate/{dn}?date={today}"),
        ("sleep",      f"{proxy}/wellness-service/wellness/dailySleepData/{dn}?date={today}"),
        ("steps",      f"{proxy}/wellness-service/wellness/dailySummaryChart/{dn}?startDate={today}&endDate={today}"),
        ("stats",      f"{proxy}/userstats-service/wellness/daily/{dn}?fromDate={today}&untilDate={today}"),
        ("bb",         f"{proxy}/wellness-service/wellness/bodyBattery/reports/daily?startDate={today}&endDate={today}"),
        ("readiness",  f"{proxy}/metrics-service/metrics/trainingReadiness/daily/{today}"),
        ("training",   f"{proxy}/metrics-service/metrics/performanceMetrics/daily/{dn}?fromDate={today}&untilDate={today}"),
        ("hrv",        f"{proxy}/hrv-service/hrv/{today}"),
    ]

    def _run():
        out = {}
        for name, url in tests:
            try:
                r = c._s.get(url, timeout=10)
                out[name] = {
                    "status":       r.status_code,
                    "content_type": r.headers.get("Content-Type", ""),
                    "body_preview": r.text[:400],
                    "is_json":      "application/json" in r.headers.get("Content-Type", ""),
                }
            except Exception as e:
                out[name] = {"error": str(e)}
        return out

    results = await run_in_threadpool(_run)
    results["_meta"] = {
        "display_name":          dn,
        "jwt_expires_in_seconds": round(c._jwt_exp - time.time()),
        "cookies_set":           list(c._s.cookies.keys()),
    }
    return results

# ── Training Focus ────────────────────────────────────────────────
@app.get("/training-focus")
async def training_focus(c: GarminClient = Depends(get_client)):
    d = date.today().strftime("%Y-%m-%d")
    if v := _cache_get(f"focus_{d}"): return v
    def _f():
        return {
            "readiness": c.get_training_readiness(d),
            "status":    c.get_training_status(d),
            "hrv":       c.get_hrv_data(d),
        }
    try:
        return _cache_set(f"focus_{d}", await run_in_threadpool(_f))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Briefing IA ───────────────────────────────────────────────────
@app.get("/briefing")
async def briefing(c: GarminClient = Depends(get_client)):
    d = date.today().strftime("%Y-%m-%d")
    if v := _cache_get(f"briefing_{d}"): return v

    def _fetch():
        return {
            "sleep":  c.get_sleep_data(d),
            "stats":  c.get_stats(d),
            "bb":     c.get_body_battery(d, d),
            "ready":  c.get_training_readiness(d),
            "status": c.get_training_status(d),
            "hrv":    c.get_hrv_data(d),
        }

    try:
        g = await run_in_threadpool(_fetch)
    except Exception as e:
        return {"briefing": f"Erro Garmin: {e}"}

    sl  = g["sleep"].get("dailySleepDTO", {})
    scr = sl.get("sleepScores", {}).get("overall", {}).get("value", "N/D")
    tot = round(((sl.get("deepSleepSeconds") or 0) +
                 (sl.get("remSleepSeconds")  or 0) +
                 (sl.get("lightSleepSeconds") or 0)) / 3600, 1)
    st  = g["stats"]
    rdy = (g["ready"].get("dailyReadinessDTO") or g["ready"])
    hrv_s = (g["hrv"].get("hrvSummary") or {})

    prompt = f"""
Atua como fisiologista de desporto de alto rendimento.
Dados biométricos do atleta em {d}:
- Sono: {scr}/100 · {tot}h total
- HRV ontem: {hrv_s.get('lastNight','N/D')} · Estado VFC: {rdy.get('hrvStatus','N/D')}
- Readiness: {rdy.get('readinessValue','N/D')}
- Stress médio: {st.get('averageStressLevel','N/D')}/100
- Body Battery pico: {g['bb'][0].get('bodyBatteryHighestValue','N/D') if g['bb'] else 'N/D'}
- FC repouso: {st.get('restingHeartRate','N/D')} bpm · Passos: {st.get('totalSteps','N/D')}
- Estado treino: {(g['status'].get('trainingStatus') or {}).get('trainingStatusPeak','N/D')}
- VO2max: {g['status'].get('vo2MaxPreciseValue') or g['status'].get('vo2Max','N/D')}

3 pontos (máx 200 palavras, sem floreados):
1. EVIDÊNCIA BIOMÉTRICA
2. ESTADO DO SNC
3. PRESCRIÇÃO DO DIA (tipo · duração · intensidade específicos)
"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: return {"briefing": "🔴 GEMINI_API_KEY não configurada."}
    try:
        def _ai():
            return genai.Client(api_key=api_key).models.generate_content(
                model="gemini-2.5-flash", contents=prompt
            ).text
        return _cache_set(f"briefing_{d}", {"briefing": await run_in_threadpool(_ai)})
    except Exception as e:
        return {"briefing": f"🔴 IA: {e}"}

# ── Chat ──────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest, c: GarminClient = Depends(get_client)):
    d = date.today().strftime("%Y-%m-%d")
    stats = _cache_get(f"stats_{d}") or {}
    if not stats:
        try:
            stats = await run_in_threadpool(lambda: c.get_stats(d))
            _cache_set(f"stats_{d}", stats)
        except Exception:
            pass
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: return {"reply": "🔴 GEMINI_API_KEY não configurada."}
    prompt = (
        f"Treinador de corrida especializado em maratona. "
        f"Dados hoje: stress {stats.get('averageStressLevel','?')}/100, "
        f"passos {stats.get('totalSteps','?')}. "
        f"Responde concisamente: {req.message}"
    )
    try:
        def _ai():
            return genai.Client(api_key=api_key).models.generate_content(
                model="gemini-2.5-flash", contents=prompt
            ).text
        return {"reply": await run_in_threadpool(_ai)}
    except Exception as e:
        return {"reply": f"🔴 IA: {e}"}

# ── Atividades ────────────────────────────────────────────────────
@app.get("/activities")
async def activities(limit: int = 20, c: GarminClient = Depends(get_client)):
    if v := _cache_get(f"act_{limit}"): return v
    try:
        raw = await run_in_threadpool(lambda: c.get_activities(0, limit))
        data = [{"activityId": a.get("activityId"),
                 "activityName": a.get("activityName", ""),
                 "activityType": (a.get("activityType") or {}).get("typeKey", "unknown"),
                 "startTimeLocal": a.get("startTimeLocal", ""),
                 "distance": round((a.get("distance") or 0) / 1000, 2),
                 "duration": round((a.get("duration") or 0) / 60, 1),
                 "calories": a.get("calories"),
                 "averageHR": a.get("averageHR")} for a in (raw or [])]
        return _cache_set(f"act_{limit}", data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/activities/ytd")
async def activities_ytd(c: GarminClient = Depends(get_client)):
    hoje  = date.today()
    start = date(hoje.year, 1, 1).strftime("%Y-%m-%d")
    end   = hoje.strftime("%Y-%m-%d")
    if v := _cache_get(f"ytd_{start}"): return v
    try:
        raw = await run_in_threadpool(lambda: c.get_activities_by_date(start, end))
        data = [{"activityId": a.get("activityId"),
                 "activityName": a.get("activityName", ""),
                 "activityType": (a.get("activityType") or {}).get("typeKey", "unknown"),
                 "startTimeLocal": a.get("startTimeLocal", ""),
                 "distance": round((a.get("distance") or 0) / 1000, 2),
                 "duration": round((a.get("duration") or 0) / 60, 1),
                 "calories": a.get("calories", 0),
                 "averageHR": a.get("averageHR", 0)} for a in (raw or [])]
        return _cache_set(f"ytd_{start}", data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Biometria ─────────────────────────────────────────────────────
@app.get("/heartrate")
async def heartrate(date_str: str = None, c: GarminClient = Depends(get_client)):
    d = date_str or date.today().strftime("%Y-%m-%d")
    if v := _cache_get(f"hr_{d}"): return v
    try: return _cache_set(f"hr_{d}", await run_in_threadpool(lambda: c.get_heart_rates(d)))
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/heartrate/weekly")
async def heartrate_weekly(days: int = 7, c: GarminClient = Depends(get_client)):
    k = f"hrw_{days}_{date.today()}"
    if v := _cache_get(k): return v
    def _f():
        res, today = [], date.today()
        for i in range(days - 1, -1, -1):
            dd = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            try:
                data = c.get_heart_rates(dd)
                res.append({"date": dd, "restingHR": data.get("restingHeartRate"), "maxHR": data.get("maxHeartRate")})
            except Exception:
                res.append({"date": dd, "restingHR": None, "maxHR": None})
        return res
    try: return _cache_set(k, await run_in_threadpool(_f))
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/sleep")
async def sleep(date_str: str = None, c: GarminClient = Depends(get_client)):
    d = date_str or date.today().strftime("%Y-%m-%d")
    if v := _cache_get(f"sl_{d}"): return v
    try: return _cache_set(f"sl_{d}", await run_in_threadpool(lambda: c.get_sleep_data(d)))
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/sleep/weekly")
async def sleep_weekly(days: int = 7, c: GarminClient = Depends(get_client)):
    k = f"slw_{days}_{date.today()}"
    if v := _cache_get(k): return v
    def _f():
        res, today = [], date.today()
        for i in range(days - 1, -1, -1):
            dd = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            try:
                raw = c.get_sleep_data(dd)
                s   = raw.get("dailySleepDTO", {})
                res.append({"date": dd,
                            "sleepScore":        s.get("sleepScores", {}).get("overall", {}).get("value"),
                            "deepSleepSeconds":  s.get("deepSleepSeconds"),
                            "lightSleepSeconds": s.get("lightSleepSeconds"),
                            "remSleepSeconds":   s.get("remSleepSeconds"),
                            "awakeSleepSeconds": s.get("awakeSleepSeconds")})
            except Exception:
                res.append({"date": dd})
        return res
    try: return _cache_set(k, await run_in_threadpool(_f))
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/steps")
async def steps(days: int = 7, c: GarminClient = Depends(get_client)):
    today = date.today()
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    end   = today.strftime("%Y-%m-%d")
    k     = f"steps_{start}"
    if v := _cache_get(k): return v
    try: return _cache_set(k, await run_in_threadpool(lambda: c.get_daily_steps(start, end)))
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def stats(date_str: str = None, c: GarminClient = Depends(get_client)):
    d = date_str or date.today().strftime("%Y-%m-%d")
    if v := _cache_get(f"stats_{d}"): return v
    try: return _cache_set(f"stats_{d}", await run_in_threadpool(lambda: c.get_stats(d)))
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/body-battery")
async def body_battery(days: int = 7, c: GarminClient = Depends(get_client)):
    today = date.today()
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    end   = today.strftime("%Y-%m-%d")
    k     = f"bb_{start}"
    if v := _cache_get(k): return v
    try: return _cache_set(k, await run_in_threadpool(lambda: c.get_body_battery(start, end)))
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/stress")
async def stress_ep(date_str: str = None, c: GarminClient = Depends(get_client)):
    d = date_str or date.today().strftime("%Y-%m-%d")
    if v := _cache_get(f"stress_{d}"): return v
    try: return _cache_set(f"stress_{d}", await run_in_threadpool(lambda: c.get_stress_data(d)))
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

# ── Health ────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status":                "ok",
        "version":               "2.0.0",
        "auth":                  "cookie-based · no OAuth · no rate limiting",
        "garmin_jwt_configured": bool(os.environ.get("GARMIN_JWT_WEB")),
        "garmin_sso_configured": bool(os.environ.get("GARMIN_SSO_GUID")),
        "sessions_active":       len(sessions),
    }