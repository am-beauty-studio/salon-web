// Cliente HTTP para la API del salón. Equivalente a src/api.ts de salon_app:
// - Bearer token en cada petición con sesión.
// - Reintentos automáticos ante 502/503 (Render dormido) o red caída (solo GET).
// - Mensajes de error legibles a partir del "detail" de FastAPI.

import { apiUrl } from "./config.js?v=50";
import { seguirEspera } from "./espera.js?v=1";

let alNoAutorizado = null;
export function setUnauthorizedHandler(fn) { alNoAutorizado = fn; }

export class ApiError extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

function extraerMensaje(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const partes = detail.map((e) => {
      const campo = (e.loc || []).filter((p) => p !== "body").join(".");
      const texto = String(e.msg || "").replace(/^Value error,\s*/, "");
      return campo ? `${campo}: ${texto}` : texto;
    });
    return partes.join(" · ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return "Error inesperado";
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function intento(path, opciones, tieneToken) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), 75000);
  let resp;
  try {
    resp = await fetch(apiUrl() + path, { ...opciones, signal: control.signal });
  } finally {
    clearTimeout(temporizador);
  }
  if (resp.status === 401 && tieneToken && alNoAutorizado) {
    alNoAutorizado();
    throw new ApiError("Sesión expirada. Vuelve a entrar.", 401);
  }
  if (!resp.ok) {
    let mensaje = `Error ${resp.status}`;
    try {
      const cuerpo = await resp.json();
      mensaje = extraerMensaje(cuerpo.detail ?? cuerpo);
    } catch { /* sin cuerpo JSON */ }
    throw new ApiError(mensaje, resp.status);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

export async function request(path, opciones = {}, reintentos = 3) {
  const token = localStorage.getItem("salon_token");
  const cabeceras = { ...(opciones.headers || {}) };
  if (token) cabeceras["Authorization"] = `Bearer ${token}`;
  if (opciones.body && typeof opciones.body === "string" && !cabeceras["Content-Type"]) {
    cabeceras["Content-Type"] = "application/json";
  }
  const esGet = !opciones.method || opciones.method === "GET";
  const config = { ...opciones, headers: cabeceras };

  // Mientras la petición esté en curso, si tarda más de 4 s se muestra la
  // pantalla de espera con el logo y la barra de tiempo (Render despertando).
  const terminarEspera = seguirEspera();

  try {
    let ultimoError = null;
    for (let i = 0; i < reintentos; i++) {
      try {
        return await intento(path, config, !!token);
      } catch (e) {
        const esApi = e instanceof ApiError;
        // 502/503 = Render aún arrancando (la petición no llegó a la API).
        const arrancando = esApi && (e.status === 502 || e.status === 503);
        // Errores de validación, sesión, etc.: no se reintentan.
        if (esApi && !arrancando) throw e;

        ultimoError = e;
        // Un tiempo de espera agotado no se repite: ya se esperó lo suficiente.
        const abortada = !esApi && e?.name === "AbortError";
        // Reintentar solo GET (idempotente).
        if (esGet && !abortada && i < reintentos - 1) {
          await pausa(4000);
          continue;
        }
        if (arrancando) throw e;
        throw new ApiError(
          "No se pudo conectar con el servidor. Revisa tu conexión.",
          0
        );
      }
    }
    throw ultimoError;
  } finally {
    terminarEspera();
  }
}

export const get = (path) => request(path);
export const post = (path, datos) =>
  request(path, { method: "POST", body: JSON.stringify(datos) });
export const patch = (path, datos) =>
  request(path, { method: "PATCH", body: JSON.stringify(datos) });
export const put = (path, datos) =>
  request(path, { method: "PUT", body: JSON.stringify(datos) });
export const del = (path) => request(path, { method: "DELETE" });

/** Ping sin autenticación para "despertar" el servidor (Render dormido). */
export const calentarServidor = () => {
  const terminarEspera = seguirEspera();
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), 75000);
  return fetch(apiUrl() + "/", { signal: control.signal })
    .catch(() => {})
    .finally(() => {
      clearTimeout(temporizador);
      terminarEspera();
    });
};
