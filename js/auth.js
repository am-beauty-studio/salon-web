// Sesión de usuario. Guarda el token en localStorage y consulta /auth/me.
// Equivalente a src/auth.tsx de salon_app.

import { del as delApi, get, post, setUnauthorizedHandler } from "./api.js?v=49";
import { apiUrl } from "./config.js?v=50";
import { seguirEspera } from "./espera.js?v=1";

export let usuario = null;

// Latido de presencia: mientras la pestaña esté visible avisa a la API cada
// minuto para que el panel pueda mostrar la cuenta como «en línea».
const INTERVALO_LATIDO = 60000;
let temporizadorLatido = null;

function latir() {
  if (!haySesion() || document.visibilityState === "hidden") {
    return Promise.resolve();
  }
  return post("/auth/actividad", {}).catch(() => {});
}

function alVolver() {
  latir();
}

function alCambiarVisibilidad() {
  if (document.visibilityState === "visible") latir();
}

/** Arranca (o reinicia) el latido de la sesión actual. */
export function iniciarPresencia() {
  detenerPresencia();
  if (!haySesion()) return Promise.resolve();
  const primeraSenal = latir();
  temporizadorLatido = setInterval(latir, INTERVALO_LATIDO);
  window.addEventListener("focus", alVolver);
  document.addEventListener("visibilitychange", alCambiarVisibilidad);
  return primeraSenal;
}

/** Detiene el latido al cerrar sesión o al salir de la aplicación. */
export function detenerPresencia() {
  if (temporizadorLatido) {
    clearInterval(temporizadorLatido);
    temporizadorLatido = null;
  }
  window.removeEventListener("focus", alVolver);
  document.removeEventListener("visibilitychange", alCambiarVisibilidad);
}

/** Reemplaza la copia local del usuario (p. ej. tras cambiar la foto). */
export function actualizarUsuario(datos) {
  usuario = datos;
}

export function token() {
  return localStorage.getItem("salon_token");
}

export function haySesion() {
  return !!token();
}

export function esAdmin() {
  return usuario?.rol === "admin" || usuario?.rol === "superadmin";
}

export function esSuperadmin() {
  return usuario?.rol === "superadmin";
}

// OJO: el parámetro no puede llamarse `usuario`, porque taparía la variable de
// sesión del módulo y el rol se quedaría vacío tras iniciar sesión.
export async function entrar(identificador, password) {
  const cuerpo = new URLSearchParams({ username: identificador, password });
  const terminarEspera = seguirEspera();
  let resp;
  try {
    resp = await fetch(apiUrl() + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: cuerpo.toString(),
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión.");
  } finally {
    terminarEspera();
  }
  if (!resp.ok) {
    let mensaje = "Usuario o contraseña incorrectos";
    try {
      const e = await resp.json();
      if (typeof e.detail === "string") mensaje = e.detail;
    } catch { /* ignora */ }
    throw new Error(mensaje);
  }
  const { access_token } = await resp.json();
  localStorage.setItem("salon_token", access_token);
  actualizarUsuario(await get("/auth/me"));
  // El panel debe ver esta sesión como «en línea» desde el primer momento.
  iniciarPresencia();
  return usuario;
}

export async function restaurarSesion() {
  if (!haySesion()) return null;
  try {
    usuario = await get("/auth/me");
    return usuario;
  } catch {
    cerrarSesion();
    return null;
  }
}

export function cerrarSesion() {
  // Avisa a la API para que la cuenta pase a «desconectada» al instante.
  // Se lanza antes de borrar el token: la petición necesita la credencial.
  if (haySesion()) delApi("/auth/presencia").catch(() => {});
  detenerPresencia();
  localStorage.removeItem("salon_token");
  usuario = null;
}

// Si cualquier petición responde 401, cerrar sesión y mandar al login.
setUnauthorizedHandler(() => {
  cerrarSesion();
  location.hash = "#/login";
});
