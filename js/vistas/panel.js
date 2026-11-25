// Panel de control del superadministrador.
// Reúne los conteos del salón, la gestión de usuarios, las citas completadas
// (reabrir o eliminar) y el borrado masivo de datos de citas.
// Equivalente a src/app/panel/index.tsx de salon_app.

import { del, get, patch } from "../api.js?v=49";
import { usuario as usuarioActual } from "../auth.js?v=52";
import { animarCifras } from "../contador.js?v=2";
import { icono } from "../iconos.js?v=64";
import { confirmarPeligro } from "../modal-confirmar.js?v=1";
import { $, $$, aviso, escapeHtml, fechaCorta, hora, importe, etiquetaMoneda } from "../util.js?v=54";

const ETIQUETA_ROL = {
  superadmin: "Superadmin",
  admin: "Administrador",
  usuario: "Usuario",
};

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
  {
    id: "completadas", etiqueta: "Completadas", vacio: "completadas",
    detalle: "Cobradas y cerradas", ico: "check",
  },
  {
    id: "canceladas", etiqueta: "Canceladas", vacio: "canceladas",
    detalle: "Fuera de la agenda", ico: "equis",
  },
  {
    id: "archivadas", etiqueta: "Archivadas", vacio: "completadas archivadas",
    detalle: "Completadas ocultas", ico: "archivo",
  },
  {
    id: "reprogramadas", etiqueta: "Reprogramadas", vacio: "completadas reprogramadas",
    detalle: "Movidas a otra fecha", ico: "repetir",
  },
];

function categoriaActual(id) {
  return CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[0];
}

/** Selector visual de categoría: tarjetas de radio, no un desplegable. */
function selectorCategorias(actual) {
  return `
    <div class="panel-cats" role="radiogroup" aria-label="Categoría de citas">
      ${CATEGORIAS.map((c) => `
        <label class="panel-cat">
          <input type="radio" name="panel-categoria" value="${c.id}"
            ${c.id === actual ? "checked" : ""} />
          <span class="panel-cat-cuerpo">
            <span class="panel-cat-ico">${icono[c.ico](16)}</span>
            <span class="panel-cat-txt">
              <b>${escapeHtml(c.etiqueta)}</b>
              <small>${escapeHtml(c.detalle)}</small>
            </span>
            <span class="panel-cat-marca" aria-hidden="true">${icono.check(12)}</span>
          </span>
        </label>`).join("")}
    </div>`;
}

/** Estado vacío con icono para el buscador de citas. */
function estadoVacio(ico, titulo, detalle) {
  return `
    <div class="panel-vacio">
      <span class="panel-vacio-ico">${ico}</span>
      <b>${escapeHtml(titulo)}</b>
      <span>${escapeHtml(detalle)}</span>
    </div>`;
}

