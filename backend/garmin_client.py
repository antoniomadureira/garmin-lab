"""
garmin_client.py v2.2
Usa connect.garmin.com/proxy/ (sem /modern/) + connectapi.garmin.com como fallback.
Cookies válidos confirmados pelo debug — só o path estava errado.
"""
from __future__ import annotations
import os, time, logging, json, base64, re
from typing import Any
import requests

log = logging.getLogger("garmin_client")

CONNECT     = "https://connect.garmin.com"
PROXY       = f"{CONNECT}/proxy"
CONNECT_API = "https://connectapi.garmin.com"

BASE_HEADERS = {
    "User-Agent":       ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                         "AppleWebKit/537.36 (KHTML, like Gecko) "
                         "Chrome/124.0.0.0 Safari/537.36"),
    "nk":               "NT",
    "Accept":           "application/json, text/javascript, */*; q=0.01",
    "Accept-Language":  "pt-PT,pt;q=0.9,en;q=0.8",
    "X-Requested-With": "XMLHttpRequest",
    "Origin":           CONNECT,
    "Referer":          f"{CONNECT}/modern/",
}


class GarminClient:
    def __init__(self):
        self.jwt        = os.environ.get("GARMIN_JWT_WEB", "")
        self.sso_guid   = os.environ.get("GARMIN_SSO_GUID", "")
        self.session_c  = os.environ.get("GARMIN_SESSION", "")
        self.sessionid  = os.environ.get("GARMIN_SESSIONID", "")
        self.display_name = os.environ.get("GARMIN_DISPLAY_NAME", "")
        self._jwt_exp   = self._parse_jwt_exp(self.jwt)
        self._csrf      = ""
        self._s         = requests.Session()
        self._s.headers.update(BASE_HEADERS)
        self._apply_cookies()
        self._fetch_csrf()

    def _apply_cookies(self):
        c = self._s.cookies
        for domain in [".garmin.com", ".connect.garmin.com", "connect.garmin.com"]:
            if self.jwt:       c.set("JWT_WEB",         self.jwt,       domain=domain)
            if self.sso_guid:  c.set("GARMIN-SSO-GUID", self.sso_guid,  domain=domain)
            if self.session_c: c.set("session",         self.session_c, domain=domain)
            if self.sessionid: c.set("SESSIONID",       self.sessionid, domain=domain)

    def _fetch_csrf(self):
        try:
            r = self._s.get(f"{CONNECT}/modern/", timeout=10, allow_redirects=True)
            match = re.search(r'<meta name="csrf-token" content="([^"]+)"', r.text)
            if match:
                self._csrf = match.group(1)
                self._s.headers["X-CSRF-Token"] = self._csrf
                log.info("CSRF token: %s…", self._csrf[:12])
        except Exception as e:
            log.warning("CSRF fetch falhou: %s", e)

    @staticmethod
    def _parse_jwt_exp(jwt: str) -> float:
        try:
            parts = jwt.split(".")
            if len(parts) == 3:
                pad = parts[1] + "=" * (4 - len(parts[1]) % 4)
                return float(json.loads(base64.b64decode(pad)).get("exp", 0))
        except Exception:
            pass
        return time.time() + 3600

    def _valid(self) -> bool:
        return bool(self.jwt) and time.time() < self._jwt_exp - 300

    def _refresh(self) -> bool:
        if not self.sso_guid:
            return False
        try:
            r = self._s.get(f"{CONNECT}/modern/di-oauth/exchange", allow_redirects=True, timeout=15)
            new_jwt = r.cookies.get("JWT_WEB")
            if new_jwt:
                self.jwt = new_jwt
                self._jwt_exp = self._parse_jwt_exp(new_jwt)
                self._apply_cookies()
                self._fetch_csrf()
                return True
            return False
        except Exception as e:
            log.error("Refresh: %s", e)
            return False

    def _get(self, path: str, **kw) -> Any:
        if not self._valid():
            self._refresh()

        # Tentativa 1: proxy sem /modern/
        url = f"{PROXY}{path}"
        r   = self._s.get(url, timeout=20, **kw)
        ct  = r.headers.get("Content-Type", "")

        # Se devolver HTML → CSRF expirou, tenta renovar
        if "text/html" in ct:
            log.warning("HTML em %s — a renovar CSRF", path)
            self._fetch_csrf()
            r  = self._s.get(url, timeout=20, **kw)
            ct = r.headers.get("Content-Type", "")

        # Tentativa 2: connectapi.garmin.com com Bearer token
        if "text/html" in ct or r.status_code in (401, 403):
            log.info("Proxy falhou — a tentar connectapi directo")
            hdrs = {**dict(self._s.headers), "Authorization": f"Bearer {self.jwt}"}
            r    = self._s.get(f"{CONNECT_API}{path}", headers=hdrs, timeout=20, **kw)
            ct   = r.headers.get("Content-Type", "")

        r.raise_for_status()

        if "application/json" not in ct:
            raise ValueError(f"Não-JSON ({ct[:50]}) em {path}: {r.text[:150]}")
        return r.json()

    def _dn(self) -> str:
        return self.display_name or "me"

    def get_full_name(self) -> str:
        for path in ["/userprofile-service/socialProfile", "/userprofile-service/userprofile"]:
            try:
                data = self._get(path)
                name = data.get("displayName") or data.get("userName") or data.get("fullName", "")
                if name:
                    self.display_name = name
                    return name
            except Exception:
                continue
        return self.display_name

    def get_activities(self, start: int = 0, limit: int = 20) -> list:
        return self._get(f"/activitylist-service/activities/search/activities?start={start}&limit={limit}")

    def get_activities_by_date(self, start_date: str, end_date: str) -> list:
        return self._get(f"/activitylist-service/activities/search/activities?startDate={start_date}&endDate={end_date}&limit=200")

    def get_heart_rates(self, d: str) -> dict:
        return self._get(f"/wellness-service/wellness/dailyHeartRate/{self._dn()}?date={d}")

    def get_sleep_data(self, d: str) -> dict:
        return self._get(f"/wellness-service/wellness/dailySleepData/{self._dn()}?date={d}")

    def get_daily_steps(self, start: str, end: str) -> list:
        return self._get(f"/wellness-service/wellness/dailySummaryChart/{self._dn()}?startDate={start}&endDate={end}")

    def get_stats(self, d: str) -> dict:
        try: return self._get(f"/userstats-service/wellness/daily/{self._dn()}?fromDate={d}&untilDate={d}")
        except Exception: return {}

    def get_body_battery(self, start: str, end: str) -> list:
        try: return self._get(f"/wellness-service/wellness/bodyBattery/reports/daily?startDate={start}&endDate={end}")
        except Exception: return []

    def get_stress_data(self, d: str) -> dict:
        try: return self._get(f"/wellness-service/wellness/dailyStress/{d}")
        except Exception: return {}

    def get_training_readiness(self, d: str) -> dict:
        try: return self._get(f"/metrics-service/metrics/trainingReadiness/daily/{d}")
        except Exception: return {}

    def get_training_status(self, d: str) -> dict:
        try: return self._get(f"/metrics-service/metrics/performanceMetrics/daily/{self._dn()}?fromDate={d}&untilDate={d}")
        except Exception: return {}

    def get_hrv_data(self, d: str) -> dict:
        try: return self._get(f"/hrv-service/hrv/{d}")
        except Exception: return {}
