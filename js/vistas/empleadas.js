// Gestión de empleadas (solo admin). Equivalente a src/app/empleadas/index.tsx.

import { get } from "../api.js?v=48";
import { $, escapeHtml, diasTxt } from "../util.js?v=52";
import { icono } from "../iconos.js?v=64";

export async function render(raiz) {
  const empleadas = await get("/empleados");
  let mostrarInactivas = false;
  let textoBusqueda = "";

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${icono.usuario(22)}</span>
      <h1 class="vista-titulo">Empleadas</h1>
      <a class="chip-enlace" href="#/empleadas/nueva">＋ Nueva</a>
    </div>
    <div class="buscador-fila">
      <div class="campo-ico" style="flex:1">
        ${icono.lupa()}
        <input class="input" id="buscar" placeholder="Buscar por nombre o teléfono" />
      </div>
    </div>
    <div class="chips">
      <button class="chip" id="chip-inactivas" type="button">Mostrar inactivas</button>
      <span class="contador" id="contador"></span>
    </div>
    <div id="lista"></div>`;

  $("#chip-inactivas").onclick = () => {
    mostrarInactivas = !mostrarInactivas;
    $("#chip-inactivas").classList.toggle("activo", mostrarInactivas);
    pintar();
  };

  $("#buscar").addEventListener("input", (e) => {
    textoBusqueda = e.target.value.trim().toLowerCase();
    pintar();
  });

  function pintar() {
    const visibles = empleadas.filter((e) => {
      if (!mostrarInactivas && !e.activo) return false;
      if (!textoBusqueda) return true;
      const t = e.nombre.toLowerCase() + " " + (e.telefono || "").toLowerCase();
      return t.includes(textoBusqueda);
    });
    $("#contador").textContent = `${visibles.length} empleadas`;

    if (!visibles.length) {
      $("#lista").innerHTML = `<div class="vacio">Sin resultados.</div>`;
      return;
    }

    $("#lista").innerHTML = visibles.map((e) => {
      const total = (e.servicio_ids || []).length;
      const avatar = e.foto
        ? `<span class="empleada-avatar"><img src="${escapeHtml(e.foto)}" alt="" /></span>`
        : `<span class="empleada-avatar">${escapeHtml((e.nombre || "?").trim().charAt(0).toUpperCase())}</span>`;
      return `
      <a class="lista-fila empleada-fila ${e.activo ? "" : "opaca"}" href="#/empleadas/${e.id}">
        ${avatar}
        <span class="empleada-datos">
          <span class="empleada-nombre">
            <span>${escapeHtml(e.nombre)}</span>
            ${!e.activo ? `<span class="badge badge-gris">Inactiva</span>` : ""}
          </span>
          <span class="empleada-dato">
            ${icono.telefono(13)}${escapeHtml(e.telefono || "Sin teléfono")}
          </span>
          <span class="empleada-dato">
            ${icono.reloj(13)}${diasTxt(e.horarios)}
          </span>
        </span>
        <span class="empleada-servicios">
          <span class="empleada-servicios-num">${icono.etiqueta(15)}${total}</span>
          <span class="empleada-servicios-txt">${total === 1 ? "servicio" : "servicios"}</span>
        </span>
      </a>`;
    }).join("");
  }

  pintar();
}
