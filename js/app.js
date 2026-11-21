// Enrutador principal (equivalente al Stack de Expo Router en salon_app).
// Rutas por hash: #/agenda, #/cita/nueva, #/clientes/3, etc.

import { $, esperar, soltar } from "./util.js?v=52";
import {
  haySesion, esAdmin, esSuperadmin, usuario, cerrarSesion, restaurarSesion,
} from "./auth.js?v=50";
import { icono } from "./iconos.js?v=64";
import { cerrarCuenta, marcarMenuInferior, pintarMenuInferior } from "./menu-inferior.js?v=55";

import { render as vistaLogin } from "./vistas/login.js?v=61";
import { render as vistaAgenda } from "./vistas/agenda.js?v=61";
import { render as vistaCitaNueva } from "./vistas/cita-nueva.js?v=51";
import { render as vistaCitaDetalle } from "./vistas/cita-detalle.js?v=64";
import { render as vistaClientes } from "./vistas/clientes.js?v=49";
import { render as vistaClienteFicha } from "./vistas/cliente-ficha.js?v=61";
import { render as vistaServicios } from "./vistas/servicios.js?v=63";
import { render as vistaServicioForm } from "./vistas/servicio-form.js?v=52";
import { render as vistaProductos } from "./vistas/productos.js?v=69";
import { render as vistaProductoForm } from "./vistas/producto-form.js?v=68";
import { render as vistaEmpleadas } from "./vistas/empleadas.js?v=55";
import { render as vistaEmpleadaForm } from "./vistas/empleada-form.js?v=52";
import { render as vistaGanancias } from "./vistas/ganancias.js?v=69";
import { render as vistaEstadisticas } from "./vistas/estadisticas.js?v=56";
import { render as vistaUsuarios } from "./vistas/usuarios.js?v=53";
import { render as vistaUsuarioForm } from "./vistas/usuario-form.js?v=53";
import { render as vistaPanel } from "./vistas/panel.js?v=7";
import { render as vistaNotificaciones } from "./vistas/notificaciones.js?v=58";

const RUTAS = [
  { patron: /^\/login$/, vista: vistaLogin, publica: true, sinCabecera: true },
  // "/" y "/agenda" son la misma pantalla (la principal).
  { patron: /^\/(agenda)?$/, vista: vistaAgenda },
  // Agendar y archivar citas es exclusivo de las administradoras.
  { patron: /^\/cita\/nueva$/, vista: vistaCitaNueva, soloAdmin: true },
  { patron: /^\/cita\/(\d+)$/, vista: vistaCitaDetalle, params: ["id"] },
  { patron: /^\/notificaciones$/, vista: vistaNotificaciones },
  { patron: /^\/clientes$/, vista: vistaClientes },
  { patron: /^\/clientes\/nueva$/, vista: vistaClienteFicha, modo: "nueva" },
  { patron: /^\/clientes\/(\d+)$/, vista: vistaClienteFicha, params: ["id"] },
  { patron: /^\/servicios$/, vista: vistaServicios, soloAdmin: true },
  { patron: /^\/servicios\/nuevo$/, vista: vistaServicioForm, soloAdmin: true, modo: "nuevo" },
  { patron: /^\/servicios\/(\d+)$/, vista: vistaServicioForm, soloAdmin: true, params: ["id"] },
  { patron: /^\/productos$/, vista: vistaProductos, soloAdmin: true },
  { patron: /^\/productos\/nuevo$/, vista: vistaProductoForm, soloAdmin: true, modo: "nuevo" },
  { patron: /^\/productos\/(\d+)$/, vista: vistaProductoForm, soloAdmin: true, params: ["id"] },
  { patron: /^\/empleadas$/, vista: vistaEmpleadas, soloAdmin: true },
  { patron: /^\/empleadas\/nueva$/, vista: vistaEmpleadaForm, soloAdmin: true, modo: "nueva" },
  { patron: /^\/empleadas\/(\d+)$/, vista: vistaEmpleadaForm, soloAdmin: true, params: ["id"] },
  { patron: /^\/ganancias$/, vista: vistaGanancias, soloAdmin: true },
  { patron: /^\/estadisticas$/, vista: vistaEstadisticas, soloAdmin: true },
  { patron: /^\/panel$/, vista: vistaPanel, soloSuperadmin: true },
  { patron: /^\/usuarios$/, vista: vistaUsuarios, soloSuperadmin: true },
  { patron: /^\/usuarios\/nuevo$/, vista: vistaUsuarioForm, soloSuperadmin: true, modo: "nuevo" },
  { patron: /^\/usuarios\/(\d+)$/, vista: vistaUsuarioForm, soloSuperadmin: true, params: ["id"] },
];