/** "hace 3 min" a partir de la hora del servidor y la de la actividad. */
function haceTiempo(iso, ahora) {
  if (!iso) return "sin actividad";
  const segundos = Math.max(0, (new Date(ahora) - new Date(iso)) / 1000);
  if (segundos < 60) return "ahora mismo";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

/** "hoy, 09:15" o "22/11/2026, 18:40" en la hora del dispositivo. */
function fechaHoraCorta(iso) {
  if (!iso) return "nunca";
  const fecha = new Date(iso);
  const textoHora = fecha.toLocaleTimeString("es-ES", {
    hour: "2-digit", minute: "2-digit",
  });
  if (fecha.toDateString() === new Date().toDateString()) {
    return `hoy, ${textoHora}`;
  }
  return `${fecha.toLocaleDateString("es-ES")}, ${textoHora}`;
}

function iniciales(nombre) {
  const partes = String(nombre || "?").trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
}

/** Tarjeta pequeña de resumen de la sección de accesos. */
function statAcceso(ico, valor, etiqueta, clase = "") {
  return `
    <div class="acceso-stat ${clase}">
      <span class="acceso-stat-ico">${ico}</span>
      <span>
        <b>${escapeHtml(String(valor))}</b>
        <small>${escapeHtml(etiqueta)}</small>
      </span>
    </div>`;
}

/**
 * Texto del estado de una cuenta. Si nunca se registró un inicio de sesión,
 * muestra la última actividad para no confundirla con una cuenta sin uso.
 */
function detalleAcceso(u, ahora) {
  if (u.en_linea) return `Activo ${haceTiempo(u.ultima_actividad, ahora)}`;
  if (u.ultimo_acceso) {
    return `Último inicio de sesión: ${fechaHoraCorta(u.ultimo_acceso)}`;
  }
  if (u.ultima_actividad) {
    return `Sin inicio de sesión registrado · última actividad ${haceTiempo(u.ultima_actividad, ahora)}`;
  }
  return "Sin inicio de sesión registrado";
}

function filaUsuarioAcceso(u, ahora) {
  const soyYo = usuarioActual?.id === u.id;
  const detalle = detalleAcceso(u, ahora);
  return `
    <div class="acceso-fila ${u.en_linea ? "en-linea" : ""} ${u.activo ? "" : "inactiva"}">
      <span class="acceso-avatar">
        ${escapeHtml(iniciales(u.nombre))}
        <span class="acceso-punto ${u.en_linea ? "on" : ""}" aria-hidden="true"></span>
      </span>
      <span class="acceso-datos">
        <span class="acceso-nombre">
          ${escapeHtml(u.nombre)}
          ${soyYo ? `<span class="badge badge-dorado">Tú</span>` : ""}
          ${u.activo ? "" : `<span class="badge badge-rojo">Inactivo</span>`}
        </span>
        <span class="acceso-meta">
          @${escapeHtml(u.usuario || "sin usuario")} · ${escapeHtml(ETIQUETA_ROL[u.rol] || u.rol)}
        </span>
      </span>
      <span class="acceso-estado ${u.en_linea ? "on" : ""}">
        <b>${u.en_linea ? "En línea" : "Desconectado"}</b>
        <small>${escapeHtml(detalle)}</small>
      </span>
      <span class="acceso-hoy" title="Inicios de sesión hoy">
        <b>${u.accesos_hoy}</b>
        <small>${u.accesos_hoy === 1 ? "acceso hoy" : "accesos hoy"}</small>
      </span>
    </div>`;
}

export async function render(raiz) {
  let resumen = null;
  let accesos = null;
  let configMoneda = null;
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
          <h2>Tasa de cambio USD → CUP</h2>
          <p>Con esta tasa se calcula lo que paga la clienta cuando elige CUP. Cada cita guarda la tasa del momento en que se agendó o cambió de moneda.</p>
        </div>
        <span class="badge badge-dorado" id="panel-tasa-actual">Cargando…</span>
      </div>
      <form id="panel-tasa-form" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="campo" style="flex:1;min-width:190px;margin:0">
          <label class="etiqueta" for="panel-tasa">CUP por 1 USD</label>
          <input class="input" id="panel-tasa" type="number" inputmode="decimal"
            min="0.0001" step="0.0001" required />
        </div>
        <button class="btn btn-dorado" id="panel-tasa-guardar" type="submit">
          ${icono.dolar(15)} Guardar tasa
        </button>
      </form>
      <p class="nota" id="panel-tasa-info" style="margin:8px 0 0">
        Ejemplo: si la tasa es 500, una cita de $10.00 USD se cobra en $5,000.00 CUP.
      </p>
    </div>

    <div class="dash-card panel-accesos-card">
      <div class="dash-cab">
        <div>
          <h2>Control de acceso</h2>
          <p>Quién está en línea y cuántas veces se ha entrado hoy. El contador se reinicia a las 0:00.</p>
        </div>
        <div class="acceso-cab-acciones">
          <button class="btn btn-mini btn-suave" id="panel-accesos-refresh" type="button">
            ${icono.repetir(14)} Actualizar
          </button>
          <a class="btn btn-mini btn-contorno" href="#/usuarios">
            ${icono.personas(14)} Gestionar usuarios
          </a>
        </div>
      </div>
      <div id="panel-accesos">
        <div class="dash-vacio">Cargando accesos…</div>
      </div>
    </div>

    <div class="dash-card">
      <div class="dash-cab">
        <div>
          <h2>Buscar citas</h2>
          <p>Filtra por categoría y busca la cita que quieras reabrir o eliminar.</p>
        </div>
        <span class="contador" id="panel-contador" aria-live="polite"></span>
      </div>
      <form class="panel-filtro" id="panel-filtro">
        <div class="panel-cats-cab">
          <span class="panel-filtro-etq">Categoría</span>
          <span class="panel-filtro-ayuda">Elige qué citas quieres revisar</span>
        </div>
        ${selectorCategorias(categoria)}
        <div class="panel-busqueda">
          <div class="campo-ico panel-filtro-campo">
            ${icono.lupa()}
            <input class="input" id="panel-buscar" autocomplete="off"
              aria-label="Buscar citas por clienta, servicio o especialista"
              placeholder="Clienta, servicio o especialista" />
          </div>
          <div class="panel-filtro-botones">
            <button class="btn btn-dorado" id="panel-buscar-btn" type="submit">
              ${icono.lupa(16)} Buscar
            </button>
            <button class="btn btn-suave" id="panel-limpiar" type="button">Limpiar</button>
          </div>
        </div>
      </form>
      <div id="panel-citas" aria-live="polite">
        ${estadoVacio(
          icono[CATEGORIAS[0].ico](24),
          "Citas completadas",
          "Escribe una clienta, servicio o especialista y pulsa Buscar. También puedes buscar sin escribir nada."
        )}
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
  const $refrescarAccesos = $("#panel-accesos-refresh");
  const $citas = $("#panel-citas");
  const $contador = $("#panel-contador");
  const $filtro = $("#panel-filtro");
  const $categorias = $$('input[name="panel-categoria"]', $filtro);
  const $buscar = $("#panel-buscar");
  const $buscarBtn = $("#panel-buscar-btn");
  const $limpiar = $("#panel-limpiar");
  const $borrarTodo = $("#panel-borrar-todo");
  const $tasaForm = $("#panel-tasa-form");
  const $tasaInput = $("#panel-tasa");
  const $tasaActual = $("#panel-tasa-actual");
  const $tasaInfo = $("#panel-tasa-info");
  const $tasaGuardar = $("#panel-tasa-guardar");

  function pintarResumen() {
    const r = resumen;
    const cup = Number(r.ingresos_completados_cup || 0);
    $kpis.innerHTML = [
      kpi("Usuarios", r.usuarios, `${r.usuarios_activos} activos`, icono.personas(17), true),
      kpi("Clientas", r.clientes, "en la base de datos", icono.personas(17)),
      kpi(
        "Citas completadas",
        r.citas_completadas,
        cup
          ? `${importe(r.ingresos_completados, "USD")} USD + ${importe(cup, "CUP")} CUP`
          : `${importe(r.ingresos_completados, "USD")} USD facturados`,
        icono.check(17),
        true
      ),
      kpi("Próximas citas", r.citas_programadas, `${r.citas_canceladas} canceladas`, icono.calendario(17)),
      kpi("Servicios", r.servicios_activos, "activos en el catálogo", icono.etiqueta(17)),
      kpi("Productos", r.productos_activos, `${r.productos_bajo_stock} con stock bajo`, icono.caja(17)),
      kpi("Empleadas", r.empleadas_activas, "activas", icono.usuario(17)),
      kpi("Avisos", r.notificaciones_sin_leer, "sin leer", icono.campana(17)),
    ].join("");

    animarCifras($kpis);
  }

  function pintarMoneda() {
    if (!configMoneda) return;
    const tasa = Number(configMoneda.tasa_cambio_cup || 0);
    $tasaInput.value = String(tasa);
    $tasaActual.textContent = `${tasa.toLocaleString("en-US", {
      maximumFractionDigits: 4,
    })} CUP / USD`;
    const cuando = configMoneda.actualizado_en
      ? ` Última actualización: ${fechaHoraCorta(configMoneda.actualizado_en)}${
          configMoneda.actualizado_por_nombre
            ? ` por ${configMoneda.actualizado_por_nombre}`
            : ""
        }.`
      : "";
    $tasaInfo.textContent =
      `Ejemplo: una cita de $10.00 USD se cobra en ${importe(10 * tasa, "CUP")} CUP.${cuando}`;
  }

  async function cargarMoneda() {
    try {
      configMoneda = await get("/panel/configuracion");
      pintarMoneda();
    } catch (e) {
      $tasaActual.textContent = "No disponible";
      $tasaInfo.textContent = e.message || "No se pudo cargar la tasa de cambio.";
    }
  }

  function pintarAccesos() {
    if (!accesos) return;
    $accesos.innerHTML = `
      <div class="acceso-resumen" aria-live="polite">
        ${statAcceso(icono.usuario(16), accesos.en_linea, "En línea", "en-linea")}
        ${statAcceso(icono.usuario(16), accesos.desconectados, "Desconectados", "fuera")}
        ${statAcceso(icono.reloj(16), accesos.accesos_hoy, "Accesos hoy", "total")}
      </div>
      <div class="acceso-lista">
        ${accesos.usuarios.map((u) => filaUsuarioAcceso(u, accesos.ahora)).join("")}
      </div>
      <p class="acceso-pie">
        Actualizado ${escapeHtml(fechaHoraCorta(accesos.ahora))} ·
        En línea = actividad en los últimos 5 minutos.
      </p>`;
  }

  async function cargarAccesos(silencioso = false) {
    if (!silencioso) {
      $accesos.innerHTML = `<div class="dash-vacio">Cargando accesos…</div>`;
    }
    try {
      accesos = await get("/panel/accesos");
      pintarAccesos();
    } catch (e) {
      // Una actualización automática fallida no borra los datos ya visibles.
      if (silencioso) return;
      $accesos.innerHTML = estadoVacio(
        icono.equis(24),
        "No se pudo cargar el control de acceso",
        e.message || "Inténtalo de nuevo en unos segundos."
      );
    }
  }

  function usuarioEtiqueta(c) {
    return c.completada_por_nombre || c.creado_por_nombre || "Sin registro";
  }

  function pintarCitas() {
    const cat = categoriaActual(categoria);
    if (!buscado) {
      $contador.textContent = "";
      $citas.innerHTML = estadoVacio(
        icono[cat.ico](24),
        `Citas ${cat.vacio}`,
        "Escribe una clienta, servicio o especialista y pulsa Buscar. También puedes buscar sin escribir nada."
      );
      return;
    }

    $contador.textContent = `${completadas.total} ${
      completadas.total === 1 ? "cita" : "citas"
    } · ${cat.etiqueta}`;

    if (!completadas.citas.length) {
      $citas.innerHTML = filtro
        ? estadoVacio(
          icono.lupa(24),
          "Sin coincidencias",
          `No encontramos citas ${cat.vacio} para “${filtro}”.`
        )
        : estadoVacio(
          icono.lupa(24),
          `Sin citas ${cat.vacio}`,
          "No hay resultados en este período. Prueba con otra categoría o cambia la búsqueda."
        );
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
            <b style="color:var(--gold-dark)">${importe(c.precio_total_moneda ?? c.precio_total, c.moneda)} ${etiquetaMoneda(c.moneda)}</b>
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
    $citas.innerHTML = estadoVacio(
      icono.lupa(24),
      "Buscando citas…",
      "Espera un momento mientras revisamos el historial."
    );
    try {
      completadas = await get(
        `/panel/citas-completadas?categoria=${categoria}&limit=100&q=${encodeURIComponent(texto)}`
      );
    } catch (e) {
      completadas = { total: 0, citas: [] };
      $citas.innerHTML = estadoVacio(
        icono.equis(24),
        "No se pudieron buscar las citas",
        e.message || "Inténtalo de nuevo en unos segundos."
      );
      return;
    } finally {
      $buscarBtn.disabled = false;
    }
    pintarCitas();
  }

  async function cargar() {
    await Promise.all([
      cargarResumen(),
      cargarMoneda(),
      cargarAccesos(),
      buscado ? buscarCitas() : null,
    ]);
  }

  function datosCita(c) {
    return [
      { icono: icono.usuario(15), texto: c.cliente_nombre },
      { icono: icono.calendario(15), texto: `${fechaCorta(c.inicio)} · ${hora(c.inicio)}–${hora(c.fin)}` },
      { icono: icono.etiqueta(15), texto: c.servicio_nombre },
      { icono: icono.usuario(15), texto: `Con ${c.empleado_nombre}` },
      { icono: icono.dolar(15), texto: `${importe(c.precio_total_moneda ?? c.precio_total, c.moneda)} ${etiquetaMoneda(c.moneda)}` },
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

  $tasaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const valor = Number($tasaInput.value);
    if (!Number.isFinite(valor) || valor <= 0) {
      aviso("Escribe una tasa mayor que cero.", "error");
      return;
    }
    $tasaGuardar.disabled = true;
    try {
      configMoneda = await patch("/panel/configuracion", {
        tasa_cambio_cup: valor,
      });
      pintarMoneda();
      aviso("Tasa de cambio actualizada", "ok");
    } catch (e) {
      aviso(e.message || "No se pudo guardar la tasa.", "error");
    } finally {
      $tasaGuardar.disabled = false;
    }
  });

  $filtro.addEventListener("submit", (e) => {
    e.preventDefault();
    filtro = $buscar.value;
    buscarCitas();
  });

  $categorias.forEach((radio) => {
    radio.onchange = () => {
      if (!radio.checked) return;
      categoria = radio.value;
      // Cambiar de categoría no ejecuta la búsqueda: solo se verá al pulsar Buscar.
      completadas = { total: 0, citas: [] };
      buscado = false;
      pintarCitas();
    };
  });

  $limpiar.onclick = () => {
    filtro = "";
    $buscar.value = "";
    categoria = "completadas";
    $categorias.forEach((radio) => {
      radio.checked = radio.value === categoria;
    });
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
        { icono: icono.check(15), texto: `${resumen?.citas_completadas ?? 0} completadas · ${importe(resumen?.ingresos_completados ?? 0, "USD")} USD${Number(resumen?.ingresos_completados_cup || 0) ? ` + ${importe(resumen?.ingresos_completados_cup, "CUP")} CUP` : ""}` },
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

  $refrescarAccesos.onclick = async () => {
    $refrescarAccesos.disabled = true;
    try {
      await cargarAccesos();
    } finally {
      $refrescarAccesos.disabled = false;
    }
  };

  // Mientras esta vista siga montada, actualiza presencia y accesos cada minuto.
  const refrescoAccesos = setInterval(() => {
    if (!document.body.contains($accesos)) {
      clearInterval(refrescoAccesos);
      return;
    }
    if (document.visibilityState === "visible") cargarAccesos(true);
  }, 60000);

  await cargar();
}
