// Detalle de cita: ver, editar servicio/horario, completar o cancelar.
// Equivalente a src/app/cita/[id].tsx.

import { get, patch } from "../api.js?v=49";
import {
  $, $$, aviso, confirmar, desdeISO, escapeHtml, etiqueta, hora, usd, importe,
  etiquetaMoneda, normalizarMoneda, convertirMoneda,
  badgeCita, textoSubtipo, marcarReprogramadas, nombreCorto, esReprogramada,
  combinables, compatible, duracionTxt, mostrarCategoria, normalizarClave,
} from "../util.js?v=54";
import { esAdmin } from "../auth.js?v=52";
import { icono, icoCategoria } from "../iconos.js?v=64";
import { crearSelectorDia, crearHorarios, consultaDisponibilidad } from "./componentes.js?v=52";
import { mostrarExitoReprogramar } from "../modal-exito.js?v=50";

export async function render(raiz, params, query) {
  // Día desde el que se abrió la cita. Se propaga en los enlaces internos para
  // que «Volver» regrese a la agenda exactamente al mismo día. Si se abre la
  // cita directamente, se usa la fecha de la propia cita como referencia.
  const fechaParam = query?.get("fecha");
  const fechaParamValida = /^\d{4}-\d{2}-\d{2}$/.test(fechaParam || "") ? fechaParam : "";

  let cita = await get(`/citas/${params.id}`);
  const fechaOrigen = fechaParamValida || String(cita.inicio || "").slice(0, 10);
  const sufijoFecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaOrigen)
    ? `?fecha=${encodeURIComponent(fechaOrigen)}`
    : "";
  const volver = sufijoFecha ? `#/agenda${sufijoFecha}` : "#/agenda";
  let grupo = null;
  if (cita.grupo_id) {
    try {
      grupo = await get(`/citas?grupo_id=${encodeURIComponent(cita.grupo_id)}`);
    } catch { /* seguimos sin la reserva */ }
  }
  let servicio = null;
  let empleados = [];
  let todosServicios = [];
  try {
    // El catálogo completo incluye el servicio de la cita (aunque esté dado
    // de baja), así que no hace falta pedirlo dos veces.
    [empleados, todosServicios] = await Promise.all([
      get("/empleados?solo_activos=true"),
      get("/servicios?solo_activos=false"),
    ]);
    servicio = todosServicios.find((s) => s.id === cita.servicio_id) || null;
  } catch { /* seguimos sin ellos */ }

  let reprogramando = false;
  let guardandoEdicion = false;
  let servicioNuevo = servicio;
  let subtipoNuevo = cita.subtipo;
  let adicionalesNuevos = new Set(cita.adicional_ids || []);
  let empleadoNuevo = cita.empleado_id;
  let fecha = desdeISO(cita.inicio);
  let slot = null;
  // Aviso bajo el horario cuando el tiempo elegido deja de ser posible.
  let notaHora = "";
  // Se descarta la respuesta de una comprobación de horario ya reemplazada.
  let solicitudHorarios = 0;
  let verificandoHorario = false;
  // El rol `usuario` solo puede consultar la cita: sin reprogramar, completar,
  // cancelar ni modificar sus servicios adicionales.
  const puedeEditar = esAdmin();

  // ---------- Catálogo permitido en la edición ----------
  // La categoría de la cita queda fijada: solo se ofrecen servicios
  // principales de esa misma categoría (y el actual, aunque esté inactivo).
  function serviciosDeCategoria() {
    const categoria = servicioNuevo?.categoria || servicio?.categoria || "";
    return todosServicios
      .filter((s) =>
        !s.es_adicional &&
        normalizarClave(s.categoria) === normalizarClave(categoria) &&
        (s.activo || s.id === cita.servicio_id || s.id === servicioNuevo?.id)
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  function adicionalesDisponibles(principal) {
    if (!principal) return [];
    return todosServicios
      .filter((s) =>
        s.es_adicional && compatible(principal, s) &&
        (s.activo || adicionalesNuevos.has(s.id))
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  function specialistsAptas(principal = servicio, extras = cita.adicional_ids || []) {
    if (!principal) return [];
    const necesarios = new Set([principal.id, ...extras]);
    return empleados.filter((emp) =>
      [...necesarios].every((id) => (emp.servicio_ids || []).includes(id))
    );
  }

  function nombreEmpleado(id) {
    return empleados.find((e) => e.id === id)?.nombre || "";
  }

  function pintar() {
    const extras = (cita.adicionales || []).join(", ");
    const subtipoTxt = textoSubtipo(cita.subtipo);
    const reprogCita = cita.estado === "programada" && (cita.reprogramada || esReprogramada(cita.id));

    raiz.innerHTML = `
      <div class="vista-cab">
        <span class="vista-ico">${icono.calendario(22)}</span>
        <h1 class="vista-titulo">Cita</h1>
        <a class="detalle-volver" href="${volver}" aria-label="Volver a la agenda"><span class="flecha" aria-hidden="true">←</span> Volver</a>
      </div>

      <div class="cita-card cita-detalle">
        <div class="cita-cab">
          <span class="cita-hora">${icono.reloj(15)}${hora(cita.inicio)}–${hora(cita.fin)}</span>
          <span class="cita-etiquetas">
            ${cita.archivada ? `<span class="badge badge-dorado">Archivada</span>` : cita.grupo_id ? `<span class="badge badge-dorado">Enlazada</span>` : ""}
            ${reprogCita
              ? `<span class="badge badge-reprogramada">Reprogramada</span>`
              : badgeCita(cita)}
          </span>
        </div>
        <div class="cita-principal">
          <a class="cita-cliente" href="#/clientes/${cita.cliente_id}">${icono.personas(16)}${escapeHtml(cita.cliente_nombre)}</a>
          <span class="cita-precio">${importe(cita.precio_total_moneda ?? cita.precio_total, cita.moneda)}<small>${etiquetaMoneda(cita.moneda)}</small></span>
        </div>
        <div class="cita-info">
          <span class="cita-linea">${icono.calendario(14)}<span>${escapeHtml(etiqueta(desdeISO(cita.inicio)))}</span></span>
          <span class="cita-linea">${icono.etiqueta(14)}<span>${escapeHtml(cita.servicio_nombre)}</span></span>
          ${subtipoTxt ? `<span class="cita-linea cita-subtipo">${icono.capas(14)}<span>${escapeHtml(subtipoTxt)}</span></span>` : ""}
          ${extras ? `<span class="cita-linea cita-adicional">${icono.mas(14)}<span>${escapeHtml(extras)}</span></span>` : ""}
          <span class="cita-linea">${icono.usuario(14)}<span>Con ${escapeHtml(cita.empleado_nombre)}</span></span>
          ${normalizarMoneda(cita.moneda) === "CUP" ? `
            <span class="cita-linea">${icono.dolar(14)}<span>
              Tasa 1 USD = ${Number(cita.tasa_cambio).toLocaleString("en-US", { maximumFractionDigits: 4 })} CUP
              · equivale a ${usd(cita.precio_total)} USD
            </span></span>` : ""}
        </div>
        ${cita.notas ? `<div class="cita-nota">“${escapeHtml(cita.notas)}”</div>` : ""}
      </div>

      ${grupo && grupo.length > 1 ? `
        <section class="form-seccion reserva-grupo">
          <div class="form-seccion-cab">
            <span class="form-seccion-ico">${icono.lista(17)}</span>
            <div class="form-seccion-textos">
              <p class="form-seccion-titulo">${cita.archivada ? "Reserva archivada" : "Reserva enlazada"} (${grupo.length} servicios)</p>
              <p class="form-seccion-sub">Los servicios se gestionan juntos.</p>
            </div>
          </div>
          <div class="reserva-lista">
            ${grupo.map((g) => `
              <a class="reserva-item ${g.id === cita.id ? "propia" : ""}" href="#/cita/${g.id}${sufijoFecha}">
                <span class="reserva-hora">${icono.reloj(14)}${hora(g.inicio)}</span>
                <span class="reserva-datos">
                  <span class="reserva-servicio">${escapeHtml(g.servicio_nombre)}${textoSubtipo(g.subtipo) ? ` · ${escapeHtml(textoSubtipo(g.subtipo))}` : ""}</span>
                  <span class="reserva-sub">${escapeHtml(g.empleado_nombre)}</span>
                </span>
                ${g.id === cita.id ? `<span class="reserva-aqui">Esta</span>` : badgeCita(g)}
              </a>`).join("")}
          </div>
          ${puedeEditar && grupo.some((g) => g.estado === "programada") ? `
            <div class="fila-btns reserva-acciones">
              <button class="btn btn-suave-ok" id="btn-completar-reserva" type="button">${icono.check(15)}Completar reserva</button>
              <button class="btn btn-suave-peligro" id="btn-cancelar-reserva" type="button">${icono.equis(15)}Cancelar reserva</button>
            </div>` : ""}
        </section>` : ""}

      <div class="fila-btns detalle-ficha">
        <a class="btn btn-suave btn-bloque" href="#/clientes/${cita.cliente_id}">${icono.personas(15)}Ver ficha de la clienta</a>
      </div>

      ${cita.estado === "programada" && puedeEditar ? `
        <div class="detalle-acciones">
          <button class="btn btn-suave-dorado btn-bloque" id="btn-reprogramar" type="button"
                  aria-expanded="${reprogramando}">
            ${icono.lapiz(15)}${reprogramando ? "Cerrar edición" : "Editar cita"}
          </button>
          <div class="fila-btns">
            <button class="btn btn-suave-ok" id="btn-completar" type="button">${icono.check(15)}Completar cita</button>
            <button class="btn btn-suave-peligro" id="btn-cancelar" type="button">${icono.equis(15)}Cancelar cita</button>
          </div>
        </div>

        <section class="form-seccion">
          <div class="form-seccion-cab">
            <span class="form-seccion-ico">${icono.dolar(17)}</span>
            <div class="form-seccion-textos">
              <p class="form-seccion-titulo">Moneda de cobro</p>
              <p class="form-seccion-sub">La clienta puede pagar en USD o en CUP. El catálogo sigue en USD.</p>
            </div>
          </div>
          <div class="segmentado" role="tablist" aria-label="Moneda de cobro">
            <button class="segmento ${normalizarMoneda(cita.moneda) === "USD" ? "activo" : ""}"
              data-cambiar-moneda="USD" type="button" role="tab">USD</button>
            <button class="segmento ${normalizarMoneda(cita.moneda) === "CUP" ? "activo" : ""}"
              data-cambiar-moneda="CUP" type="button" role="tab">CUP</button>
          </div>
          <p class="nota" style="margin:8px 0 0">
            Se cobrará <b>${importe(cita.precio_total_moneda ?? cita.precio_total, cita.moneda)} ${etiquetaMoneda(cita.moneda)}</b>
            (${usd(cita.precio_total)} USD)
            ${normalizarMoneda(cita.moneda) === "CUP"
              ? ` · tasa 1 USD = ${Number(cita.tasa_cambio).toLocaleString("en-US", { maximumFractionDigits: 4 })} CUP`
              : ""}.
            ${grupo && grupo.length > 1
              ? " El cambio se aplica a las citas programadas de esta reserva."
              : ""}
          </p>
        </section>` : ""}

      <div id="zona-reprogramar"></div>`;

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
        notaHora = "";
        if (reprogramando) {
          servicioNuevo = todosServicios.find((s) => s.id === cita.servicio_id) || servicio;
          subtipoNuevo = cita.subtipo;
          adicionalesNuevos = new Set(cita.adicional_ids || []);
          empleadoNuevo = cita.empleado_id;
          fecha = desdeISO(cita.inicio);
          // Mantener la hora actual permite corregir solo el servicio sin
          // tener que volver a elegir día y hora.
          slot = new Date(cita.inicio).getTime() >= Date.now() - 15 * 60 * 1000
            ? { inicio: cita.inicio, fin: cita.fin }
            : null;
        } else {
          slot = null;
        }
        pintar();
        if (reprogramando) {
          requestAnimationFrame(() => $("#zona-reprogramar")?.scrollIntoView({
            behavior: "smooth", block: "start",
          }));
        }
      };
      $$("[data-cambiar-moneda]").forEach((boton) => {
        boton.onclick = () => cambiarMoneda(boton.dataset.cambiarMoneda);
      });
      if (reprogramando) pintarReprogramar();
    }
  }

  async function cambiarMoneda(nueva) {
    const moneda = normalizarMoneda(nueva);
    if (moneda === normalizarMoneda(cita.moneda)) return;
    const aplicarGrupo = Boolean(cita.grupo_id);
    try {
      cita = await patch(`/citas/${cita.id}/moneda`, {
        moneda,
        aplicar_grupo: aplicarGrupo,
      });
      if (aplicarGrupo) {
        try {
          grupo = await get(`/citas?grupo_id=${encodeURIComponent(cita.grupo_id)}`);
        } catch { /* se mantiene la reserva ya cargada */ }
      }
      aviso(`Cita en ${moneda}`, "ok");
      pintar();
    } catch (e) {
      aviso(e.message || "No se pudo cambiar la moneda.", "error");
    }
  }

  function actualizarNotaHora() {
    const nota = $("#nota-hora");
    if (!nota) return;
    nota.textContent = notaHora;
    nota.classList.toggle("oculto", !notaHora);
  }

  function pintarReprogramar() {
    const caja = $("#zona-reprogramar");
    if (!caja) return;
    // Al repintar, cualquier comprobación de horario anterior queda obsoleta.
    solicitudHorarios += 1;
    verificandoHorario = false;

    if (!servicioNuevo) {
      caja.innerHTML = `
        <div class="tarjeta detalle-reprogramar">
          <div class="paso-titulo" style="margin-top:0">Editar cita</div>
          <p class="error-txt">No se pudo cargar el servicio de esta cita. Actualiza la página e inténtalo de nuevo.</p>
          <div class="fila-btns">
            <button class="btn btn-suave" id="btn-deshacer" type="button">Cerrar</button>
          </div>
        </div>`;
      $("#btn-deshacer").onclick = () => {
        reprogramando = false;
        slot = null;
        pintar();
      };
      return;
    }

    const categoria = servicioNuevo.categoria || "";
    const listaServicios = serviciosDeCategoria();
    const extrasDisponibles = adicionalesDisponibles(servicioNuevo);
    const aptas = specialistsAptas(servicioNuevo, [...adicionalesNuevos]);
    if (!aptas.some((e) => e.id === empleadoNuevo)) {
      empleadoNuevo = aptas.length === 1 ? aptas[0].id : null;
      // Con una sola especialista se conserva la hora para comprobarla con ella;
      // si hay varias, hay que elegir y el horario se vuelve a calcular.
      if (!empleadoNuevo) slot = null;
    }
    const extrasElegidos = extrasDisponibles.filter((s) => adicionalesNuevos.has(s.id));
    const totalDuracion = (servicioNuevo.duracion_min || 0) +
      extrasElegidos.reduce((n, s) => n + s.duracion_min, 0);
    const totalPrecio = Number(servicioNuevo.precio || 0) +
      extrasElegidos.reduce((n, s) => n + Number(s.precio), 0);
    const subtipos = servicioNuevo.subtipos || [];
    const etiquetaSubtipo = categoria === "Pestañas"
      ? "Tipo de pestaña"
      : categoria === "Cejas" ? "Color de tinte" : "Tipo";
    const iconoCat = icoCategoria(categoria);

    caja.innerHTML = `
      <div class="form-vista detalle-reprogramar">
        <div class="reprog-cab">
          <span class="form-seccion-ico">${icono.lapiz(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Editar cita</p>
            <p class="form-seccion-sub">Cambia el servicio, los adicionales, la especialista o el horario.</p>
          </div>
        </div>

        <section class="form-seccion">
          <div class="form-seccion-cab">
            <span class="form-seccion-ico">
              ${iconoCat ? `<img class="reprog-cat-ico" src="${iconoCat}" alt="" />` : icono.etiqueta(17)}
            </span>
            <div class="form-seccion-textos">
              <p class="form-seccion-titulo">Servicio</p>
              <p class="form-seccion-sub">Solo puedes cambiar de servicio dentro de esta categoría.</p>
            </div>
            <span class="reprog-candado" title="La categoría no se puede cambiar">
              ${icono.candado(12)}${escapeHtml(mostrarCategoria(categoria) || "Sin categoría")}
            </span>
          </div>

          <div class="servicios-lista" role="radiogroup" aria-label="Servicio de la cita">
            ${listaServicios.map((s) => {
              const actual = servicioNuevo.id === s.id;
              return `
                <button type="button" class="sel-card reprog-servicio ${actual ? "activo" : ""}"
                        data-servicio="${s.id}" role="radio" aria-checked="${actual}">
                  <span class="reprog-servicio-cab">
                    <span class="sel-titulo">${escapeHtml(s.nombre)}${s.activo ? "" : " (inactivo)"}</span>
                    ${actual ? `<span class="reprog-marca">${icono.check(12)}Actual</span>` : ""}
                  </span>
                  <span class="sel-meta">${usd(s.precio)} USD · ${duracionTxt(s.duracion_min)}</span>
                </button>`;
            }).join("")}
          </div>

          ${subtipos.length ? `
            <div class="paso-titulo">${etiquetaSubtipo}</div>
            <div class="radio-fila">
              ${subtipos.map((t) => `
                <button type="button" class="radio-op ${subtipoNuevo === t ? "activo" : ""}" data-edit-subtipo="${escapeHtml(t)}">
                  ${escapeHtml(t.length === 1 ? `Tipo ${t}` : t)}
                </button>`).join("")}
            </div>` : ""}
        </section>

        ${extrasDisponibles.length ? `
          <section class="form-seccion">
            <div class="form-seccion-cab">
              <span class="form-seccion-ico">${icono.mas(17)}</span>
              <div class="form-seccion-textos">
                <p class="form-seccion-titulo">Adicionales</p>
                <p class="form-seccion-sub">Opcional. Se suman al servicio y al total.</p>
              </div>
            </div>
            <div class="adicionales-lista">
              ${extrasDisponibles.map((s) => `
                <label class="adicional-op ${adicionalesNuevos.has(s.id) ? "activo" : ""}">
                  <input type="checkbox" data-edit-adicional="${s.id}" ${adicionalesNuevos.has(s.id) ? "checked" : ""}>
                  <span class="adicional-datos">
                    <span class="adicional-nombre">${escapeHtml(s.nombre)}${s.activo ? "" : " (inactivo)"}</span>
                    <span class="adicional-meta">+${duracionTxt(s.duracion_min)} · ${usd(s.precio)}</span>
                  </span>
                </label>`).join("")}
            </div>
          </section>` : ""}

        <section class="form-seccion">
          <div class="form-seccion-cab">
            <span class="form-seccion-ico">${icono.usuario(17)}</span>
            <div class="form-seccion-textos">
              <p class="form-seccion-titulo">Especialista</p>
              <p class="form-seccion-sub">Solo aparecen quienes realizan esta combinación.</p>
            </div>
          </div>
          ${aptas.length ? `
            <div class="chips" id="chips-repro">
              ${aptas.map((e) => `
                <button type="button" class="chip ${empleadoNuevo === e.id ? "activo" : ""}" data-id="${e.id}">
                  ${escapeHtml(nombreCorto(e.nombre))}
                </button>`).join("")}
            </div>` : `<div class="vacio">Ninguna especialista realiza esta combinación de servicios.</div>`}
        </section>

        <section class="form-seccion">
          <div class="form-seccion-cab">
            <span class="form-seccion-ico">${icono.reloj(17)}</span>
            <div class="form-seccion-textos">
              <p class="form-seccion-titulo">Día y hora</p>
              <p class="form-seccion-sub">Se comprueba la disponibilidad al cambiar el servicio.</p>
            </div>
          </div>
          <p class="reprog-hora-actual">${icono.reloj(13)} Hora actual de la cita: <b>${hora(cita.inicio)}</b></p>
          ${empleadoNuevo
            ? `<div id="sel-dia" style="margin-top:8px"></div>
               <p class="reprog-aviso ${notaHora ? "" : "oculto"}" id="nota-hora" role="status">${escapeHtml(notaHora)}</p>
               <div id="sel-hora" style="margin-top:8px"></div>`
            : `<p class="nota">Elige una especialista para ver los horarios.</p>`}
        </section>

        <div class="resumen-caja reprog-resumen">
          <div class="linea"><b>Total:</b> ${importe(convertirMoneda(totalPrecio, cita.moneda, cita.tasa_cambio), cita.moneda)} ${etiquetaMoneda(cita.moneda)} · ${duracionTxt(totalDuracion)}</div>
          ${normalizarMoneda(cita.moneda) === "CUP"
            ? `<div class="linea"><b>Equivalente:</b> ${usd(totalPrecio)} USD · tasa 1 USD = ${Number(cita.tasa_cambio).toLocaleString("en-US", { maximumFractionDigits: 4 })} CUP</div>`
            : ""}
          <div class="linea"><b>Servicio:</b> ${escapeHtml(servicioNuevo.nombre)}${textoSubtipo(subtipoNuevo) ? ` · ${escapeHtml(textoSubtipo(subtipoNuevo))}` : ""}</div>
          ${extrasElegidos.length ? `<div class="linea"><b>Adicionales:</b> ${escapeHtml(extrasElegidos.map((s) => s.nombre).join(", "))}</div>` : ""}
          ${empleadoNuevo ? `<div class="linea"><b>Especialista:</b> ${escapeHtml(nombreEmpleado(empleadoNuevo))}</div>` : ""}
        </div>

        <p class="error-txt oculto" id="error-editar"></p>
        <div class="fila-btns">
          <button class="btn btn-suave" id="btn-deshacer" type="button">Cancelar</button>
          <button class="btn btn-dorado" id="btn-confirmar" type="button" disabled>Guardar cambios</button>
        </div>
      </div>`;

    function actualizarConfirmar() {
      const btn = $("#btn-confirmar");
      if (!btn) return;
      const faltaTipo = Boolean(servicioNuevo?.subtipos?.length && !subtipoNuevo);
      btn.disabled = guardandoEdicion || verificandoHorario || !slot ||
        !empleadoNuevo || faltaTipo;
      btn.textContent = guardandoEdicion
        ? "Guardando…"
        : verificandoHorario ? "Comprobando horario…" : "Guardar cambios";
    }

    // ---------- Cambiar de servicio (misma categoría) ----------
    $$("[data-servicio]", caja).forEach((boton) => {
      boton.onclick = () => {
        const id = Number(boton.dataset.servicio);
        if (id === servicioNuevo?.id) return;
        servicioNuevo = todosServicios.find((s) => s.id === id) || null;
        const permitidos = servicioNuevo?.subtipos || [];
        subtipoNuevo = permitidos.length === 1
          ? permitidos[0]
          : permitidos.includes(subtipoNuevo) ? subtipoNuevo : null;
        // No conservar adicionales que la API rechazaría con el nuevo servicio.
        adicionalesNuevos = new Set(
          [...adicionalesNuevos].filter((adicionalId) => {
            const extra = todosServicios.find((s) => s.id === adicionalId);
            return extra && servicioNuevo && compatible(servicioNuevo, extra);
          })
        );
        // Se conserva la hora elegida: al pintar se comprueba si sigue siendo
        // posible y, si no, se limpia y se muestran las horas alternativas.
        notaHora = "";
        pintar();
      };
    });

    $$("[data-edit-subtipo]", caja).forEach((boton) => {
      boton.onclick = () => {
        subtipoNuevo = boton.dataset.editSubtipo;
        $$("[data-edit-subtipo]", caja).forEach((b) =>
          b.classList.toggle("activo", b === boton)
        );
        actualizarConfirmar();
      };
    });

    $$("[data-edit-adicional]", caja).forEach((input) => {
      input.onchange = () => {
        const id = Number(input.dataset.editAdicional);
        if (input.checked) adicionalesNuevos.add(id);
        else adicionalesNuevos.delete(id);
        // Cambia la duración total: se vuelve a comprobar la hora elegida.
        pintar();
      };
    });

    $$("#chips-repro .chip").forEach((chip) => {
      chip.onclick = () => {
        empleadoNuevo = Number(chip.dataset.id);
        // Se mantiene la hora elegida para comprobarla con la nueva especialista.
        notaHora = "";
        pintar();
      };
    });

    // ---------- Horarios ----------
    let recargarHorarios = async () => {};
    if (empleadoNuevo && servicioNuevo) {
      const selectorDia = crearSelectorDia($("#sel-dia"), fecha, (nueva) => {
        fecha = nueva;
        slot = null;
        notaHora = "";
        selectorDia.actualizar(nueva);
        actualizarNotaHora();
        recargarHorarios();
        actualizarConfirmar();
      }, { noRetroceder: true });
      const horarios = crearHorarios($("#sel-hora"), "Elige una hora disponible.");
      recargarHorarios = async () => {
        const solicitud = ++solicitudHorarios;
        const hermanas = (grupo || []).filter((g) => g.id !== cita.id && g.estado !== "cancelada");
        const excluir = hermanas.map((g) => ({ inicio: g.inicio, fin: g.fin }));
        const incluir = hermanas
          .filter((g) => {
            const otra = todosServicios.find((s) => s.id === g.servicio_id);
            return combinables(servicioNuevo.categoria, otra?.categoria || "");
          })
          .map((g) => g.inicio);
        // Si se intenta conservar una hora, se pide a la API como inicio exacto
        // (puede no caer en la rejilla de 15 min) para comprobar que cabe.
        const horaElegida = slot?.inicio ?? null;
        const continuaciones = [...new Set([
          ...incluir,
          ...(horaElegida ? [horaElegida] : []),
        ])];
        verificandoHorario = true;
        actualizarConfirmar();
        const resultado = await horarios.cargar(
          () => consultaDisponibilidad({
            empleadoId: empleadoNuevo,
            fecha,
            servicioId: servicioNuevo.id,
            adicionalIds: [...adicionalesNuevos],
            excluirCitaId: cita.id,
            continuaciones,
          }),
          horaElegida,
          (elegido) => {
            slot = elegido;
            notaHora = "";
            actualizarNotaHora();
            actualizarConfirmar();
          },
          { excluir, incluir }
        );
        if (solicitud !== solicitudHorarios) return; // ya hay otra comprobación
        verificandoHorario = false;
        if (resultado && horaElegida &&
            !resultado.slots.some((s) => s.inicio === horaElegida)) {
          slot = null;
          notaHora = cita.inicio === horaElegida && cita.empleado_id === empleadoNuevo
            ? `El servicio nuevo no cabe a las ${hora(horaElegida)} con esta especialista. Te mostramos las horas libres de ese día.`
            : `Las ${hora(horaElegida)} ya no están disponibles con estos cambios. Elige otra hora de las que aparecen abajo.`;
          actualizarNotaHora();
          requestAnimationFrame(() => $("#nota-hora")?.scrollIntoView({
            behavior: "smooth", block: "nearest",
          }));
        }
        actualizarConfirmar();
      };
      recargarHorarios();
    }

    $("#btn-deshacer").onclick = () => {
      reprogramando = false;
      guardandoEdicion = false;
      slot = null;
      notaHora = "";
      pintar();
    };

    $("#btn-confirmar").onclick = async () => {
      if (guardandoEdicion || !slot || !empleadoNuevo || !servicioNuevo) return;
      const antes = {
        inicio: cita.inicio,
        empleadoId: cita.empleado_id,
        empleada: cita.empleado_nombre,
      };
      const servicioGuardado = servicioNuevo;
      guardandoEdicion = true;
      actualizarConfirmar();
      try {
        cita = await patch(`/citas/${cita.id}`, {
          servicio_id: servicioGuardado.id,
          adicional_ids: [...adicionalesNuevos],
          subtipo: subtipoNuevo || null,
          inicio: slot.inicio,
          empleado_id: empleadoNuevo,
        });
        const movida = antes.inicio !== cita.inicio || antes.empleadoId !== cita.empleado_id;
        servicio = todosServicios.find((s) => s.id === cita.servicio_id) || servicioGuardado;
        servicioNuevo = servicio;
        subtipoNuevo = cita.subtipo;
        adicionalesNuevos = new Set(cita.adicional_ids || []);
        empleadoNuevo = cita.empleado_id;
        fecha = desdeISO(cita.inicio);
        if (grupo) grupo = grupo.map((g) => g.id === cita.id ? cita : g);
        if (movida) marcarReprogramadas([cita.id]);
        reprogramando = false;
        guardandoEdicion = false;
        slot = null;
        notaHora = "";
        pintar();
        if (movida) {
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
        } else {
          aviso("Cita actualizada", "ok");
        }
      } catch (e) {
        guardandoEdicion = false;
        const error = $("#error-editar");
        if (error) {
          error.textContent = e.message || "No se pudo actualizar la cita.";
          error.classList.remove("oculto");
        }
        actualizarConfirmar();
        recargarHorarios();
      }
    };
    actualizarConfirmar();
  }

  pintar();
}
