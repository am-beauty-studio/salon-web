// Agenda: pantalla principal. Equivalente a src/app/index.tsx.

import { get, patch } from "../api.js?v=48";
import {
  $, $$, aviso, confirmar, escapeHtml, aISO, sumarDias, etiqueta,
  esHoy, hora, usd, textoSubtipo, badgeCita, nombreCorto, esReprogramada,
} from "../util.js?v=52";
import { esAdmin } from "../auth.js?v=50";
import { icono } from "../iconos.js?v=64";
import { abrirCalendario } from "./componentes.js?v=49";

export async function render(raiz) {
  let fecha = new Date();
  let empleadoId = null;
  let empleados = [];
  let citas = [];

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${icono.calendario(22)}</span>
      <h1 class="vista-titulo">Agenda</h1>
    </div>
    <div class="nav-fecha nav-fecha-marco">
      <button class="nav-flecha" id="f-prev" type="button" aria-label="Día anterior">‹</button>
      <button class="nav-fecha-titulo" id="f-elegir" type="button" aria-label="Elegir otro día en el calendario">
        <span class="nav-fecha-linea">${icono.calendario(14)}<span id="f-titulo"></span></span>
        <span class="nav-sub" id="f-sub"></span>
      </button>
      <button class="nav-flecha" id="f-next" type="button" aria-label="Día siguiente">›</button>
    </div>
    <div class="chips" id="chips-empleadas"></div>
    <div class="resumen-dia" id="resumen"></div>
    <div id="lista-citas"></div>`;

  $("#f-prev").onclick = () => { fecha = sumarDias(fecha, -1); cargarCitas(); };
  $("#f-next").onclick = () => { fecha = sumarDias(fecha, 1); cargarCitas(); };
  $("#f-elegir").onclick = () => {
    abrirCalendario({
      fecha,
      consultaDias: async (desde, hasta) => {
        const q = new URLSearchParams({ desde, hasta });
        if (empleadoId != null) q.set("empleado_id", String(empleadoId));
        const dias = await get(`/citas/dias-programados?${q.toString()}`);
        return new Set(dias);
      },
      onElegir: (nueva) => { fecha = nueva; cargarCitas(); },
    });
  };

  async function cargarEmpleadas() {
    empleados = await get("/empleados?solo_activos=true");
    // Si la usuaria ya navegó a otra vista, los nodos ya no existen.
    if (!$("#chips-empleadas")?.isConnected) return;
    pintarChipsEmpleadas();
  }

  function pintarChipsEmpleadas() {
    const chips = [{ id: null, nombre: "Todas" }, ...empleados];
    $("#chips-empleadas").innerHTML = chips
      .map((emp) => `
        <button class="chip chip-persona ${empleadoId === emp.id ? "activo" : ""}" data-id="${emp.id ?? ""}" type="button">
          ${emp.id === null ? icono.personas(15) : icono.usuario(15)}
          ${escapeHtml(nombreCorto(emp.nombre))}
        </button>`)
      .join("");
    $$("#chips-empleadas .chip").forEach((chip) => {
      chip.onclick = () => {
        const valor = chip.dataset.id;
        empleadoId = valor === "" ? null : Number(valor);
        pintarChipsEmpleadas();
        cargarCitas();
      };
    });
  }

  async function cargarCitas() {
    // Navegación en mitad de la carga: la vista ya no está montada.
    if (!$("#lista-citas")?.isConnected) return;
    const iso = aISO(fecha);
    $("#f-titulo").textContent = etiqueta(fecha);
    $("#f-sub").textContent = esHoy(fecha)
      ? "Hoy · toca para elegir otro día"
      : "Toca para elegir otro día";
    $("#f-prev").disabled = false;

    try {
      citas = await get(`/citas?fecha=${iso}`);
    } catch (e) {
      // Si mientras tanto cambió el día o la vista, esta respuesta ya no vale.
      if (aISO(fecha) === iso && $("#lista-citas")?.isConnected) {
        $("#lista-citas").innerHTML = `<p class="error-txt">${escapeHtml(e.message)}</p>`;
      }
      return;
    }
    // Evita que una respuesta lenta de un día anterior pise el día actual.
    if (aISO(fecha) !== iso || !$("#lista-citas")?.isConnected) return;
    pintarCitas();
  }

  function pintarCitas() {
    const visibles = empleadoId == null ? citas : citas.filter((c) => c.empleado_id === empleadoId);
    const activas = visibles.filter((c) => c.estado !== "cancelada");
    const total = activas.reduce((s, c) => s + Number(c.precio_total), 0);
    $("#resumen").innerHTML = `
      <div class="resumen-tarjeta">
        <span class="resumen-ico">${icono.calendario(18)}</span>
        <span class="resumen-datos">
          <span class="resumen-etiqueta">${activas.length === 1 ? "Cita" : "Citas"}</span>
          <span class="resumen-valor">${activas.length}</span>
        </span>
      </div>
      <div class="resumen-tarjeta destacada">
        <span class="resumen-ico">${icono.dolar(18)}</span>
        <span class="resumen-datos">
          <span class="resumen-etiqueta">Total del día</span>
          <span class="resumen-valor">${usd(total)}<small>USD</small></span>
        </span>
      </div>`;

    if (!visibles.length) {
      $("#lista-citas").innerHTML = `<div class="vacio">No hay citas para este día.</div>`;
      return;
    }

    $("#lista-citas").innerHTML = visibles.map((c) => tarjetaCita(c)).join("");

    $$("#lista-citas .cita-card").forEach((card) => {
      const cita = visibles.find((x) => String(x.id) === card.dataset.id);
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        location.hash = `#/cita/${cita.id}`;
      });
      card.querySelector("[data-accion='completar']")?.addEventListener("click", async () => {
        if (await confirmar("Completar cita",
          `${cita.cliente_nombre} · ${hora(cita.inicio)}`, "Sí, completar")) {
          await hacer(patch(`/citas/${cita.id}/completar`), "Cita completada");
        }
      });
      card.querySelector("[data-accion='cancelar']")?.addEventListener("click", async () => {
        if (await confirmar("Cancelar cita",
          `${cita.cliente_nombre} · ${hora(cita.inicio)}`, "Sí, cancelar")) {
          await hacer(patch(`/citas/${cita.id}/cancelar`), "Cita cancelada");
        }
      });
    });
  }

  async function hacer(peticion, mensajeOk) {
    try {
      await peticion;
      aviso(mensajeOk, "ok");
      await cargarCitas();
    } catch (e) {
      aviso(e.message || "No se pudo actualizar la cita.", "error");
    }
  }

  await cargarEmpleadas();
  await cargarCitas();
}

