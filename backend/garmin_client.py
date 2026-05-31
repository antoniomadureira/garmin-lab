"""
garmin_client.py v2.1
Usa connect.garmin.com/modern/proxy/ — autenticação via cookies (JWT_WEB + session).
Sem OAuth. Sem Bearer token directo ao connectapi.
"""
from __future__ import annotations
import os, time, logging, json, base64
from typing import Any
import requests

log = logging.getLogger("garmin_client")

CONNECT = "https://connect.garmin.com"
PROXY   = f"{CONNECT}/modern/proxy"   # ← endpoint correcto com cookie auth

BASE_HEADERS = {
    "User-Agent":   ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                     "AppleWebKit/537.36 (KHTML, like Gecko) "
                     "Chrome/124.0.0.0 Safari/537.36"),
    "NK":           "NT",
    "X-app-ver":    "4.70.2.0",
    "Accept":       "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
    "Origin":       CONNECT,
    "Referer":      f"{CONNECT}/modern/",
    "X-Requested-With": "XMLHttpRequest",
}


class GarminClient:
    def __init__(self):
        self.jwt       = os.environ.get("GARMIN_JWT_WEB", "")
        self.sso_guid  = os.environ.get("GARMIN_SSO_GUID", "")
        self.session_c = os.environ.get("GARMIN_SESSION", "")
        self.sessionid = os.environ.get("GARMIN_SESSIONID", "")
        self.display_name = os.environ.get("GARMIN_DISPLAY_NAME", "")
        self._jwt_exp  = self._parse_jwt_exp(self.jwt)
        self._s        = requests.Session()
        self._s.headers.update(BASE_HEADERS)
        self._apply_cookies()

    def _apply_cookies(self):
        cjar = self._s.cookies
        if self.jwt:
            cjar.set("JWT_WEB",         self.jwt,       domain=".garmin.com")
            cjar.set("JWT_WEB",         self.jwt,       domain=".connect.garmin.com")
            cjar.set("JWT_WEB",         self.jwt,       domain="connect.garmin.com")
        if self.sso_guid:
            cjar.set("GARMIN-SSO-GUID", self.sso_guid,  domain=".garmin.com")
        if self.session_c:
            cjar.set("session",         self.session_c, domain=".connect.garmin.com")
            cjar.set("session",         self.session_c, domain="connect.garmin.com")
        if self.sessionid:
            cjar.set("SESSIONID",       self.sessionid, domain="connect.garmin.com")

    @staticmethod
    def _parse_jwt_exp(jwt: str) -> float:
        try:
            parts = jwt.split(".")
            if len(parts) == 3:
                pad = parts[1] + "=" * (4 - len(parts[1]) % 4)
                return float(json.loads(base64.b64decode(pad)).get("exp", 0))
        except Exception:
            pass
        return time.time() + 3600  # assume 1h se não consegue parsear

    def _valid(self) -> bool:
        return bool(self.jwt) and time.time() < self._jwt_exp - 300

    def _refresh(self) -> bool:
        if not self.sso_guid:
            return False
        log.info("A renovar JWT via SSO GUID...")
        try:
            r = self._s.get(
                f"{CONNECT}/modern/di-oauth/exchange",
                allow_redirects=True, timeout=15,
            )
            new_jwt = r.cookies.get("JWT_WEB")
            if new_jwt:
                self.jwt = new_jwt
                self._jwt_exp = self._parse_jwt_exp(new_jwt)
                self._apply_cookies()
                log.info("JWT renovado (expira em %.0f s)", self._jwt_exp - time.time())
                return True
            return False
        except Exception as e:
            log.error("Refresh falhou: %s", e)
            return False

    # ── HTTP via proxy (cookies) ──────────────────────────────
    def _get(self, path: str, **kw) -> Any:
        if not self._valid():
            self._refresh()
        url = f"{PROXY}{path}"
        r   = self._s.get(url, timeout=20, **kw)
        if r.status_code == 401:
            log.info("401 — a tentar refresh...")
            if self._refresh():
                r = self._s.get(url, timeout=20, **kw)
        r.raise_for_status()
        return r.json()

    def _dn(self) -> str:
        return self.display_name or "me"

    # ── Perfil ────────────────────────────────────────────────
    def get_full_name(self) -> str:
        try:
            data = self._get("/userprofile-service/socialProfile")
            name = (data.get("displayName") or
                    data.get("userName") or
                    data.get("fullName") or "")
            if name:
                self.display_name = name
            return name
        except Exception as e:
            log.error("get_full_name: %s", e)
            return self.display_name

    # ── Atividades ────────────────────────────────────────────
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

    # ── Biometria ─────────────────────────────────────────────
    def get_heart_rates(self, d: str) -> dict:
        return self._get(
            f"/wellness-service/wellness/dailyHeartRate/{self._dn()}?date={d}"
        )

    def get_sleep_data(self, d: str) -> dict:
        return self._get(
            f"/wellness-service/wellness/dailySleepData/{self._dn()}?date={d}"
        )

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
        try:
            return self._get(
                f"/wellness-service/wellness/bodyBattery/reports/daily"
                f"?startDate={start}&endDate={end}"
            )
        except Exception:
            return []

    def get_stress_data(self, d: str) -> dict:
        try:
            return self._get(
                f"/wellness-service/wellness/dailyStress/{d}"
            )
        except Exception:
            return {}

    # ── Training ──────────────────────────────────────────────
    def get_training_readiness(self, d: str) -> dict:
        try:
            return self._get(
                f"/metrics-service/metrics/trainingReadiness/daily/{d}"
            )
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