// Listado de clientas. Equivalente a src/app/clientes/index.tsx.

import { get } from "../api.js?v=48";
import { $, escapeHtml } from "../util.js?v=52";
import { icono } from "../iconos.js?v=64";

export async function render(raiz) {
  let temporizador = null;

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${icono.personas(22)}</span>
      <h1 class="vista-titulo">Clientas</h1>
      <a class="chip-enlace" href="#/clientes/nueva">＋ Nueva</a>
    </div>
    <div class="buscador-fila">
      <div class="campo-ico" style="flex:1">
        ${icono.lupa()}
        <input class="input" id="buscar" placeholder="Buscar por nombre o teléfono" />
      </div>
    </div>
    <div id="lista"></div>`;

  async function cargar(texto = "") {
    const caja = $("#lista");
    const q = texto.trim();
    const lista = await get(`/clientes${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (!lista.length) {
      caja.innerHTML = `<div class="vacio">${q ? "Sin resultados." : "Aún no hay clientas registradas."}</div>`;
      return;
    }
    caja.innerHTML = agruparClientas(lista).map(([letra, clientas]) => `
      <section class="clientes-seccion">
        <div class="clientes-letra">
          <span>${escapeHtml(letra)}</span>
          <small>${clientas.length}</small>
        </div>
        ${clientas.map((c) => `
          <a class="lista-fila" href="#/clientes/${c.id}">
            <span class="lista-principal">
              <span class="ico-lista" style="display:inline-flex">${icono.usuario()}</span>${escapeHtml(c.nombre)}
            </span>
            <span class="lista-secundario">${escapeHtml(c.telefono || "Sin teléfono")}</span>
          </a>`).join("")}
      </section>`).join("");
  }

  $("#buscar").addEventListener("input", (e) => {
    clearTimeout(temporizador);
    const texto = e.target.value;
    temporizador = setTimeout(() => cargar(texto), 300);
  });

  await cargar();
}

/** Primera letra en mayúsculas, sin acentos; "#" si no empieza por letra. */
function letraDe(nombre) {
  const base = (nombre || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .charAt(0)
    .toUpperCase();
  return /^[A-Z]$/.test(base) ? base : "#";
}

/** Ordena alfabéticamente y agrupa en secciones A, B, C… (los demás al final). */
function agruparClientas(lista) {
  const orden = [...lista].sort((a, b) =>
    (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
  );
  const grupos = new Map();
  for (const c of orden) {
    const letra = letraDe(c.nombre);
    if (!grupos.has(letra)) grupos.set(letra, []);
    grupos.get(letra).push(c);
  }
  const secciones = [...grupos.entries()]
    .filter(([letra]) => letra !== "#")
    .sort(([a], [b]) => a.localeCompare(b));
  if (grupos.has("#")) secciones.push(["#", grupos.get("#")]);
  return secciones;
}
