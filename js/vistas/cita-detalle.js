// Detalle de cita: ver, cambiar subtipo, reprogramar, completar o cancelar.
// Equivalente a src/app/cita/[id].tsx.

import { get, patch } from "../api.js?v=48";
import {
  $, $$, aviso, confirmar, desdeISO, escapeHtml, etiqueta, hora, usd,
  badgeCita, textoSubtipo, marcarReprogramadas, nombreCorto, esReprogramada,
} from "../util.js?v=52";
import { esAdmin } from "../auth.js?v=50";
import { icono } from "../iconos.js?v=64";
import { crearSelectorDia, crearHorarios, consultaDisponibilidad } from "./componentes.js?v=49";
import { mostrarExitoReprogramar } from "../modal-exito.js?v=49";

export async function render(raiz, params) {
  let cita = await get(`/citas/${params.id}`);
  let grupo = null;
  if (cita.grupo_id) {
    try {
      grupo = await get(`/citas?grupo_id=${encodeURIComponent(cita.grupo_id)}`);
    } catch { /* seguimos sin la reserva */ }
  }
  let servicio = null;
  let empleados = [];
  try {
    [servicio, empleados] = await Promise.all([
      get(`/servicios/${cita.servicio_id}`),
      get("/empleados?solo_activos=true"),
    ]);
  } catch { /* seguimos sin ellos */ }

  let reprogramando = false;
  let empleadoNuevo = cita.empleado_id;
  let opcionesAdicionales = null;
  let seleccionAdicional = new Set();
  let tokenAdicionales = 0;
  let mostrandoAdicionales = false;
  let fecha = new Date(
    Number(cita.inicio.slice(0, 4)),
    Number(cita.inicio.slice(5, 7)) - 1,
    Number(cita.inicio.slice(8, 10))
  );
  let slot = null;
  // El rol `usuario` solo puede consultar la cita: sin reprogramar, completar,
  // cancelar ni sumar servicios adicionales.
  const puedeEditar = esAdmin();

  function specialistsAptas() {
    if (!servicio) return [];
    const necesarios = new Set([servicio.id, ...(cita.adicional_ids || [])]);
    return empleados.filter((emp) =>
      [...necesarios].every((id) => (emp.servicio_ids || []).includes(id))
    );
  }

  function pintar() {
    const extras = (cita.adicionales || []).join(", ");
    const subtipoTxt = textoSubtipo(cita.subtipo);
    const aptas = specialistsAptas();
    const reprogCita = cita.estado === "programada" && (cita.reprogramada || esReprogramada(cita.id));

    raiz.innerHTML = `
      <div class="vista-cab">
        <span class="vista-ico">${icono.calendario(22)}</span>
        <h1 class="vista-titulo">Cita</h1>
      </div>

      <div class="cita-card cita-detalle">
        <div class="cita-cab">
          <span class="cita-hora">${icono.reloj(15)}${hora(cita.inicio)} – ${hora(cita.fin)}</span>
          <span class="cita-etiquetas">
            ${cita.archivada ? `<span class="badge badge-dorado">Archivada</span>` : cita.grupo_id ? `<span class="badge badge-dorado">Enlazada</span>` : ""}
            ${reprogCita
              ? `<span class="badge badge-reprogramada">Reprogramada</span>`
              : badgeCita(cita)}
          </span>
        </div>
        <div class="cita-principal">
          <a class="cita-cliente" href="#/clientes/${cita.cliente_id}">${icono.personas(16)}${escapeHtml(cita.cliente_nombre)}</a>
          <span class="cita-precio">${usd(cita.precio_total)}<small>USD</small></span>
        </div>
        <div class="cita-info">
          <span class="cita-linea">${icono.calendario(14)}<span>${escapeHtml(etiqueta(fecha))}</span></span>
          <span class="cita-linea">${icono.etiqueta(14)}<span>${escapeHtml(cita.servicio_nombre)}</span></span>
          ${subtipoTxt ? `<span class="cita-linea cita-subtipo">${icono.capas(14)}<span>${escapeHtml(subtipoTxt)}</span></span>` : ""}
          ${extras ? `<span class="cita-linea cita-adicional">${icono.mas(14)}<span>${escapeHtml(extras)}</span></span>` : ""}
          <span class="cita-linea">${icono.usuario(14)}<span>Con ${escapeHtml(cita.empleado_nombre)}</span></span>
          ${cita.estado === "programada" && puedeEditar ? `
            <div class="adicional-accion">
              <button class="btn-adicional" id="btn-adicionales" type="button" aria-label="Gestionar servicios adicionales" aria-expanded="${mostrandoAdicionales}" title="${mostrandoAdicionales ? "Ocultar adicionales" : "Agregar o quitar servicios adicionales"}">
                ${mostrandoAdicionales ? icono.equis(13) : icono.seleccion(13)}<span>${mostrandoAdicionales ? "Cerrar" : "Adicional"}</span>
              </button>
            </div>` : ""}
        </div>
        ${cita.notas ? `<div class="cita-nota">“${escapeHtml(cita.notas)}”</div>` : ""}
      </div>

      ${grupo && grupo.length > 1 ? `
        <div class="paso-titulo detalle-paso">${cita.archivada ? "Reserva archivada" : "Reserva enlazada"} (${grupo.length} servicios)</div>
        <div class="reserva-lista">
          ${grupo.map((g) => `
            <a class="reserva-item ${g.id === cita.id ? "propia" : ""}" href="#/cita/${g.id}">
              <span class="reserva-hora">${icono.reloj(14)}${hora(g.inicio)}</span>
              <span class="reserva-datos">
                <span class="reserva-servicio">${escapeHtml(g.servicio_nombre)}${textoSubtipo(g.subtipo) ? ` · ${escapeHtml(textoSubtipo(g.subtipo))}` : ""}</span>
                <span class="reserva-sub">${escapeHtml(g.empleado_nombre)}</span>
              </span>
              ${g.id === cita.id ? `<span class="reserva-aqui">Esta</span>` : badgeCita(g)}
            </a>`).join("")}
        </div>
        ${puedeEditar && grupo.some((g) => g.estado === "programada") ? `
          <div class="fila-btns">
            <button class="btn btn-suave-ok" id="btn-completar-reserva" type="button">${icono.check(15)}Completar reserva</button>
            <button class="btn btn-suave-peligro" id="btn-cancelar-reserva" type="button">${icono.equis(15)}Cancelar reserva</button>
          </div>` : ""}` : ""}

      ${cita.estado === "programada" && puedeEditar && servicio?.subtipos?.length ? `
        <div class="paso-titulo detalle-paso">${servicio.categoria === "Pestañas" ? "Tipo de pestaña" : servicio.categoria === "Cejas" ? "Color de tinte" : "Tipo"}</div>
        <div class="radio-fila">
          ${servicio.subtipos.map((t) => `
            <button type="button" class="radio-op ${cita.subtipo === t ? "activo" : ""}" data-subtipo="${escapeHtml(t)}">
              ${escapeHtml(t.length === 1 ? `Tipo ${t}` : t)}
            </button>`).join("")}
        </div>` : ""}

      <div id="zona-adicionales"></div>

      <div class="fila-btns detalle-ficha">
        <a class="btn btn-suave btn-bloque" href="#/clientes/${cita.cliente_id}">${icono.personas(15)}Ver ficha de la clienta</a>
      </div>

      ${cita.estado === "programada" && puedeEditar ? `
        <div class="detalle-acciones">
          <button class="btn btn-suave-dorado btn-bloque" id="btn-reprogramar" type="button">${icono.repetir(15)}Reprogramar día u hora</button>
          <div class="fila-btns">
            <button class="btn btn-suave-ok" id="btn-completar" type="button">${icono.check(15)}Completar cita</button>
            <button class="btn btn-suave-peligro" id="btn-cancelar" type="button">${icono.equis(15)}Cancelar cita</button>
          </div>
        </div>` : ""}

      <div id="zona-reprogramar"></div>`;

    // Cambiar subtipo al instante
    $$(".radio-op", raiz).forEach((boton) => {
      boton.onclick = async () => {
        const nuevo = boton.dataset.subtipo;
        if (nuevo === cita.subtipo) return;
        try {
          cita = await patch(`/citas/${cita.id}`, { subtipo: nuevo });
          aviso("Tipo actualizado", "ok");
          pintar();
        } catch (e) {
          aviso(e.message || "No se pudo cambiar el tipo.", "error");
        }
      };
    });

    // Acciones sobre TODA la reserva enlazada
    if (puedeEditar && grupo?.some((g) => g.estado === "programada")) {
      const pendientes = grupo.filter((g) => g.estado === "programada").length;
      $("#btn-completar-reserva").onclick = async () => {
        if (!(await confirmar("Completar reserva",
          `Se completarán las ${pendientes} cita${pendientes === 1 ? "" : "s"} programadas de ${cita.cliente_nombre}.`,
          "Sí, completar todo"))) return;
        try {
          grupo = await patch(`/citas/grupo/${cita.grupo_id}/completar`);
          cita = grupo.find((g) => g.id === cita.id) || cita;
          aviso("Reserva completada", "ok");
          pintar();
        } catch (e) { aviso(e.message, "error"); }
      };
      $("#btn-cancelar-reserva").onclick = async () => {
        if (!(await confirmar("Cancelar reserva",
          `Se cancelarán las ${pendientes} cita${pendientes === 1 ? "" : "s"} programadas de ${cita.cliente_nombre}.`,
          "Sí, cancelar todo"))) return;
        try {
          grupo = await patch(`/citas/grupo/${cita.grupo_id}/cancelar`);
          cita = grupo.find((g) => g.id === cita.id) || cita;
          aviso("Reserva cancelada", "ok");
          pintar();
        } catch (e) { aviso(e.message, "error"); }
      };
    }

    const btnAdicionales = $("#btn-adicionales");
    if (btnAdicionales) {
      btnAdicionales.onclick = () => {
        mostrandoAdicionales = !mostrandoAdicionales;
        reprogramando = false;
        if (!mostrandoAdicionales) {
          opcionesAdicionales = null;
          seleccionAdicional = new Set();
        }
        pintar();
      };
    }

    if (puedeEditar && cita.estado === "programada") {
      $("#btn-completar").onclick = async () => {
        if (await confirmar("Completar cita",
          `${cita.cliente_nombre} · ${hora(cita.inicio)}`, "Sí, completar")) {
          try {
            await patch(`/citas/${cita.id}/completar`);
            aviso("Cita completada", "ok");
            location.hash = "#/agenda";
          } catch (e) { aviso(e.message, "error"); }
        }
      };
      $("#btn-cancelar").onclick = async () => {
        if (await confirmar("Cancelar cita",
          `${cita.cliente_nombre} · ${hora(cita.inicio)}`, "Sí, cancelar")) {
          try {
            await patch(`/citas/${cita.id}/cancelar`);
            aviso("Cita cancelada", "ok");
            location.hash = "#/agenda";
          } catch (e) { aviso(e.message, "error"); }
        }
      };
      $("#btn-reprogramar").onclick = () => {
        reprogramando = !reprogramando;
        mostrandoAdicionales = false;
        opcionesAdicionales = null;
        seleccionAdicional = new Set();
        pintar();
      };
      if (reprogramando) pintarReprogramar(aptas);
    }

    if (puedeEditar && mostrandoAdicionales && cita.estado === "programada") cargarAdicionales();
    else {
      const zona = $("#zona-adicionales");
      if (zona) zona.innerHTML = "";
    }
  }

  async function cargarAdicionales() {
    const zona = $("#zona-adicionales");
    if (!zona) return;
    const token = ++tokenAdicionales;
    try {
      const datos = await get(`/citas/${cita.id}/adicionales`);
      if (token !== tokenAdicionales) return;
      opcionesAdicionales = datos;
      seleccionAdicional = new Set(
        datos.opciones.filter((o) => o.seleccionado).map((o) => o.servicio_id)
      );
      pintarAdicionales();
    } catch (e) {
      if (token === tokenAdicionales) {
        zona.innerHTML = `<div class="vacio">${escapeHtml(e.message || "No se pudieron cargar los adicionales.")}</div>`;
      }
    }
  }

  function cerrarAdicionales() {
    mostrandoAdicionales = false;
    opcionesAdicionales = null;
    seleccionAdicional = new Set();
    pintar();
  }

  function pintarAdicionales() {
    const zona = $("#zona-adicionales");
    if (!zona || !opcionesAdicionales) return;
    const datos = opcionesAdicionales;

    if (!datos.opciones.length) {
      zona.innerHTML = `
        <div class="tarjeta detalle-adicionales">
          <div class="paso-titulo" style="margin-top:0">Agregar servicios adicionales</div>
          <p class="detalle-ayuda">No hay servicios adicionales disponibles para esta cita.</p>
          <div class="fila-btns">
            <button class="btn btn-suave" id="btn-cerrar-adicionales" type="button">Cerrar</button>
          </div>
        </div>`;
      $("#btn-cerrar-adicionales").onclick = cerrarAdicionales;
      return;
    }

    const iniciales = new Set(
      datos.opciones.filter((o) => o.seleccionado).map((o) => o.servicio_id)
    );
    const duracion = new Map(
      datos.opciones.map((o) => [o.servicio_id, o.duracion_min])
    );
    let minutos = datos.duracion_actual_min;
    for (const id of seleccionAdicional) {
      if (!iniciales.has(id)) minutos += duracion.get(id) || 0;
    }
    for (const id of iniciales) {
      if (!seleccionAdicional.has(id)) minutos -= duracion.get(id) || 0;
    }
    const cambiado =
      seleccionAdicional.size !== iniciales.size ||
      [...seleccionAdicional].some((id) => !iniciales.has(id));

    zona.innerHTML = `
      <div class="tarjeta detalle-adicionales">
        <div class="paso-titulo" style="margin-top:0">Agregar servicios adicionales</div>
        <p class="detalle-ayuda">Marca los que quepan en el horario. Los que no caben aparecen bloqueados.</p>
        <div class="adicionales-lista">
          ${datos.opciones.map((o) => {
            const activo = seleccionAdicional.has(o.servicio_id);
            const cabe = activo || minutos + o.duracion_min <= datos.duracion_max_min;
            return `
              <label class="adicional-op ${activo ? "activo" : ""} ${cabe ? "" : "no-cabe"}" title="${cabe ? "" : "No hay tiempo suficiente antes de la próxima cita o del cierre"}">
                <input type="checkbox" data-id="${o.servicio_id}" ${activo ? "checked" : ""} ${cabe ? "" : "disabled"}>
                <span class="adicional-datos">
                  <span class="adicional-nombre">${escapeHtml(o.nombre)}</span>
                  <span class="adicional-meta">+${o.duracion_min} min · ${usd(o.precio)}</span>
                </span>
                ${cabe ? "" : `<span class="adicional-no">No hay tiempo</span>`}
              </label>`;
          }).join("")}
        </div>
        <div class="fila-btns">
          <button class="btn btn-suave" id="btn-cerrar-adicionales" type="button">Cancelar</button>
          <button class="btn btn-dorado" id="btn-guardar-adicionales" type="button" ${cambiado ? "" : "disabled"}>
            Guardar
          </button>
        </div>
      </div>`;

    $("#btn-cerrar-adicionales").onclick = cerrarAdicionales;

    $$("#zona-adicionales input[data-id]").forEach((caja) => {
      caja.onchange = () => {
        const id = Number(caja.dataset.id);
        if (caja.checked) seleccionAdicional.add(id);
        else seleccionAdicional.delete(id);
        pintarAdicionales();
      };
    });

    $("#btn-guardar-adicionales").onclick = async () => {
      const ids = datos.opciones
        .filter((o) => seleccionAdicional.has(o.servicio_id))
        .map((o) => o.servicio_id);
      try {
        cita = await patch(`/citas/${cita.id}`, { adicional_ids: ids });
        mostrandoAdicionales = false;
        opcionesAdicionales = null;
        seleccionAdicional = new Set();
        aviso("Servicios adicionales actualizados", "ok");
        pintar();
      } catch (e) {
        aviso(e.message || "No se pudieron guardar los adicionales.", "error");
        cargarAdicionales();
      }
    };
  }

  function pintarReprogramar(aptas) {
    const caja = $("#zona-reprogramar");
    if (!aptas.length) {
      caja.innerHTML = `<div class="vacio">Ninguna especialista realiza esta combinación de servicios.</div>`;
      return;
    }
    caja.innerHTML = `
      <div class="tarjeta detalle-reprogramar">
        <div class="paso-titulo" style="margin-top:0">Reprogramar cita</div>
        <p class="detalle-ayuda">Elige especialista, día y hora disponible.</p>
        <div class="paso-titulo">Especialista</div>
        <div class="chips" id="chips-repro">
          ${aptas.map((e) => `
            <button type="button" class="chip ${empleadoNuevo === e.id ? "activo" : ""}" data-id="${e.id}">
              ${escapeHtml(nombreCorto(e.nombre))}
            </button>`).join("")}
        </div>
        <div class="paso-titulo">Nuevo día y hora</div>
        <div id="sel-dia"></div>
        <div id="sel-hora" style="margin-top:6px"></div>
        <div class="fila-btns">
          <button class="btn btn-suave" id="btn-deshacer" type="button">Cancelar</button>
          <button class="btn btn-dorado" id="btn-confirmar" type="button" disabled>Confirmar horario</button>
        </div>
      </div>`;

    $$("#chips-repro .chip").forEach((chip) => {
      chip.onclick = () => {
        empleadoNuevo = Number(chip.dataset.id);
        slot = null;
        pintar();
        if (reprogramando) pintarReprogramar(aptas);
      };
    });

    const selectorDia = crearSelectorDia($("#sel-dia"), fecha, (nueva) => {
      fecha = nueva; slot = null;
      selectorDia.actualizar(nueva);
      cargarSlots();
    }, { noRetroceder: true });
    const horarios = crearHorarios($("#sel-hora"), "");
    async function cargarSlots() {
      await horarios.cargar(
        () => consultaDisponibilidad({
          empleadoId: empleadoNuevo, fecha, servicioId: cita.servicio_id,
          adicionalIds: cita.adicional_ids || [], excluirCitaId: cita.id,
        }),
        slot?.inicio ?? null,
        (elegido) => { slot = elegido; $("#btn-confirmar").disabled = !slot; }
      );
    }
    cargarSlots();

    $("#btn-deshacer").onclick = () => { reprogramando = false; pintar(); };
    $("#btn-confirmar").onclick = async () => {
      const antes = { inicio: cita.inicio, empleada: cita.empleado_nombre };
      try {
        cita = await patch(`/citas/${cita.id}`, { inicio: slot.inicio, empleado_id: empleadoNuevo });
        marcarReprogramadas([cita.id]);
        reprogramando = false; slot = null;
        pintar();
        await mostrarExitoReprogramar({
          cliente: cita.cliente_nombre,
          servicio: [cita.servicio_nombre, ...(cita.adicionales || [])].join(" · "),
          antes: {
            fecha: etiqueta(desdeISO(antes.inicio)),
            hora: hora(antes.inicio),
            empleada: antes.empleada,
          },
          ahora: {
            fecha: etiqueta(desdeISO(cita.inicio)),
            hora: hora(cita.inicio),
            empleada: cita.empleado_nombre,
          },
        });
      } catch (e) {
        aviso(e.message || "No se pudo reprogramar.", "error");
        cargarSlots();
      }
    };
  }

  pintar();
}
