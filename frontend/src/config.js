// Usa o proxy local em desenvolvimento, ou o URL de produção se estiver online
export const BASE_URL = import.meta.env.DEV 
  ? "/api" 
  : "https://garmin-lab.onrender.com";