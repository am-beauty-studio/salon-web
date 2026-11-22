// Panel de control del superadministrador.
// Reúne los conteos del salón, la gestión de usuarios, las citas completadas
// (reabrir o eliminar) y el borrado masivo de datos de citas.
// Equivalente a src/app/panel/index.tsx de salon_app.

import { del, get, patch } from "../api.js?v=49";
import { animarCifras } from "../contador.js?v=1";
import { icono } from "../iconos.js?v=64";
import { confirmarPeligro } from "../modal-confirmar.js?v=1";
import { $, aviso, escapeHtml, fechaCorta, hora, usd } from "../util.js?v=52";

function kpi(titulo, valor, sub, ico, destacado = false) {
  return `
    <div class="dash-kpi ${destacado ? "destacado" : ""}">
      <span class="dash-kpi-ico">${ico}</span>
      <span class="dash-kpi-titulo">${escapeHtml(titulo)}</span>
      <strong class="dash-kpi-valor" data-contar="${escapeHtml(String(valor))}">${escapeHtml(String(valor))}</strong>
      <span class="dash-kpi-sub">${escapeHtml(sub)}</span>
    </div>`;
}

const CATEGORIAS = [
  { id: "completadas", etiqueta: "Completadas", vacio: "completadas" },
  { id: "canceladas", etiqueta: "Canceladas", vacio: "canceladas" },
  { id: "archivadas", etiqueta: "Completadas archivadas", vacio: "completadas archivadas" },
  { id: "reprogramadas", etiqueta: "Completadas reprogramadas", vacio: "completadas reprogramadas" },
];

function categoriaActual(id) {
  return CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[0];
}

function filaAcceso(href, ico, titulo, detalle) {
  return `
    <a class="lista-fila" href="${href}">
      <span class="ico-lista" style="display:inline-flex">${ico}</span>
      <span class="lista-principal">
        ${escapeHtml(titulo)}
        <br/><span class="lista-secundario">${escapeHtml(detalle)}</span>
      </span>
      <span class="lista-secundario" aria-hidden="true">›</span>
    </a>`;
}

