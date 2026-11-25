// Componentes compartidos entre vistas: selector de día y slots de horario.
// Equivalen a SelectorDia y Horarios de salon_app.

import { get } from "../api.js?v=49";
import {
  $, $$, escapeHtml, aISO, sumarDias, sumarMeses, etiqueta, esHoy, hora,
  tituloMes,
} from "../util.js?v=53";
import { icono } from "../iconos.js?v=64";

const SEMANA = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

/**
 * Calendario flotante para elegir un día con un solo clic.
 * `minimo` deshabilita los días anteriores (citas nuevas y reprogramaciones).
 * `maximo` deshabilita los días posteriores (archivar citas ya realizadas).
 * `consultaDias(desdeISO, hastaISO)` devuelve un Set de días con citas
 * programadas para marcarlos en el calendario.
 * Devuelve una función para cerrarlo.
 */
export function abrirCalendario({
  fecha, minimo = null, maximo = null, onElegir, consultaDias = null,
}) {
  const hoy = new Date();
  let mes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const minISO = minimo ? aISO(minimo) : null;
  const maxISO = maximo ? aISO(maximo) : null;
  const mesMin = minimo
    ? new Date(minimo.getFullYear(), minimo.getMonth(), 1)
    : null;
  const mesMax = maximo
    ? new Date(maximo.getFullYear(), maximo.getMonth(), 1)
    : null;

  const fondo = document.createElement("div");
  fondo.className = "cal-fondo";
  fondo.innerHTML = `
    <div class="cal-tarjeta" role="dialog" aria-modal="true" aria-label="Elegir fecha"></div>`;
  document.body.appendChild(fondo);
  const tarjeta = fondo.querySelector(".cal-tarjeta");

  function cerrar() {
    document.removeEventListener("keydown", alTeclear);
    fondo.remove();
  }

  function alTeclear(e) {
    if (e.key === "Escape") cerrar();
  }

  let solicitudDias = 0;

  async function marcarDiasConCitas(primero, ultimo) {
    if (!consultaDias) return;
    const solicitud = ++solicitudDias;
    let dias;
    try {
      dias = await consultaDias(aISO(primero), aISO(ultimo));
    } catch {
      return; // sin conexión: el calendario sigue funcionando sin marcas
    }
    if (solicitud !== solicitudDias) return; // ya se cambió de mes
    const marcados = dias instanceof Set ? dias : new Set(dias || []);

    $$(".cal-dia", tarjeta).forEach((boton) => {
      if (!marcados.has(boton.dataset.iso)) return;
      boton.classList.add("con-citas");
      boton.title = "Tiene citas programadas";
      boton.setAttribute(
        "aria-label",
        `Elegir el día ${boton.textContent}, con citas programadas`
      );
    });
  }

  function pintar() {
    const puedeRetroceder = !mesMin || mes.getTime() > mesMin.getTime();
    const puedeAvanzar = !mesMax || mes.getTime() < mesMax.getTime();
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const huecos = (primero.getDay() + 6) % 7; // lunes primero
    const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    const total = ultimo.getDate();
    const celdas = Array.from({ length: huecos }, () => null);
    for (let dia = 1; dia <= total; dia += 1) {
      celdas.push(new Date(mes.getFullYear(), mes.getMonth(), dia));
    }
    while (celdas.length % 7 !== 0) celdas.push(null);

    const fechaISO = aISO(fecha);
    const hoyISO = aISO(hoy);
    tarjeta.innerHTML = `
      <div class="cal-cab">
        <button class="cal-nav" data-mes="-1" type="button" aria-label="Mes anterior"
                ${puedeRetroceder ? "" : "disabled"}>‹</button>
        <strong class="cal-titulo">${escapeHtml(tituloMes(mes))}</strong>
        <button class="cal-nav" data-mes="1" type="button" aria-label="Mes siguiente"
                ${puedeAvanzar ? "" : "disabled"}>›</button>
      </div>
      <div class="cal-semana">${SEMANA.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cal-grilla">
        ${celdas.map((d) => {
          if (!d) return `<span class="cal-celda"></span>`;
          const iso = aISO(d);
          const apagado = (minISO && iso < minISO) || (maxISO && iso > maxISO);
          const clases = ["cal-dia"];
          if (iso === hoyISO) clases.push("hoy");
          if (iso === fechaISO) clases.push("elegido");
          if (apagado) clases.push("apagado");
          return `<span class="cal-celda">
            <button class="${clases.join(" ")}" type="button" data-iso="${iso}"
                    ${apagado ? "disabled" : ""} aria-label="Elegir el día ${d.getDate()}"
                    aria-pressed="${iso === fechaISO}">${d.getDate()}</button>
          </span>`;
        }).join("")}
      </div>
      <div class="cal-pie">
        <button class="cal-pie-btn" data-hoy type="button"
                ${(minISO && hoyISO < minISO) || (maxISO && hoyISO > maxISO) ? "disabled" : ""}>${icono.calendario(14)} Hoy</button>
        <button class="cal-pie-btn" data-cerrar type="button">Cerrar</button>
      </div>`;

    $$("[data-mes]", tarjeta).forEach((b) => {
      b.onclick = () => {
        mes = sumarMeses(mes, Number(b.dataset.mes));
        pintar();
      };
    });
    $$(".cal-dia", tarjeta).forEach((b) => {
      b.onclick = () => {
        const [anio, m, dia] = b.dataset.iso.split("-").map(Number);
        cerrar();
        onElegir(new Date(anio, m - 1, dia));
      };
    });
    tarjeta.querySelector("[data-hoy]").onclick = () => {
      cerrar();
      onElegir(new Date());
    };
    tarjeta.querySelector("[data-cerrar]").onclick = cerrar;
    marcarDiasConCitas(primero, ultimo);
  }

  fondo.addEventListener("click", (e) => {
    if (e.target === fondo) cerrar();
  });
  document.addEventListener("keydown", alTeclear);
  pintar();

  return cerrar;
}

