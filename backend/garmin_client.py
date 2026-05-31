"""
garmin_client.py — Acesso directo à Garmin Connect API via cookies de browser.

ZERO OAuth. ZERO garminconnect. ZERO rate limiting.

Variáveis de ambiente:
  GARMIN_JWT_WEB        — cookie JWT_WEB (auto-renovado via SSO GUID)
  GARMIN_SSO_GUID       — cookie GARMIN-SSO-GUID (válido até Out 2026)
  GARMIN_SESSION        — cookie session (suporte à renovação)
  GARMIN_DISPLAY_NAME   — username Garmin (auto-descoberto no 1.º login)
"""
from __future__ import annotations
import os, time, logging, json, base64
from typing import Any
import requests

log = logging.getLogger("garmin_client")

CONNECT     = "https://connect.garmin.com"
CONNECT_API = "https://connectapi.garmin.com"

BASE_HEADERS = {
    "User-Agent":   ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                     "AppleWebKit/537.36 (KHTML, like Gecko) "
                     "Chrome/124.0.0.0 Safari/537.36"),
    "NK":           "NT",
    "X-app-ver":    "4.70.2.0",
    "Accept":       "application/json, text/javascript, */*; q=0.01",
    "Origin":       CONNECT,
    "Referer":      f"{CONNECT}/modern/",
    "di-backend":   "connectapi.garmin.com",
}


class GarminClient:
    def __init__(self):
        self.jwt       = os.environ.get("GARMIN_JWT_WEB", "")
        self.sso_guid  = os.environ.get("GARMIN_SSO_GUID", "")
        self.session_c = os.environ.get("GARMIN_SESSION", "")
        self.display_name = os.environ.get("GARMIN_DISPLAY_NAME", "")
        self._jwt_exp  = self._parse_jwt_exp(self.jwt)
        self._s        = requests.Session()
        self._s.headers.update(BASE_HEADERS)
        self._apply_cookies()

    # ── Cookies ────────────────────────────────────────────────
    def _apply_cookies(self):
        for domain in [".garmin.com", ".connect.garmin.com", "connect.garmin.com"]:
            if self.jwt:       self._s.cookies.set("JWT_WEB",         self.jwt,       domain=domain)
            if self.sso_guid:  self._s.cookies.set("GARMIN-SSO-GUID", self.sso_guid,  domain=domain)
            if self.session_c: self._s.cookies.set("session",         self.session_c, domain=domain)

    @staticmethod
    def _parse_jwt_exp(jwt: str) -> float:
        try:
            parts = jwt.split(".")
            if len(parts) == 3:
                pad = parts[1] + "=" * (4 - len(parts[1]) % 4)
                return float(json.loads(base64.b64decode(pad)).get("exp", 0))
        except Exception:
            pass
        return 0.0

    def _valid(self) -> bool:
        return bool(self.jwt) and time.time() < self._jwt_exp - 300

    # ── Auto-renovação JWT via SSO GUID ────────────────────────
    def _refresh(self) -> bool:
        if not self.sso_guid:
            log.warning("GARMIN_SSO_GUID não definido — sem auto-renovação")
            return False
        log.info("A renovar JWT_WEB via SSO GUID...")
        try:
            # O endpoint de renovação de sessão web — NÃO é o OAuth rate-limited
            r = self._s.get(
                f"{CONNECT}/modern/di-oauth/exchange",
                allow_redirects=True, timeout=15,
            )
            new_jwt = r.cookies.get("JWT_WEB")
            if new_jwt:
                self.jwt = new_jwt
                self._jwt_exp = self._parse_jwt_exp(new_jwt)
                self._apply_cookies()
                log.info("JWT_WEB renovado com sucesso (expira em %.0f s)",
                         self._jwt_exp - time.time())
                return True
            log.warning("Renovação não devolveu JWT_WEB (%d)", r.status_code)
            return False
        except Exception as e:
            log.error("Erro na renovação: %s", e)
            return False

    # ── HTTP helper ─────────────────────────────────────────────
    def _get(self, path: str, base: str = CONNECT_API, **kw) -> Any:
        if not self._valid():
            self._refresh()
        self._s.headers["Authorization"] = f"Bearer {self.jwt}"
        url = f"{base}{path}"
        r   = self._s.get(url, timeout=20, **kw)
        if r.status_code == 401:
            log.info("401 recebido — a tentar renovação...")
            if self._refresh():
                self._s.headers["Authorization"] = f"Bearer {self.jwt}"
                r = self._s.get(url, timeout=20, **kw)
        r.raise_for_status()
        return r.json()

    # ── Perfil ──────────────────────────────────────────────────
    def get_full_name(self) -> str:
        try:
            data = self._get(
                "/userprofile-service/socialProfile",
                base=CONNECT_API,
            )
            name = data.get("displayName") or data.get("userName") or data.get("fullName", "")
            if name and not self.display_name:
                self.display_name = name
            return name
        except Exception as e:
            log.error("get_full_name: %s", e)
            return self.display_name

    def _dn(self) -> str:
        return self.display_name or "me"

    # ── Atividades ───────────────────────────────────────────────
    def get_activities(self, start: int = 0, limit: int = 20) -> list:
        return self._get(
            f"/activitylist-service/activities/search/activities"
            f"?start={start}&limit={limit}"
        )

    def get_activities_by_date(self, start_date: str, end_date: str) -> list:
        return self._get(
            f"/activitylist-service/activities/search/activities"
            f"?startDate={start_date}&endDate={end_date}&limit=200"
        )

    # ── Biometria ────────────────────────────────────────────────
    def get_heart_rates(self, d: str) -> dict:
        return self._get(f"/wellness-service/wellness/dailyHeartRate/{self._dn()}?date={d}")

    def get_sleep_data(self, d: str) -> dict:
        return self._get(f"/wellness-service/wellness/dailySleepData/{self._dn()}?date={d}")

    def get_daily_steps(self, start: str, end: str) -> list:
        return self._get(
            f"/wellness-service/wellness/dailySummaryChart/{self._dn()}"
            f"?startDate={start}&endDate={end}"
        )

    def get_stats(self, d: str) -> dict:
        try:
            return self._get(
                f"/userstats-service/wellness/daily/{self._dn()}"
                f"?fromDate={d}&untilDate={d}"
            )
        except Exception:
            return {}

    def get_body_battery(self, start: str, end: str) -> list:
        return self._get(
            f"/wellness-service/wellness/bodyBattery/reports/daily"
            f"?startDate={start}&endDate={end}"
        )

    def get_stress_data(self, d: str) -> dict:
        return self._get(f"/wellness-service/wellness/dailyStress/{d}")

    # ── Training ─────────────────────────────────────────────────
    def get_training_readiness(self, d: str) -> dict:
        try:
            return self._get(f"/metrics-service/metrics/trainingReadiness/daily/{d}")
        except Exception:
            return {}

    def get_training_status(self, d: str) -> dict:
        try:
            return self._get(
                f"/metrics-service/metrics/performanceMetrics/daily/{self._dn()}"
                f"?fromDate={d}&untilDate={d}"
            )
        except Exception:
            return {}

    def get_hrv_data(self, d: str) -> dict:
        try:
            return self._get(f"/hrv-service/hrv/{d}")
        except Exception:
            return {}