export function tarjetaCita(c) {
  const servicioTxt = c.servicio_nombre || "";
  const subtipoTxt = textoSubtipo(c.subtipo);
  const adicionales = c.adicionales || [];
  return `
    <div class="cita-card ${c.estado === "cancelada" ? "cancelada" : ""}" data-id="${c.id}">
      <div class="cita-cab">
        <span class="cita-hora">${icono.reloj(15)}${hora(c.inicio)} – ${hora(c.fin)}</span>
        <span class="cita-etiquetas">
          ${c.archivada ? `<span class="badge badge-dorado">Archivada</span>` : c.grupo_id ? `<span class="badge badge-dorado">Enlazada</span>` : ""}
          ${c.estado === "programada" && (c.reprogramada || esReprogramada(c.id))
            ? `<span class="badge badge-reprogramada">Reprogramada</span>`
            : badgeCita(c)}
        </span>
      </div>
      <div class="cita-principal">
        <span class="cita-cliente">${icono.personas(16)}${escapeHtml(c.cliente_nombre)}</span>
        <span class="cita-precio">${usd(c.precio_total)}<small>USD</small></span>
      </div>
      <div class="cita-info">
        <span class="cita-linea">${icono.etiqueta(14)}<span>${escapeHtml(servicioTxt)}</span></span>
        ${subtipoTxt ? `<span class="cita-linea cita-subtipo">${icono.capas(14)}<span>${escapeHtml(subtipoTxt)}</span></span>` : ""}
        ${adicionales.length ? `<span class="cita-linea cita-adicional">${icono.mas(14)}<span>${escapeHtml(adicionales.join(", "))}</span></span>` : ""}
        <span class="cita-linea">${icono.usuario(14)}<span>Con ${escapeHtml(c.empleado_nombre)}</span></span>
      </div>
      ${c.notas ? `<div class="cita-nota">“${escapeHtml(c.notas)}”</div>` : ""}
      ${c.estado === "programada" && esAdmin() ? `
        <div class="cita-btns">
          <button class="btn btn-completar" data-accion="completar" type="button">${icono.check(14)}Completar</button>
          <button class="btn btn-cancelar" data-accion="cancelar" type="button">${icono.equis(14)}Cancelar</button>
        </div>` : ""}
    </div>`;
}