/**
 * Navegador de día. `opciones.noRetroceder` deshabilita ‹ y los días pasados
 * del calendario (para agendar citas nuevas). `opciones.maximo` deshabilita ›
 * y los días posteriores (para archivar citas ya realizadas).
 */
export function crearSelectorDia(contenedor, fecha, alCambiar, opciones = {}) {
  const maximo = opciones.maximo || null;
  const maxISO = maximo ? aISO(maximo) : null;
  contenedor.innerHTML = `
    <div class="nav-fecha">
      <button class="nav-flecha" data-dir="-1" type="button" ${opciones.noRetroceder ? "disabled" : ""} aria-label="Día anterior">‹</button>
      <button class="nav-fecha-titulo" data-elegir type="button" aria-label="Elegir otro día en el calendario">
        <span class="nav-fecha-linea">${icono.calendario(14)}<span data-texto>${escapeHtml(etiqueta(fecha))}</span></span>
        <span class="nav-sub" data-sub>${esHoy(fecha) ? "Hoy · toca para elegir otro día" : "Toca para elegir otro día"}</span>
      </button>
      <button class="nav-flecha" data-dir="1" type="button" ${maxISO && aISO(fecha) >= maxISO ? "disabled" : ""} aria-label="Día siguiente">›</button>
    </div>`;

  contenedor.querySelector("[data-dir='-1']").onclick = () => cambiar(sumarDias(fecha, -1));
  contenedor.querySelector("[data-dir='1']").onclick = () => cambiar(sumarDias(fecha, 1));
  contenedor.querySelector("[data-elegir]").onclick = () => {
    abrirCalendario({
      fecha,
      minimo: opciones.noRetroceder ? new Date() : null,
      maximo,
      onElegir: cambiar,
    });
  };

  // El componente se sincroniza a sí mismo tras cada cambio: el título
  // refleja siempre el día real, aunque la vista que lo use tenga
  // código viejo en la caché del navegador.
  function cambiar(nueva) {
    alCambiar(nueva);
    actualizar(nueva);
  }

  function actualizar(nueva) {
    fecha = nueva;
    contenedor.querySelector("[data-texto]").textContent = etiqueta(fecha);
    contenedor.querySelector("[data-sub]").textContent =
      esHoy(fecha) ? "Hoy · toca para elegir otro día" : "Toca para elegir otro día";
    if (opciones.noRetroceder) {
      const prev = contenedor.querySelector("[data-dir='-1']");
      prev.disabled = aISO(fecha) <= aISO(new Date());
    }
    if (maxISO) {
      const next = contenedor.querySelector("[data-dir='1']");
      next.disabled = aISO(fecha) >= maxISO;
    }
  }

  return { actualizar };
}

