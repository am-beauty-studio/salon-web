// Nueva cita / reserva: formulario en pasos + notas + resumen.
// Una misma clienta puede agendar de 1 a 3 servicios el mismo día en UNA sola
// operación. Reglas de horario (igual que la API):
// - Los servicios no se cruzan: cada uno empieza cuando termina el bloque
//   anterior (hora seguida) o más tarde, si esa hora ya está ocupada.
// - Única excepción: Pestañas se COMBINAN con Pedicura a la misma hora
//   (dos especialistas a la vez).
// Equivalente a src/app/cita/nueva.tsx.

import { get, post } from "../api.js?v=49";
import {
  $, $$, aviso, escapeHtml, aISO, etiqueta, hora, usd, importe, etiquetaMoneda,
  convertirMoneda, duracionTxt,
  compatible, combinables, textoSubtipo, mostrarCategoria, sumarDias, nombreCorto,
  compararCategorias,
} from "../util.js?v=57";
import { crearSelectorDia, crearHorarios, consultaDisponibilidad } from "./componentes.js?v=52";
import { icono, icoCategoria } from "../iconos.js?v=65";
import { mostrarExitoCita } from "../modal-exito.js?v=50";
import { selectorMoneda, conectarSelectorMoneda } from "../moneda-switch.js?v=1";
import { esAdmin } from "../auth.js?v=52";

const MAX_SERVICIOS = 3;

