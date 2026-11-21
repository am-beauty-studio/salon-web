// Configuración de la conexión a la API.
// Por defecto se usa la API de Render (la misma que la app Android), también
// cuando la web se abre en este PC. Desde el login ("Servidor: …") se puede
// cambiar a otra dirección; la elección se recuerda en el navegador.

// v50: la web pasa a usar Render por defecto. La clave cambia de nombre para
// que los navegadores que habían guardado la API local arranquen con Render.
const CLAVE_URL = "salon_api_url_v2";

/** URL local por defecto (donde corre `uvicorn app.main:app`). */
export const API_URL_LOCAL = "http://127.0.0.1:8000";
/** API desplegada en Render (la misma que usa la app Android). */
export const API_URL_RENDER = "https://salon-api-u08l.onrender.com";

export function apiUrl() {
  return localStorage.getItem(CLAVE_URL) || API_URL_RENDER;
}

export function fijarApiUrl(url) {
  const limpia = (url || "").trim().replace(/\/+$/, "");
  if (limpia) localStorage.setItem(CLAVE_URL, limpia);
  else localStorage.removeItem(CLAVE_URL);
}
