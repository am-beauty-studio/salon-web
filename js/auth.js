// Sesión de usuario. Guarda el token en localStorage y consulta /auth/me.
// Equivalente a src/auth.tsx de salon_app.

import { get, setUnauthorizedHandler } from "./api.js?v=49";
import { apiUrl } from "./config.js?v=50";
import { seguirEspera } from "./espera.js?v=1";

export let usuario = null;

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
  localStorage.removeItem("salon_token");
  usuario = null;
}

// Si cualquier petición responde 401, cerrar sesión y mandar al login.
setUnauthorizedHandler(() => {
  cerrarSesion();
  location.hash = "#/login";
});
