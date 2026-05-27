const BASE = "https://garmin-lab.onrender.com";

let _token = localStorage.getItem("garmin_token") || null;

export const setToken = (t) => {
  _token = t;
  if (t) localStorage.setItem("garmin_token", t);
  else localStorage.removeItem("garmin_token");
};

export const getToken = () => _token;

async function req(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  const res = await fetch(BASE + path, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Erro desconhecido" }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const login = (email, password) =>
  req("/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const logout = () =>
  req("/logout", { method: "POST" });

export const fetchActivities = (limit = 20) =>
  req(`/activities?limit=${limit}`);

export const fetchHeartRateDay = (date) =>
  req(`/heartrate?date_str=${date}`);

export const fetchHeartRateWeekly = (days = 7) =>
  req(`/heartrate/weekly?days=${days}`);

export const fetchSleepDay = (date) =>
  req(`/sleep?date_str=${date}`);

export const fetchSleepWeekly = (days = 7) =>
  req(`/sleep/weekly?days=${days}`);

export const fetchSteps = (days = 7) =>
  req(`/steps?days=${days}`);

export const fetchStats = (date) =>
  req(`/stats?date_str=${date}`);

export const fetchBodyBattery = (days = 7) =>
  req(`/body-battery?days=${days}`);

export const fetchStress = (date) =>
  req(`/stress?date_str=${date}`);