export async function render(raiz, _params, query) {
  // Agendar y archivar son acciones exclusivas de las administradoras.
  const archivar = query.get("archivar") === "1";
  if (!esAdmin()) {
    raiz.innerHTML = `
      <div class="vista-cab"><h1 class="vista-titulo">${archivar ? "Archivar cita" : "Nueva cita"}</h1></div>
      <p class="error-txt">Solo las administradoras pueden agendar o archivar citas.</p>`;
    return;
  }
  const ayer = sumarDias(new Date(), -1);
  const [clientes, servicios, empleados, configMoneda] = await Promise.all([
    get("/clientes?limit=200"),
    get("/servicios?solo_activos=true"),
    // Al archivar también se ofrecen empleadas inactivas que sí realizaron el servicio.
    get(`/empleados?solo_activos=${archivar ? "false" : "true"}`),
    // Tasa USD → CUP. Si falla, se agenda solo en USD.
    get("/configuracion/monedas").catch(() => null),
  ]);
  const tasaCup = Number(configMoneda?.tasa_cambio_cup || 0);

  let clienteId = query.get("cliente") ? Number(query.get("cliente")) : null;
  let clienteNombre = query.get("nombre") || (clienteId ? clientes.find((c) => c.id === clienteId)?.nombre : null);

  // Servicios ya sumados a la reserva (máximo 3, mismo día)
  let items = []; // {servicio, subtipo, extras:number[], empleadoId, slot}

  // Servicio en curso (el que se está configurando para sumarlo)
  let servicio = null;
  let subtipo = null;
  let adicionales = new Set();
  let empleadoId = null;
  let fecha = archivar ? ayer : new Date();
  let slot = null;
  let categoriaActiva = null;
  let buscarTemporizador = null;
  let agendando = false;
  // La clienta decide al final si paga en USD o en CUP. El catálogo sigue en
  // USD y la API guarda la tasa del día para calcular el importe en CUP.
  let moneda = "USD";

  raiz.innerHTML = `
    <div class="vista-cab"><h1 class="vista-titulo">${archivar ? "Archivar cita" : "Nueva cita"}</h1></div>
    ${archivar ? `
      <div class="tarjeta" style="border-color:var(--gold);margin-bottom:14px">
        <div style="font-weight:700;color:var(--gold-dark)">Archivar cita ya realizada</div>
        <p class="nota" style="margin:4px 0 0">Elige un día anterior a hoy. La cita quedará completada y contará en Ganancias.</p>
      </div>` : ""}
    <div class="stepper-cita" role="list" aria-label="Pasos para agendar la cita">
      <section class="stepper-item" id="paso1" role="listitem">
        <span class="stepper-circulo" aria-hidden="true">1</span>
        <div class="stepper-cuerpo">
          <div class="stepper-etiqueta">Clienta</div>
          <div class="paso-contenido"></div>
        </div>
      </section>
      <section class="stepper-item" id="paso2" role="listitem">
        <span class="stepper-circulo" aria-hidden="true">2</span>
        <div class="stepper-cuerpo">
          <div class="stepper-etiqueta">Servicio</div>
          <div class="paso-contenido"></div>
        </div>
      </section>
      <section class="stepper-item oculto" id="paso-subtipo" role="listitem">
        <span class="stepper-circulo" aria-hidden="true">3</span>
        <div class="stepper-cuerpo">
          <div class="stepper-etiqueta">Tipo</div>
          <div class="paso-contenido"></div>
        </div>
      </section>
      <section class="stepper-item" id="paso3" role="listitem">
        <span class="stepper-circulo" aria-hidden="true">3</span>
        <div class="stepper-cuerpo">
          <div class="stepper-etiqueta">Adicionales <span class="stepper-nota">opcional</span></div>
          <div class="paso-contenido"></div>
        </div>
      </section>
      <section class="stepper-item" id="paso4" role="listitem">
        <span class="stepper-circulo" aria-hidden="true">4</span>
        <div class="stepper-cuerpo">
          <div class="stepper-etiqueta">Especialista</div>
          <div class="paso-contenido"></div>
        </div>
      </section>
      <section class="stepper-item" id="paso5" role="listitem">
        <span class="stepper-circulo" aria-hidden="true">5</span>
        <div class="stepper-cuerpo">
          <div class="stepper-etiqueta">Día y hora${archivar ? " (pasado)" : ""}</div>
          <div class="paso-contenido"></div>
        </div>
      </section>
      <section class="stepper-item" id="paso6" role="listitem">
        <span class="stepper-circulo" aria-hidden="true">6</span>
        <div class="stepper-cuerpo">
          <div class="stepper-etiqueta">Confirmar <span class="stepper-nota">moneda y notas</span></div>
          <div class="paso-contenido">
            <div id="paso-reserva"></div>
            <div id="paso-moneda"></div>
            <div id="paso-notas"></div>
            <div id="resumen-final"></div>
            <p class="error-txt oculto" id="error-cita"></p>
            <button class="btn btn-dorado btn-bloque" id="btn-agendar" type="button" disabled>${archivar ? "Archivar cita" : "Agendar cita"}</button>
          </div>
        </div>
      </section>
    </div>
    <div style="height:20px"></div>`;

  // ---------- Paso 1: clienta ----------
  function pintarPaso1() {
    const caja = $("#paso1 .paso-contenido");
    if (clienteId) {
      caja.innerHTML = `
        <div class="tarjeta" style="border-color:var(--gold);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px">
          <div style="font-weight:600">${escapeHtml(clienteNombre || "Clienta")}</div>
          <button class="btn btn-contorno btn-mini" id="cambiar-clienta" type="button" style="flex:none">Cambiar</button>
        </div>`;
      $("#cambiar-clienta").onclick = () => {
        clienteId = null; clienteNombre = null; pintarPaso1(); actualizar();
      };
      return;
    }

    caja.innerHTML = `
      <div class="campo-ico">
        ${icono.lupa()}
        <input class="input" id="buscar-clienta" placeholder="Buscar por nombre o teléfono" />
      </div>
      <div id="resultados-clienta"></div>
      <button class="chip-enlace" id="nueva-clienta" type="button">＋ Crear clienta nueva</button>
      <form id="form-nueva-clienta" class="tarjeta oculto" style="margin-top:10px">
        <div class="campo">
          <label class="etiqueta">Nombre y apellido *</label>
          <div class="campo-ico">
            ${icono.usuario()}
            <input class="input" id="nc-nombre" />
          </div>
        </div>
        <div class="campo">
          <label class="etiqueta">Teléfono (opcional)</label>
          <div class="campo-ico">
            ${icono.telefono()}
            <input class="input" id="nc-telefono" placeholder="+53 5..." />
          </div>
        </div>
        <p class="error-txt oculto" id="nc-error"></p>
        <div class="fila-btns">
          <button class="btn btn-contorno" type="button" id="nc-cancelar">Volver</button>
          <button class="btn btn-dorado" type="submit">Crear</button>
        </div>
      </form>`;

    $("#buscar-clienta").addEventListener("input", (e) => {
      clearTimeout(buscarTemporizador);
      const texto = e.target.value.trim();
      buscarTemporizador = setTimeout(() => buscarClientas(texto), 300);
    });

    $("#nueva-clienta").onclick = () => $("#form-nueva-clienta").classList.toggle("oculto");
    $("#nc-cancelar").onclick = () => $("#form-nueva-clienta").classList.add("oculto");
    $("#form-nueva-clienta").onsubmit = async (e) => {
      e.preventDefault();
      const nombre = $("#nc-nombre").value.trim();
      const error = $("#nc-error");
      if (nombre.length < 2) {
        error.textContent = "Falta el nombre de la clienta (mínimo 2 letras).";
        error.classList.remove("oculto");
        return;
      }
      error.classList.add("oculto");
      try {
        const telefono = $("#nc-telefono").value.trim();
        const nueva = await post("/clientes", { nombre, telefono: telefono || null });
        clienteId = nueva.id;
        clienteNombre = nueva.nombre;
        aviso("Clienta creada", "ok");
        pintarPaso1(); actualizar();
      } catch (err) {
        error.textContent = err.message;
        error.classList.remove("oculto");
      }
    };

    async function buscarClientas(texto) {
      const caja = $("#resultados-clienta");
      if (!caja) return;
      if (texto.length < 2) { caja.innerHTML = ""; return; }
      const lista = await get(`/clientes?q=${encodeURIComponent(texto)}`);
      if (!caja.isConnected) return;
      caja.innerHTML = lista.length
        ? lista.map((c) => `
            <button type="button" class="lista-fila" data-id="${c.id}">
              <span class="lista-principal">${escapeHtml(c.nombre)}</span>
              <span class="lista-secundario">${escapeHtml(c.telefono || "Sin teléfono")}</span>
            </button>`).join("")
        : `<p class="nota">Sin resultados.</p>`;
      $$(".lista-fila", caja).forEach((fila) => {
        fila.onclick = () => {
          const c = lista.find((x) => x.id === Number(fila.dataset.id));
          clienteId = c.id; clienteNombre = c.nombre;
          pintarPaso1(); actualizar();
        };
      });
    }
  }

  // ---------- Servicios ya sumados a la reserva ----------
  function pintarReserva() {
    const caja = $("#paso-reserva");
    if (!items.length) { caja.innerHTML = ""; return; }
    caja.innerHTML = `
      <div class="paso-titulo">Reserva (${items.length}/${MAX_SERVICIOS})</div>
      ${items.map((it, i) => `
        <div class="tarjeta item-reserva" style="border-color:var(--gold)">
          <div>
            <div style="font-weight:600">${hora(it.slot.inicio)} · ${escapeHtml(it.servicio.nombre)}${textoSubtipo(it.subtipo) ? ` · ${escapeHtml(textoSubtipo(it.subtipo))}` : ""}</div>
            <div class="nota">${escapeHtml(nombreEmpleado(it.empleadoId))}${extrasNombre(it.extras).length ? ` + ${escapeHtml(extrasNombre(it.extras).join(", "))}` : ""}</div>
          </div>
          <button class="btn btn-rojo-contorno btn-mini" data-quitar="${i}" type="button">✕</button>
        </div>`).join("")}
      ${items.length >= MAX_SERVICIOS ? `<p class="nota">Máximo ${MAX_SERVICIOS} servicios por reserva.</p>` : ""}`;
    $$("[data-quitar]", caja).forEach((btn) => {
      btn.onclick = () => {
        items.splice(Number(btn.dataset.quitar), 1);
        pintarReserva(); pintarPasosServicio(); recargarHorarios(); actualizar();
      };
    });
  }

  function nombreEmpleado(id) {
    return empleados.find((e) => e.id === id)?.nombre || "";
  }
  function extrasNombre(ids) {
    return ids.map((id) => servicios.find((s) => s.id === id)?.nombre).filter(Boolean);
  }

  // ---------- Paso 2: servicio ----------
  function categoriasPrincipales() {
    const cats = new Set(
      servicios.filter((s) => !s.es_adicional).map((s) => s.categoria)
    );
    return [...cats].filter(Boolean).sort(compararCategorias);
  }

  function pintarPasosServicio() {
    const lleno = items.length >= MAX_SERVICIOS;
    $("#paso2 .paso-contenido").innerHTML = "";
    $("#paso-subtipo .paso-contenido").innerHTML = "";
    $("#paso3 .paso-contenido").innerHTML = "";
    $("#paso4 .paso-contenido").innerHTML = "";
    $("#paso-agregar").innerHTML = "";
    // El paso 5 (día y hora) se crea una sola vez; solo se oculta si la
    // reserva ya tiene el máximo de servicios.
    cajaDia.classList.toggle("oculto", lleno);
    if (lleno) return;
    pintarPaso2(); pintarPasoSubtipo(); pintarPaso3(); pintarPaso4(); pintarAgregar();
  }

  function pintarPaso2() {
    const cats = categoriasPrincipales();
    // La clienta elige primero la categoría: hasta entonces no se ofrece
    // ningún servicio (igual que en la app móvil).
    if (categoriaActiva !== null && !cats.includes(categoriaActiva)) categoriaActiva = null;

    const caja = $("#paso2 .paso-contenido");
    if (!cats.length) {
      caja.innerHTML = `<div class="vacio">No hay servicios registrados.</div>`;
      return;
    }

    const deCategoria = categoriaActiva === null
      ? []
      : servicios
        .filter((s) => !s.es_adicional && s.categoria === categoriaActiva)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    caja.innerHTML = `
      <div class="chips fila">
        ${cats.map((cat) => {
          const ico = icoCategoria(cat);
          return `
          <button type="button" class="chip ${cat === categoriaActiva ? "activo" : ""}" data-cat="${escapeHtml(cat)}">
            ${ico ? `<img class="cat-ico" src="${ico}" alt="" />` : ""}${escapeHtml(mostrarCategoria(cat))}
          </button>`;
        }).join("")}
      </div>
      ${categoriaActiva === null
        ? `<p class="nota">Elige una categoría.</p>`
        : `<div id="servicios-lista"></div>`}`;

    $$("#paso2 .chip").forEach((chip) => {
      chip.onclick = () => { categoriaActiva = chip.dataset.cat; pintarPaso2(); pintarPasoSubtipo(); actualizar(); };
    });

    const lista = $("#servicios-lista");
    if (lista) {
      lista.innerHTML = deCategoria.map((s) => `
        <button type="button" class="sel-card ${servicio?.id === s.id ? "activo" : ""}" data-id="${s.id}">
          <div class="sel-titulo">${servicio?.id === s.id ? "✓ " : ""}${escapeHtml(s.nombre)}</div>
          <div class="sel-meta">${usd(s.precio)} USD · ${duracionTxt(s.duracion_min)}</div>
        </button>`).join("");

      $$("#servicios-lista .sel-card").forEach((card) => {
        card.onclick = () => {
          servicio = deCategoria.find((s) => s.id === Number(card.dataset.id));
          subtipo = null;
          adicionales = new Set();
          slot = null;
          pintarPaso2(); pintarPasoSubtipo(); pintarPaso3(); pintarPaso4(); pintarAgregar(); recargarHorarios(); actualizar();
        };
      });
    }
  }

  // ---------- Paso: subtipo (solo si el servicio lo tiene) ----------
  function etiquetaSubtipo() {
    return servicio?.categoria === "Pestañas" ? "Tipo de pestaña"
      : servicio?.categoria === "Cejas" ? "Color de tinte" : "Tipo";
  }

  function pintarPasoSubtipo() {
    const caja = $("#paso-subtipo .paso-contenido");
    const etiqueta = $("#paso-subtipo .stepper-etiqueta");
    if (etiqueta) etiqueta.textContent = etiquetaSubtipo();
    if (!servicio?.subtipos?.length) { caja.innerHTML = ""; return; }
    caja.innerHTML = `
      <div class="radio-fila">
        ${servicio.subtipos.map((t) => `
          <button type="button" class="radio-op ${subtipo === t ? "activo" : ""}" data-subtipo="${escapeHtml(t)}">
            ${escapeHtml(t.length === 1 ? `Tipo ${t}` : t)}
          </button>`).join("")}
      </div>`;
    $$("#paso-subtipo .radio-op").forEach((boton) => {
      boton.onclick = () => {
        subtipo = boton.dataset.subtipo;
        $$("#paso-subtipo .radio-op").forEach((b) => b.classList.toggle("activo", b === boton));
        actualizar();
      };
    });
  }

  // ---------- Paso 3: adicionales ----------
  function pintarPaso3() {
    const caja = $("#paso3 .paso-contenido");
    const disponibles = servicio
      ? servicios.filter((x) => x.es_adicional && compatible(servicio, x))
      : [];
    if (!servicio || !disponibles.length) {
      caja.innerHTML = "";
      return;
    }
    caja.innerHTML = `
      ${disponibles.map((a) => `
        <button type="button" class="sel-card ${adicionales.has(a.id) ? "activo" : ""}" data-id="${a.id}">
          <div class="sel-titulo">${adicionales.has(a.id) ? "✓ " : ""}${escapeHtml(a.nombre)}</div>
          <div class="sel-meta">+${usd(a.precio)} · +${duracionTxt(a.duracion_min)}</div>
        </button>`).join("")}`;
    $$("#paso3 .sel-card").forEach((card) => {
      card.onclick = () => {
        const id = Number(card.dataset.id);
        if (adicionales.has(id)) adicionales.delete(id); else adicionales.add(id);
        slot = null;
        pintarPaso3(); pintarPaso4(); recargarHorarios(); actualizar();
      };
    });
  }

  // ---------- Paso 4: especialista ----------
  function especialistasAptas() {
    if (!servicio) return [];
    const necesarios = new Set([servicio.id, ...adicionales]);
    return empleados.filter((emp) =>
      necesarios.size <= (emp.servicio_ids || []).filter((s) => necesarios.has(s)).length
    );
  }

  function pintarPaso4() {
    const caja = $("#paso4 .paso-contenido");
    const aptas = especialistasAptas();
    if (!servicio) { caja.innerHTML = ""; return; }
    if (!aptas.length) {
      caja.innerHTML = `
        <div class="vacio">Ninguna especialista realiza esta combinación de servicios.</div>`;
      return;
    }
    if (aptas.length === 1 && empleadoId !== aptas[0].id) {
      empleadoId = aptas[0].id; slot = null;
    } else if (empleadoId && !aptas.some((e) => e.id === empleadoId)) {
      empleadoId = null; slot = null;
    }

    caja.innerHTML = `
      <div class="chips">
        ${aptas.map((e) => `
          <button type="button" class="chip ${empleadoId === e.id ? "activo" : ""}" data-id="${e.id}">
            ${escapeHtml(nombreCorto(e.nombre))}
          </button>`).join("")}
      </div>`;
    $$("#paso4 .chip").forEach((chip) => {
      chip.onclick = () => {
        empleadoId = Number(chip.dataset.id);
        slot = null;
        pintarPaso4(); recargarHorarios(); actualizar();
      };
    });
  }

  // ---------- Paso 5: día y hora ----------
  const cajaDia = $("#paso5 .paso-contenido");
  cajaDia.innerHTML = `<div id="sel-dia"></div><p class="nota oculto" id="nota-continua"></p><div id="sel-hora" style="margin-top:6px"></div><div id="paso-agregar"></div>`;
  const selectorDia = crearSelectorDia($("#sel-dia"), fecha, (nueva) => {
    fecha = nueva; slot = null;
    selectorDia.actualizar(nueva);
    recargarHorarios(); actualizar();
  }, archivar ? { maximo: ayer } : { noRetroceder: true });
  const horarios = crearHorarios($("#sel-hora"), "Elige servicio y especialista para ver los horarios.");

  // Huecos ya elegidos por otros servicios con la MISMA especialista
  function ocupadosDraft() {
    return items
      .filter((it) => it.empleadoId === empleadoId && it.slot)
      .map((it) => ({ inicio: it.slot.inicio, fin: it.slot.fin }));
  }

  // Hora en la que continuaría la reserva: cuando termina TODO lo ya agregado.
  function finBloque() {
    if (!items.length) return null;
    return items.reduce(
      (max, it) => (new Date(it.slot.fin) > new Date(max) ? it.slot.fin : max),
      items[0].slot.fin
    );
  }

  // Arranques combinados: si el servicio en curso es Pestañas y ya hay una
  // Pedicura en la reserva (o al revés), puede ir a la misma hora que ella.
  function iniciosCombinados() {
    if (!items.length || !servicio) return [];
    return items
      .filter((it) => combinables(servicio.categoria, it.servicio.categoria))
      .map((it) => it.slot.inicio);
  }

  // Inicios exactos que se piden a la API aunque no caigan en la rejilla de
  // 15 min: el final del bloque y las horas combinadas.
  function continuaciones() {
    const fin = finBloque();
    return [...new Set([...(fin ? [fin] : []), ...iniciosCombinados()])];
  }

  function pintarNotaContinua() {
    const nota = $("#nota-continua");
    if (!nota) return;
    const fin = finBloque();
    if (!items.length || !servicio || !fin) { nota.classList.add("oculto"); return; }
    const mismoDia = aISO(fecha) === fin.slice(0, 10);
    const combinable = servicio.categoria === "Pestañas";
    nota.textContent = mismoDia
      ? `La reserva puede continuar a las ${hora(fin)} o más tarde ese mismo día${combinable ? " (o a la hora de una Pedicura ya elegida, para combinarlas)" : ""}.`
      : "La reserva debe continuar el mismo día.";
    nota.classList.remove("oculto");
  }

  function recargarHorarios() {
    if (!servicio || !empleadoId) {
      horarios.limpiar("Elige servicio y especialista para ver los horarios.");
      pintarNotaContinua();
      return;
    }
    pintarNotaContinua();
    const fin = finBloque();
    if (fin && aISO(fecha) !== fin.slice(0, 10)) {
      horarios.limpiar("La reserva debe continuar el mismo día en que empieza. Elige ese día para ver las horas.");
      return;
    }
    horarios.cargar(
      () => consultaDisponibilidad({
        empleadoId, fecha, servicioId: servicio.id,
        adicionalIds: [...adicionales],
        incluirPasados: archivar,
        permitirInactivo: archivar,
        continuaciones: continuaciones(),
      }),
      slot?.inicio ?? null,
      (elegido) => { slot = elegido; actualizar(); },
      { desde: fin, incluir: iniciosCombinados() }
    );
  }

  // ---------- Botón: agregar otro servicio ----------
  function pintarAgregar() {
    const caja = $("#paso-agregar");
    if (!servicio) { caja.innerHTML = ""; return; }
    const completo = draftCompleto();
    const lleno = items.length >= MAX_SERVICIOS;
    caja.innerHTML = `
      <button class="btn btn-contorno btn-bloque" id="btn-agregar" type="button" ${!completo || lleno ? "disabled" : ""}>
        ＋ Agregar otro servicio
      </button>`;
    $("#btn-agregar").onclick = agregarServicio;
  }

  function agregarServicio() {
    if (!servicio || !empleadoId || !slot || items.length >= MAX_SERVICIOS) return;
    items = [...items, { servicio, subtipo, extras: [...adicionales], empleadoId, slot }];
    servicio = null; subtipo = null; adicionales = new Set();
    empleadoId = null; slot = null;
    pintarReserva(); pintarPasosServicio(); recargarHorarios(); actualizar();
  }

  // ---------- Notas ----------
  $("#paso-notas").innerHTML = `
    <div class="paso-titulo">Notas (opcional)</div>
    <textarea class="input" id="notas-cita" placeholder="Ej.: diseño floral, color rosa..."></textarea>`;

  // ---------- Resumen y botón ----------
  function totales() {
    const todos = items.concat(draftComoItem());
    const duracion = todos.reduce((a, it) => {
      const ex = it.extras.reduce((b, id) => b + (servicios.find((x) => x.id === id)?.duracion_min || 0), 0);
      return a + it.servicio.duracion_min + ex;
    }, 0);
    const precio = todos.reduce((a, it) => {
      const ex = it.extras.reduce((b, id) => b + Number(servicios.find((x) => x.id === id)?.precio || 0), 0);
      return a + Number(it.servicio.precio) + ex;
    }, 0);
    return { todos, duracion, precio };
  }

  // El borrador está completo solo si el servicio no exige subtipo o ya se
  // eligió (evita llegar al final con un 422 de la API).
  function draftCompleto() {
    return Boolean(servicio && empleadoId && slot && (!servicio.subtipos?.length || subtipo));
  }

  function draftComoItem() {
    return draftCompleto()
      ? [{ servicio, subtipo, extras: [...adicionales], empleadoId, slot }]
      : [];
  }

  // ---------- Moneda de cobro ----------
  function pintarMoneda() {
    const caja = $("#paso-moneda");
    if (!caja) return;
    if (tasaCup <= 0 && moneda === "CUP") moneda = "USD";
    const { precio } = totales();
    const totalCobro = convertirMoneda(precio, moneda, tasaCup);
    caja.innerHTML = `
      <div class="paso-titulo">Moneda de cobro</div>
      <div class="selector-moneda-bicolor">${selectorMoneda(moneda, { cupDeshabilitada: tasaCup <= 0 })}</div>
      <p class="nota" style="margin:8px 0 0">
        ${moneda === "CUP"
          ? `Se cobrará en CUP con la tasa 1 USD = ${tasaCup.toLocaleString("en-US", {
              maximumFractionDigits: 4,
            })} CUP: <b>${importe(totalCobro, "CUP")} CUP</b> (${usd(precio)} USD).`
          : `Se cobrará en USD: <b>${importe(totalCobro, "USD")} USD</b>.`}
        ${tasaCup <= 0
          ? `<br/>El administrador aún no configuró la tasa del CUP.`
          : `<br/>La tasa la configura el administrador en el Panel de control.`}
      </p>`;
    conectarSelectorMoneda(caja, (nuevaMoneda) => {
      moneda = nuevaMoneda;
      pintarMoneda();
      actualizar();
    });
  }

  // ---------- Stepper vertical ----------
  // Cada item del stepper ES el paso del formulario: el círculo y la etiqueta
  // quedan junto a su contenido, unidos por una línea vertical. Se marca como
  // completado, activo o pendiente según el estado de la reserva.
  function pintarStepper() {
    const sinAdicionales = !servicio || !servicios.some(
      (x) => x.es_adicional && compatible(servicio, x)
    );
    // El paso de subtipo solo existe cuando el servicio elegido lo requiere.
    const conSubtipos = Boolean(servicio?.subtipos?.length);
    const seccionSubtipo = $("#paso-subtipo");
    seccionSubtipo.classList.toggle("oculto", !conSubtipos);
    if (!conSubtipos) {
      seccionSubtipo.classList.remove("hecho", "activo");
      seccionSubtipo.removeAttribute("aria-current");
    }

    const pasos = [
      { el: $("#paso1"), hecho: Boolean(clienteId) },
      { el: $("#paso2"), hecho: Boolean(servicio) },
    ];
    if (conSubtipos) {
      pasos.push({ el: seccionSubtipo, hecho: Boolean(subtipo) });
    }
    pasos.push(
      // Los adicionales son opcionales: listos al elegir especialista (o de
      // entrada si el servicio no tiene adicionales compatibles).
      { el: $("#paso3"), hecho: Boolean(servicio && (sinAdicionales || empleadoId)) },
      { el: $("#paso4"), hecho: Boolean(servicio && empleadoId) },
      { el: $("#paso5"), hecho: Boolean(slot) },
      { el: $("#paso6"), hecho: Boolean(clienteId && (items.length > 0 || draftCompleto())) },
    );
    let activo = pasos.findIndex((p) => !p.hecho);
    if (activo < 0) activo = pasos.length - 1;
    // Si ya hay servicios en la reserva y el borrador está vacío, el paso
    // siguiente es confirmar (o elegir otro servicio para seguir agregando).
    if (items.length > 0 && !servicio && !empleadoId && !slot) {
      activo = pasos.length - 1;
    }

    pasos.forEach((p, i) => {
      if (!p.el) return;
      p.el.classList.toggle("hecho", p.hecho);
      p.el.classList.toggle("activo", i === activo);
      const circulo = $(".stepper-circulo", p.el);
      if (circulo) circulo.textContent = p.hecho ? "✓" : String(i + 1);
      if (i === activo) p.el.setAttribute("aria-current", "step");
      else p.el.removeAttribute("aria-current");
    });
  }

  function actualizar() {
    const { todos, duracion, precio } = totales();
    pintarStepper();

    // El botón de agregar otro servicio habilita solo con el borrador completo
    // (servicio + especialista + hora) y si la reserva aún no está llena.
    const btnAgregar = $("#btn-agregar");
    if (btnAgregar) {
      btnAgregar.disabled = !draftCompleto() || items.length >= MAX_SERVICIOS;
    }

    const partes = todos.map((it) => {
      const ex = extrasNombre(it.extras);
      return `<div class="linea">${hora(it.slot.inicio)} · ${escapeHtml(it.servicio.nombre)}${textoSubtipo(it.subtipo) ? ` (${escapeHtml(textoSubtipo(it.subtipo))})` : ""}${ex.length ? ` + ${escapeHtml(ex.join(", "))}` : ""} — ${escapeHtml(nombreEmpleado(it.empleadoId))}</div>`;
    });
    if (todos.length) {
      const totalCobro = convertirMoneda(precio, moneda, tasaCup);
      partes.push(`<div class="linea"><b>Total:</b> ${duracionTxt(duracion)} · ${importe(totalCobro, moneda)} ${etiquetaMoneda(moneda)}</div>`);
      partes.push(`<div class="linea"><b>Fecha:</b> ${escapeHtml(etiqueta(fecha))}</div>`);
    }
    $("#resumen-final").innerHTML = partes.length
      ? `<div class="resumen-caja">${partes.join("")}</div>` : "";

    pintarMoneda();

    $("#btn-agendar").disabled = agendando || !(clienteId && todos.length > 0);
    $("#btn-agendar").textContent = agendando
      ? (archivar ? "Archivando…" : "Agendando…")
      : archivar
        ? (todos.length > 1 ? `Archivar reserva (${todos.length} servicios)` : "Archivar cita")
        : todos.length > 1 ? `Agendar reserva (${todos.length} servicios)` : "Agendar cita";
  }

  $("#btn-agendar").onclick = async () => {
    if (agendando) return;
    const { todos, duracion, precio } = totales();
    if (!clienteId || !todos.length) return;
    const error = $("#error-cita");
    error.classList.add("oculto");
    agendando = true;
    actualizar();
    const notas = $("#notas-cita").value.trim() || null;
    try {
      if (archivar) {
        await post("/citas/archivar", {
          cliente_id: clienteId,
          notas,
          items: todos.map((it) => ({
            empleado_id: it.empleadoId,
            servicio_id: it.servicio.id,
            adicional_ids: it.extras,
            subtipo: it.subtipo || null,
            inicio: it.slot.inicio,
            moneda,
          })),
        });
      } else if (todos.length === 1) {
        const it = todos[0];
        await post("/citas", {
          cliente_id: clienteId,
          empleado_id: it.empleadoId,
          servicio_id: it.servicio.id,
          adicional_ids: it.extras,
          subtipo: it.subtipo || null,
          inicio: it.slot.inicio,
          moneda,
          notas,
        });
      } else {
        await post("/citas/grupo", {
          cliente_id: clienteId,
          notas,
          items: todos.map((it) => ({
            empleado_id: it.empleadoId,
            servicio_id: it.servicio.id,
            adicional_ids: it.extras,
            subtipo: it.subtipo || null,
            inicio: it.slot.inicio,
            moneda,
          })),
        });
      }
      const titulo = archivar
        ? (todos.length > 1 ? "Reserva archivada" : "Cita archivada")
        : todos.length > 1 ? "Reserva agendada" : "Cita agendada";

      await mostrarExitoCita({
        titulo,
        cliente: clienteNombre || "Clienta",
        fecha: etiqueta(fecha),
        items: todos.map((it) => {
          const extras = extrasNombre(it.extras);
          const detalle = [
            nombreCorto(nombreEmpleado(it.empleadoId)),
            textoSubtipo(it.subtipo),
            extras.length ? `+ ${extras.join(", ")}` : "",
          ].filter(Boolean).join(" · ");
          return {
            hora: hora(it.slot.inicio),
            servicio: it.servicio.nombre,
            detalle,
          };
        }),
        duracion: duracionTxt(duracion),
        total: precio,
        totalMoneda: convertirMoneda(precio, moneda, tasaCup),
        moneda,
        archivada: archivar,
      });
      location.hash = "#/agenda";
    } catch (e) {
      error.textContent = `${archivar ? "No se pudo archivar" : "No se pudo agendar"}: ${e.message}`;
      error.classList.remove("oculto");
      agendando = false;
      actualizar();
      recargarHorarios();
    }
  };

  pintarPaso1();
  pintarReserva();
  pintarPasosServicio();
  pintarNotaContinua();
  actualizar();
}