/**
 * Lista de slots disponibles. `consulta` debe devolver la disponibilidad
 * (GET /empleados/{id}/disponibilidad). Muestra chips de 15 min.
 *
 * `opciones.desde` (ISO string) oculta las horas anteriores al final del bloque
 * ya reservado: se usa en reservas enlazadas, donde el siguiente servicio debe
 * empezar cuando termina el anterior o más tarde, el mismo día.
 * `opciones.incluir` (ISO strings) permite arranques anteriores a `desde` para
 * combinados (Pestañas + Pedicura a la misma hora).
 * `opciones.excluir` (intervalos ISO) oculta arranques que se crucen con las
 * demás citas de la reserva; los arranques de `incluir` se respetan.
 */
export function crearHorarios(contenedor, textoAyuda) {
  contenedor.innerHTML = `
    <p class="nota">${escapeHtml(textoAyuda)}</p>`;

  async function cargar(consulta, seleccionActual, alElegir, opciones = {}) {
    contenedor.innerHTML = `<p class="nota">Buscando horarios…</p>`;
    let disp;
    try {
      disp = await consulta();
    } catch (e) {
      contenedor.innerHTML = `<p class="error-txt">${escapeHtml(e.message)}</p>`;
      return null;
    }
    const todos = disp?.slots || [];
    const desdeMs = opciones.desde ? new Date(opciones.desde).getTime() : null;
    const desdeDia = opciones.desde ? String(opciones.desde).slice(0, 10) : null;
    const incluidos = new Set(
      (opciones.incluir || []).map((x) => new Date(x).getTime())
    );
    const excluidos = (opciones.excluir || []).map((iv) => ({
      inicio: new Date(iv.inicio).getTime(),
      fin: new Date(iv.fin).getTime(),
    }));
    const slots = todos.filter((s) => {
      const ms = new Date(s.inicio).getTime();
      if (incluidos.has(ms)) return true;
      const fin = new Date(s.fin).getTime();
      if (excluidos.some((iv) => ms < iv.fin && iv.inicio < fin)) return false;
      if (desdeMs === null) return true;
      return String(s.inicio).slice(0, 10) === desdeDia && ms >= desdeMs;
    });
    if (!todos.length) {
      contenedor.innerHTML = `<p class="nota">Sin horarios libres este día. Prueba con otra fecha.</p>`;
      return { todos, slots: [] };
    }
    if (!slots.length) {
      contenedor.innerHTML = desdeMs !== null
        ? `
        <p class="nota">No hay horas libres después de las ${hora(opciones.desde)} para
        esta especialista. Prueba con otra especialista u otro día. (La reserva
        sigue el mismo día y los servicios no se cruzan.)</p>`
        : `<p class="nota">Sin horarios libres este día. Prueba con otra fecha.</p>`;
      return { todos, slots: [] };
    }
    contenedor.innerHTML = `
      <div class="slot-chips">
        ${slots.map((s) => `
          <button type="button" class="slot-chip ${seleccionActual === s.inicio ? "activo" : ""}"
                  data-inicio="${s.inicio}">${hora(s.inicio)}</button>`).join("")}
      </div>`;
    $$(".slot-chip", contenedor).forEach((chip) => {
      chip.onclick = () => {
        $$(".slot-chip", contenedor).forEach((c) => c.classList.remove("activo"));
        chip.classList.add("activo");
        const slot = slots.find((s) => s.inicio === chip.dataset.inicio);
        alElegir(slot);
      };
    });
    return { todos, slots };
  }

  function limpiar(texto) {
    contenedor.innerHTML = `<p class="nota">${escapeHtml(texto)}</p>`;
  }

  return { cargar, limpiar };
}

/** Consulta de disponibilidad contra la API. */
export function consultaDisponibilidad({
  empleadoId, fecha, servicioId, adicionalIds = [], excluirCitaId,
  incluirPasados = false, permitirInactivo = false, continuaciones = [],
}) {
  const q = new URLSearchParams({ fecha: aISO(fecha), servicio_id: String(servicioId) });
  adicionalIds.forEach((a) => q.append("adicional_ids", String(a)));
  if (excluirCitaId) q.set("excluir_cita_id", String(excluirCitaId));
  if (incluirPasados) q.set("incluir_pasados", "true");
  if (permitirInactivo) q.set("permitir_inactivo", "true");
  continuaciones.forEach((c) => q.append("continuacion", c));
  return get(`/empleados/${empleadoId}/disponibilidad?${q.toString()}`);
}