function pintarNav() {
  const chips = [
    { hash: "#/agenda", texto: "Agenda", ico: icono.calendario() },
    { hash: "#/clientes", texto: "Clientas", ico: icono.personas() },
    { hash: "#/servicios", texto: "Servicios", admin: true, ico: icono.etiqueta() },
    { hash: "#/productos", texto: "Productos", admin: true, ico: icono.caja() },
    { hash: "#/empleadas", texto: "Empleadas", admin: true, ico: icono.usuario() },
    { hash: "#/ganancias", texto: "Ganancias", admin: true, ico: icono.grafico() },
    { hash: "#/estadisticas", texto: "Estadísticas", admin: true, ico: icono.estadisticas() },
    { hash: "#/panel", texto: "Panel de control", superadmin: true, ico: icono.escudo() },
  ].filter((c) => (!c.admin || esAdmin()) && (!c.superadmin || esSuperadmin()));

  $("#nav-chips").innerHTML = chips
    .map((c) => `<a class="chip" href="${c.hash}">${c.ico}${c.texto}</a>`)
    .join("");
  $("#usuario-nombre").textContent = usuario?.nombre || "";
}

function marcarChipActiva(ruta) {
  const primera = ruta.split("/").filter(Boolean)[0] || "agenda";
  document.querySelectorAll("#nav-chips .chip").forEach((chip) => {
    const destino = chip.getAttribute("href").replace("#/", "").split("/")[0];
    chip.classList.toggle("activo",
      destino === primera || (primera === "cita" && destino === "agenda"));
  });
}

async function navegar() {
  cerrarCuenta();
  const hash = location.hash.replace(/^#/, "") || "/";
  const [ruta, query] = hash.split("?");
  const parametrosQuery = new URLSearchParams(query || "");

  if (!haySesion() && ruta !== "/login") {
    location.hash = "#/login";
    return;
  }
  if (haySesion() && ruta === "/login") {
    location.hash = "#/agenda";
    return;
  }

  let coincidencia = null;
  let grupos = [];
  for (const r of RUTAS) {
    const m = ruta.match(r.patron);
    if (m) { coincidencia = r; grupos = m.slice(1); break; }
  }

  // ¡Booleano estricto! classList.toggle con `undefined` hace toggle simple
  // y añadía "oculto" en cada navegación con el header ya visible.
  const ocultarCabecera = coincidencia === null || coincidencia.sinCabecera === true;
  $("#cabecera").classList.toggle("oculto", ocultarCabecera);
  // En el login no hay cabecera ni menú inferior: se libera el espacio que ocupan.
  document.body.classList.toggle("en-login", coincidencia?.sinCabecera === true);

  if (!coincidencia) {
    location.hash = haySesion() ? "#/agenda" : "#/login";
    return;
  }

  // Menú inferior: visible en todas las pantallas con sesión, oculto en login.
  $("#menu-inferior").classList.toggle(
    "oculto",
    !haySesion() || coincidencia.sinCabecera === true
  );
  pintarNav();
  pintarMenuInferior();
  marcarChipActiva(ruta);
  marcarMenuInferior(ruta);

  if (coincidencia.soloAdmin && !esAdmin()) {
    $("#app").innerHTML = `
      <div class="tarjeta"><p style="color:var(--muted)">
        Esta sección es solo para administradoras.
      </p></div>`;
    marcarChipActiva(ruta);
    return;
  }

  if (coincidencia.soloSuperadmin && !esSuperadmin()) {
    $("#app").innerHTML = `
      <div class="tarjeta"><p style="color:var(--muted)">
        Esta sección es solo para el superadministrador.
      </p></div>`;
    marcarChipActiva(ruta);
    return;
  }

  const params = {};
  (coincidencia.params || []).forEach((nombre, i) => { params[nombre] = grupos[i]; });
  if (coincidencia.modo) params.modo = coincidencia.modo;

  $("#app").innerHTML = "";
  esperar("Cargando…");
  try {
    await coincidencia.vista($("#app"), params, parametrosQuery);
  } catch (e) {
    $("#app").innerHTML = `
      <div class="tarjeta">
        <p class="error-txt">${e.message || "Ocurrió un error."}</p>
        <div class="fila-btns"><a class="btn btn-contorno" href="#/agenda">Volver a la agenda</a></div>
      </div>`;
  } finally {
    soltar();
  }
}

async function arrancar() {
  window.addEventListener("hashchange", navegar);

  // Salir desde la cabecera (además de la hoja de cuenta del menú inferior).
  $("#btn-salir").innerHTML = `${icono.salida()}<span>Salir</span>`;
  $("#btn-salir").onclick = () => {
    cerrarSesion();
    location.hash = "#/login";
  };

  // Recupera el usuario (rol, nombre) para pintar el menú completo al recargar.
  await restaurarSesion();
  navegar();
}

arrancar();