export async function render(raiz) {
  let resumen = null;
  let completadas = { total: 0, citas: [] };
  let filtro = "";
  let categoria = "completadas";
  let buscado = false;

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${icono.escudo(22)}</span>
      <h1 class="vista-titulo">Panel de control</h1>
      <span class="badge badge-dorado">Superadmin</span>
    </div>
    <p class="lista-secundario" style="margin:0 0 14px">
      Control total del salón: usuarios, citas completadas y mantenimiento de la base de datos.
    </p>

    <div class="dash-kpis" id="panel-kpis">
      <div class="dash-vacio">Cargando resumen…</div>
    </div>

    <div class="dash-card">
      <div class="dash-cab">
        <div>
          <h2>Accesos de control</h2>
          <p>La sección reservada para el superadministrador.</p>
        </div>
      </div>
      <div id="panel-accesos"></div>
    </div>

    <div class="dash-card">
      <div class="dash-cab">
        <div>
          <h2>Buscar citas</h2>
          <p>Filtra por categoría y busca la cita que quieras reabrir o eliminar.</p>
        </div>
        <span class="contador" id="panel-contador"></span>
      </div>
      <form class="panel-filtro" id="panel-filtro">
        <label class="panel-filtro-selector" for="panel-categoria">
          <span class="panel-filtro-etq">Categoría</span>
          <select class="input" id="panel-categoria">
            ${CATEGORIAS.map((c) => `
              <option value="${c.id}" ${c.id === categoria ? "selected" : ""}>
                ${escapeHtml(c.etiqueta)}
              </option>`).join("")}
          </select>
        </label>
        <div class="campo-ico panel-filtro-campo">
          ${icono.lupa()}
          <input class="input" id="panel-buscar" autocomplete="off"
            placeholder="Clienta, servicio o especialista" />
        </div>
        <div class="panel-filtro-botones">
          <button class="btn btn-dorado" id="panel-buscar-btn" type="submit">
            ${icono.lupa(16)} Buscar
          </button>
          <button class="btn btn-suave" id="panel-limpiar" type="button">Limpiar</button>
        </div>
      </form>
      <div id="panel-citas">
        <div class="dash-vacio">
          Elige una categoría, escribe una clienta, servicio o especialista y pulsa Buscar.
        </div>
      </div>
    </div>

    <div class="dash-card" style="border-color:rgba(190, 74, 87, .35);background:linear-gradient(0deg,rgba(190, 74, 87, .04),rgba(190, 74, 87, .04)),var(--card)">
      <div class="dash-cab">
        <div>
          <h2 style="color:var(--danger)">Zona de peligro</h2>
          <p>El borrado masivo no toca clientas, servicios, productos ni usuarios.</p>
        </div>
      </div>
      <div class="fila-btns" style="margin-top:0">
        <button class="btn btn-rojo" id="panel-borrar-todo" type="button">
          ${icono.papelera(16)} Borrar todos los datos de citas
        </button>
      </div>
    </div>`;

  const $kpis = $("#panel-kpis");
  const $accesos = $("#panel-accesos");
  const $citas = $("#panel-citas");
  const $contador = $("#panel-contador");
  const $filtro = $("#panel-filtro");
  const $categoriaSel = $("#panel-categoria");
  const $buscar = $("#panel-buscar");
  const $buscarBtn = $("#panel-buscar-btn");
  const $limpiar = $("#panel-limpiar");
  const $borrarTodo = $("#panel-borrar-todo");

  function pintarResumen() {
    const r = resumen;
    $kpis.innerHTML = [
      kpi("Usuarios", r.usuarios, `${r.usuarios_activos} activos`, icono.personas(17), true),
      kpi("Clientas", r.clientes, "en la base de datos", icono.personas(17)),
      kpi("Citas completadas", r.citas_completadas, `${usd(r.ingresos_completados)} facturados`, icono.check(17), true),
      kpi("Próximas citas", r.citas_programadas, `${r.citas_canceladas} canceladas`, icono.calendario(17)),
      kpi("Servicios", r.servicios_activos, "activos en el catálogo", icono.etiqueta(17)),
      kpi("Productos", r.productos_activos, `${r.productos_bajo_stock} con stock bajo`, icono.caja(17)),
      kpi("Empleadas", r.empleadas_activas, "activas", icono.usuario(17)),
      kpi("Avisos", r.notificaciones_sin_leer, "sin leer", icono.campana(17)),
    ].join("");

    $accesos.innerHTML = [
      filaAcceso("#/usuarios", icono.personas(), "Usuarios y roles",
        "Crear, editar, activar o desactivar cuentas"),
    ].join("");

    animarCifras($kpis);
  }

  function usuarioEtiqueta(c) {
    return c.completada_por_nombre || c.creado_por_nombre || "Sin registro";
  }

  function pintarCitas() {
    const cat = categoriaActual(categoria);
    if (!buscado) {
      $contador.textContent = "";
      $citas.innerHTML = `
        <div class="dash-vacio">
          Elige una categoría, escribe una clienta, servicio o especialista y pulsa Buscar.
        </div>`;
      return;
    }

    $contador.textContent = `${completadas.total} ${
      completadas.total === 1 ? "cita" : "citas"
    } · ${cat.etiqueta}`;

    if (!completadas.citas.length) {
      $citas.innerHTML = `<div class="dash-vacio">
        ${filtro
          ? `Sin citas ${cat.vacio} para “${escapeHtml(filtro)}”.`
          : `No hay citas ${cat.vacio}.`}
      </div>`;
      return;
    }

    const nota = completadas.citas.length < completadas.total
      ? `<div class="dash-vacio" style="padding:0 0 8px">
          Mostrando las ${completadas.citas.length} más recientes de ${completadas.total}.
          Afina la búsqueda para ver menos resultados.
        </div>`
      : "";

    $citas.innerHTML = nota + completadas.citas.map((c) => `
      <div class="lista-fila panel-cita-fila">
        <span class="lista-principal panel-cita-info">
          <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="ico-lista" style="display:inline-flex">${icono.usuario()}</span>
            ${escapeHtml(c.cliente_nombre)}
            ${c.estado === "cancelada"
              ? `<span class="badge badge-cancelada">Cancelada</span>`
              : `<span class="badge badge-completada">Completada</span>
                 ${c.archivada ? `<span class="badge badge-gris">Archivada</span>` : ""}
                 ${c.reprogramada ? `<span class="badge badge-dorado">Reprogramada</span>` : ""}`}
          </span>
          <span class="lista-secundario" style="display:block;margin-top:4px">
            ${fechaCorta(c.inicio)} · ${hora(c.inicio)}–${hora(c.fin)} ·
            ${escapeHtml(c.servicio_nombre)}
            ${c.adicionales.length
              ? ` <span class="badge badge-subtipo">+ ${escapeHtml(c.adicionales.join(", "))}</span>`
              : ""}
          </span>
          <span class="lista-secundario" style="display:block">
            Con ${escapeHtml(c.empleado_nombre)} ·
            <b style="color:var(--gold-dark)">${usd(c.precio_total)}</b>
          </span>
          <span class="lista-secundario" style="display:block">
            Etiqueta generada por <b>${escapeHtml(usuarioEtiqueta(c))}</b>
          </span>
        </span>
        <span class="panel-cita-acciones">
          ${c.estado === "completada" ? `
            <button class="btn btn-mini btn-suave-ok" type="button" data-reabrir="${c.id}">
              ${icono.repetir(14)} Reabrir
            </button>` : ""}
          <button class="btn btn-mini btn-suave-peligro" type="button" data-eliminar="${c.id}">
            ${icono.papelera(14)} Eliminar
          </button>
        </span>
      </div>`).join("");

    $citas.querySelectorAll("[data-reabrir]").forEach((boton) => {
      boton.onclick = () => reabrir(Number(boton.dataset.reabrir));
    });
    $citas.querySelectorAll("[data-eliminar]").forEach((boton) => {
      boton.onclick = () => eliminar(Number(boton.dataset.eliminar));
    });
  }

  async function cargarResumen() {
    resumen = await get("/panel/resumen");
    pintarResumen();
  }

  async function buscarCitas() {
    const texto = filtro.trim();
    buscado = true;
    $buscarBtn.disabled = true;
    $citas.innerHTML = `<div class="dash-vacio">Buscando citas…</div>`;
    try {
      completadas = await get(
        `/panel/citas-completadas?categoria=${categoria}&limit=100&q=${encodeURIComponent(texto)}`
      );
    } catch (e) {
      completadas = { total: 0, citas: [] };
      $citas.innerHTML = `<div class="dash-vacio">${escapeHtml(
        e.message || "No se pudieron buscar las citas."
      )}</div>`;
      return;
    } finally {
      $buscarBtn.disabled = false;
    }
    pintarCitas();
  }

  async function cargar() {
    await Promise.all([cargarResumen(), buscado ? buscarCitas() : null]);
  }

  function datosCita(c) {
    return [
      { icono: icono.usuario(15), texto: c.cliente_nombre },
      { icono: icono.calendario(15), texto: `${fechaCorta(c.inicio)} · ${hora(c.inicio)}–${hora(c.fin)}` },
      { icono: icono.etiqueta(15), texto: c.servicio_nombre },
      { icono: icono.usuario(15), texto: `Con ${c.empleado_nombre}` },
      { icono: icono.dolar(15), texto: `${usd(c.precio_total)} USD` },
      { icono: icono.etiqueta(15), texto: `Etiqueta generada por ${usuarioEtiqueta(c)}` },
    ];
  }

  async function reabrir(id) {
    const c = completadas.citas.find((x) => x.id === id);
    if (!c) return;
    const ok = await confirmarPeligro({
      titulo: "Reabrir cita completada",
      mensaje: "La cita volverá a la agenda como programada y su ganancia dejará de contar.",
      icono: icono.repetir(26),
      filas: datosCita(c),
      accion: "Sí, reabrir",
      aviso: "El inventario consumido por esta cita se devolverá al stock.",
    });
    if (!ok) return;
    try {
      const r = await patch(`/panel/citas/${id}/reabrir`, {});
      aviso(
        `Cita reabierta. ${r.lineas_eliminadas} línea(s) de ganancia eliminadas y ` +
        `${r.productos_restaurados} producto(s) restaurados.`,
        "ok"
      );
      await cargar();
    } catch (e) {
      aviso(e.message || "No se pudo reabrir la cita.", "error");
    }
  }

  async function eliminar(id) {
    const c = completadas.citas.find((x) => x.id === id);
    if (!c) return;
    const cancelada = c.estado === "cancelada";
    const ok = await confirmarPeligro({
      titulo: cancelada ? "Eliminar cita cancelada" : "Eliminar cita completada",
      mensaje: cancelada
        ? "Se borrará la cita cancelada de los reportes."
        : "Se borrará la cita y su ganancia de los reportes.",
      filas: datosCita(c),
      accion: "Sí, eliminar",
      aviso: "El inventario consumido se devolverá al stock. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    try {
      const r = await del(`/panel/citas/${id}`);
      aviso(
        `Cita eliminada. ${r.productos_restaurados} producto(s) restaurados al inventario.`,
        "ok"
      );
      await cargar();
    } catch (e) {
      aviso(e.message || "No se pudo eliminar la cita.", "error");
    }
  }

  $filtro.addEventListener("submit", (e) => {
    e.preventDefault();
    filtro = $buscar.value;
    buscarCitas();
  });

  $categoriaSel.onchange = () => {
    categoria = $categoriaSel.value;
    // Cambiar de categoría no ejecuta la búsqueda: solo se verá al pulsar Buscar.
    completadas = { total: 0, citas: [] };
    buscado = false;
    pintarCitas();
  };

  $limpiar.onclick = () => {
    filtro = "";
    $buscar.value = "";
    categoria = "completadas";
    $categoriaSel.value = categoria;
    completadas = { total: 0, citas: [] };
    buscado = false;
    pintarCitas();
    $buscar.focus();
  };

  $borrarTodo.onclick = async () => {
    const ok = await confirmarPeligro({
      titulo: "Borrar todos los datos de citas",
      mensaje: "Se eliminarán TODAS las citas del salón y sus datos derivados.",
      filas: [
        { icono: icono.calendario(15), texto: `${resumen?.citas ?? 0} citas en total` },
        { icono: icono.check(15), texto: `${resumen?.citas_completadas ?? 0} completadas · ${usd(resumen?.ingresos_completados ?? 0)}` },
        { icono: icono.reloj(15), texto: `${resumen?.citas_programadas ?? 0} programadas · ${resumen?.citas_canceladas ?? 0} canceladas` },
        { icono: icono.caja(15), texto: "El inventario consumido se devuelve al stock" },
        { icono: icono.personas(15), texto: "Se conservan clientas, servicios, productos y usuarios" },
      ],
      accion: "Sí, borrar todo",
      aviso: "Esta acción no se puede deshacer. Hazlo solo si quieres empezar de cero las citas.",
    });
    if (!ok) return;
    $borrarTodo.disabled = true;
    try {
      const r = await del("/panel/citas");
      aviso(
        `Se eliminaron ${r.citas_eliminadas} citas, ${r.lineas_eliminadas} líneas de ganancia ` +
        `y ${r.notificaciones_eliminadas} avisos.`,
        "ok"
      );
      await cargar();
    } catch (e) {
      aviso(e.message || "No se pudieron borrar las citas.", "error");
    } finally {
      $borrarTodo.disabled = false;
    }
  };

  await cargar();
}
