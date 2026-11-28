// Estadísticas (solo admin). Dashboard distinto al de barras de Ganancias.
// Carga USD y CUP a la vez: las cantidades de citas se muestran juntas y los
// importes siempre separados por moneda. El selector USD/CUP solo pertenece a
// la tarjeta "Recaudado por categoría".

import { get } from "../api.js?v=49";
import { animarCifras } from "../contador.js?v=3";
import {
  $, $$, aISO, escapeHtml, fechaCorta, sumarDias, sumarMeses, etiquetaSemana,
  tituloMes, tituloAnio, importe, mostrarCategoria,
} from "../util.js?v=56";
import { icoCategoria, icono } from "../iconos.js?v=65";

const ROSAS = [
  "#B25572", "#C06A86", "#CD7E97", "#D992A8",
  "#E3A6B9", "#EBBAC9", "#F2CCD8", "#F8DEE6",
];
const VIOLETAS = [
  "#65548F", "#74619D", "#8571AB", "#9682B9",
  "#A793C7", "#B8A5D5", "#C9B7E2", "#E1D7F0",
];

const monto = (valor, moneda = "USD") => importe(valor, moneda);
const numero = (valor) => Number(valor || 0);

/** Color distinto por categoría dentro de la paleta de cada moneda. */
function colorCategoria(moneda, indice) {
  const colores = moneda === "CUP" ? VIOLETAS : ROSAS;
  return colores[indice % colores.length];
}

function coloresPorCategoria(categorias, moneda) {
  const ordenadas = [...(categorias || [])].sort(
    (a, b) => numero(b.ingresos) - numero(a.ingresos)
  );
  return new Map(
    ordenadas.map((c, i) => [c.categoria, colorCategoria(moneda, i)])
  );
}

export async function render(raiz) {
  let periodo = "mes";
  let fecha = new Date();
  let datos = null;
  let observadorDonut = null;
  let observadorTendencia = null;
  let solicitud = 0;

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${icono.estadisticas(22)}</span>
      <h1 class="vista-titulo">Estadísticas</h1>
    </div>
    <div class="filtro-ganancias">
      <div class="filtro-etiqueta">Período</div>
      <div class="segmentado" role="tablist" aria-label="Período de las estadísticas">
        <button class="segmento" data-p="semana" type="button" role="tab">Semana</button>
        <button class="segmento activo" data-p="mes" type="button" role="tab">Mes</button>
        <button class="segmento" data-p="anio" type="button" role="tab">Año</button>
      </div>
      <div class="nav-fecha">
        <button class="nav-flecha" id="e-prev" type="button" aria-label="Período anterior">‹</button>
        <button class="nav-fecha-titulo" id="e-titulo" type="button"></button>
        <button class="nav-flecha" id="e-next" type="button" aria-label="Período siguiente">›</button>
      </div>
    </div>
    <div id="dash"></div>
    <p class="nota" style="text-align:center;margin-top:14px">
      Los importes se muestran por separado en USD y CUP. Las citas se cuentan
      una sola vez, sin distinguir la moneda en que se cobraron.
    </p>`;

  $$(".segmentado [data-p]").forEach((chip) => {
    chip.onclick = () => {
      periodo = chip.dataset.p;
      $$(".segmentado [data-p]").forEach((c) => {
        const activo = c.dataset.p === periodo;
        c.classList.toggle("activo", activo);
        c.setAttribute("aria-selected", activo ? "true" : "false");
      });
      cargar();
    };
  });

  $("#e-prev").onclick = () => mover(-1);
  $("#e-next").onclick = () => mover(1);
  $("#e-titulo").onclick = () => { fecha = new Date(); cargar(); };

  function mover(n) {
    if (periodo === "semana") {
      fecha = sumarDias(fecha, 7 * n);
    } else if (periodo === "mes") {
      fecha = sumarMeses(fecha, n);
    } else {
      fecha = new Date(fecha.getFullYear() + n, 0, 1);
    }
    cargar();
  }

  function pintarTitulo() {
    const titulo = periodo === "semana" ? etiquetaSemana(fecha)
      : periodo === "mes" ? tituloMes(fecha)
      : tituloAnio(fecha);
    $("#e-titulo").innerHTML = `${escapeHtml(titulo)}<span class="nav-sub">Toca para volver a hoy</span>`;
  }

  async function cargar() {
    pintarTitulo();
    if (observadorDonut) observadorDonut.disconnect();
    if (observadorTendencia) observadorTendencia.disconnect();
    $("#dash").innerHTML = `<div class="cargando">Cargando…</div>`;
    const actual = ++solicitud;
    try {
      const [usd, cup] = await Promise.all(["USD", "CUP"].map((moneda) =>
        get(`/finanzas/estadisticas?periodo=${periodo}&fecha=${aISO(fecha)}&moneda=${moneda}`)
      ));
      if (actual !== solicitud) return;
      // Compatibilidad con una API que aún no devuelve `estudio_libre` en
      // Estadísticas: ese dato ya existe en el resumen de Ganancias.
      if (usd.totales.estudio_libre == null || cup.totales.estudio_libre == null) {
        const [resumenUsd, resumenCup] = await Promise.all(["USD", "CUP"].map((moneda) =>
          get(`/finanzas/resumen?periodo=${periodo}&fecha=${aISO(fecha)}&moneda=${moneda}`)
        ));
        if (actual !== solicitud) return;
        usd.totales.estudio_libre = resumenUsd.totales.estudio_libre;
        cup.totales.estudio_libre = resumenCup.totales.estudio_libre;
      }
      datos = { USD: usd, CUP: cup };
      const $dash = $("#dash");
      $dash.innerHTML = dashboard(datos);
      animarCifras($dash);
      observadorDonut = observarDonut($dash);
      observadorTendencia = observarTendencia($dash);
    } catch (e) {
      if (actual !== solicitud) return;
      $("#dash").innerHTML = `
        <div class="tarjeta">
          <p class="error-txt">${escapeHtml(e.message || "No se pudieron cargar las estadísticas.")}</p>
        </div>`;
    }
  }

  cargar();
}

/**
 * El donut espera a entrar en pantalla para animarse. Mientras no se ve, el
 * anillo queda velado y la leyenda en espera; al visualizarse se dibuja y el
 * total empieza a contar.
 */
function observarDonut(dash) {
  const wraps = [...dash.querySelectorAll(".dash-donut-wrap")];
  if (!wraps.length) return null;

  const activar = (wrap) => {
    wrap.classList.remove("pendiente");
    const cifra = wrap.querySelector("[data-contar-diferido]");
    if (cifra) {
      cifra.dataset.contar = cifra.dataset.contarDiferido;
      delete cifra.dataset.contarDiferido;
      animarCifras(cifra.parentElement || wrap);
    }
  };

  if (!("IntersectionObserver" in window)) {
    wraps.forEach(activar);
    return null;
  }

  wraps.forEach((wrap) => wrap.classList.add("pendiente"));
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      activar(entrada.target);
      observador.unobserve(entrada.target);
    });
  }, { threshold: 0.3 });
  wraps.forEach((wrap) => observador.observe(wrap));
  return observador;
}

/**
 * Las gráficas de tendencia esperan a entrar en pantalla para animar sus
 * datos (trazos, puntos y barras).
 */
function observarTendencia(dash) {
  const charts = [...dash.querySelectorAll(".dash-chart-datos")];
  if (!charts.length) return null;

  const activar = (chart) => chart.classList.remove("pendiente");

  if (!("IntersectionObserver" in window)) {
    charts.forEach(activar);
    return null;
  }

  charts.forEach((chart) => chart.classList.add("pendiente"));
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      activar(entrada.target);
      observador.unobserve(entrada.target);
    });
  }, { threshold: 0.25 });
  charts.forEach((chart) => observador.observe(chart));
  return observador;
}

function dashboard(datos) {
  const usd = datos.USD;
  const cup = datos.CUP;
  const totalCitas = usd.totales.citas + cup.totales.citas;
  const totalCanceladas = numero(usd.totales.citas_canceladas)
    + numero(cup.totales.citas_canceladas);
  const servicios = combinarServicios(usd.por_servicio, cup.por_servicio);
  const principales = servicios.filter((x) => !x.es_adicional);
  const adicionales = servicios.filter((x) => x.es_adicional);
  const clientes = combinarClientes(usd.mejores_clientes, cup.mejores_clientes).slice(0, 5);
  const empleadas = combinarEmpleadas(usd.por_empleada, cup.por_empleada);

  return `
    <div class="dash-kpis">
      ${kpiMonedas(
        "dolar", "Recaudado por el estudio",
        monto(usd.totales.ingresos, "USD"), monto(cup.totales.ingresos, "CUP"),
        `Servicios completados en el período`,
        true
      )}
      ${kpiMonedas("grafico", "Libre para AM Luxury",
        monto(usd.totales.estudio_libre, "USD"),
        monto(cup.totales.estudio_libre, "CUP"),
        "sin incluir la reinversión")}
      ${kpi("calendario", "Citas completadas", String(totalCitas),
        `${totalCitas === 1 ? "1 cita" : `${totalCitas} citas`} en el período`)}
      ${kpi("equis", "Citas canceladas", String(totalCanceladas),
        `${totalCanceladas === 1 ? "1 cita" : `${totalCanceladas} citas`} en el período`)}
      ${kpiMonedas("porcentaje", "Para reinversión del estudio",
        monto(reinversionDe(usd), "USD"),
        monto(reinversionDe(cup), "CUP"),
        "parte del recaudado destinada al salón")}
      ${kpiMonedas("grafico", usd.periodo === "anio" ? "Mejor mes" : "Mejor día",
        mejorValor(usd, "USD"), mejorValor(cup, "CUP"),
        `${mejorEtiqueta(usd, "USD")} · ${mejorEtiqueta(cup, "CUP")}`)}
    </div>

    <div class="dash-card">
      <div class="dash-cab dash-cab-banda">
        <div class="dash-cab-titulo">
          <span class="dash-kpi-ico">${icono.estadisticas(16)}</span>
          <div>
            <h2>Tendencia del período</h2>
            <p>Recaudado por AM Luxury en las dos monedas y cantidad total de citas</p>
          </div>
        </div>
      </div>
      <div class="dash-leyenda dash-leyenda-tendencia">
        <span><i style="background:var(--gold)"></i>USD <span class="texto-usd">${monto(usd.totales.estudio, "USD")}</span></span>
        <span><i style="background:var(--violeta)"></i>CUP <span class="texto-cup">${monto(cup.totales.estudio, "CUP")}</span></span>
        <span><i style="background:var(--verde)"></i>${totalCitas} citas</span>
      </div>
      <div class="dash-tendencias">
        <div class="dash-tendencia">
          <div class="dash-tendencia-titulo">Recaudado · USD y CUP</div>
          ${svgRecaudado(usd.serie || [], cup.serie || [], usd.periodo)}
        </div>
        <div class="dash-tendencia">
          <div class="dash-tendencia-titulo">Citas completadas</div>
          ${svgBarrasCitas(usd.serie || [], cup.serie || [], usd.periodo)}
        </div>
      </div>
    </div>

    <div class="dash-card" id="dash-categoria-card">
      <div class="dash-cab dash-cab-banda">
        <div class="dash-cab-titulo">
          <span class="dash-kpi-ico">${icono.capas(16)}</span>
          <div>
            <h2>Recaudado por categoría</h2>
            <p>Reparto por categoría en USD y CUP</p>
          </div>
        </div>
      </div>
      ${categoriasHtml(datos)}
    </div>

    ${listaServiciosHtml("Recaudado por servicio",
      "Importes de cada servicio en las dos monedas", principales, datos)}
    ${adicionales.length
      ? listaServiciosHtml("Servicios adicionales",
        "Complementos sumados a una cita", adicionales, datos)
      : ""}
    ${topClientasHtml(clientes)}
    ${empleadasHtml(empleadas)}`;
}

function kpi(ico, titulo, valor, sub, destacado = false) {
  return `
    <div class="dash-kpi${destacado ? " destacado" : ""}">
      <div class="dash-kpi-cab">
        <span class="dash-kpi-ico">${icono[ico](16)}</span>
        <span class="dash-kpi-titulo">${escapeHtml(titulo)}</span>
      </div>
      <div class="dash-kpi-valores">
        <strong class="dash-kpi-valor" data-contar="${escapeHtml(String(valor))}">${escapeHtml(String(valor))}</strong>
      </div>
      <span class="dash-kpi-sub">${escapeHtml(sub)}</span>
    </div>`;
}

/** KPI con dos importes: uno en USD y otro en CUP. */
function kpiMonedas(ico, titulo, usd, cup, sub, destacado = false) {
  const linea = (valor, moneda, secundaria = false) => `
    <span class="dash-kpi-moneda${secundaria ? " secundaria cup" : " usd"}">
      <strong class="dash-kpi-valor" data-contar="${escapeHtml(String(valor))}">${escapeHtml(String(valor))}</strong>
      <small>${moneda}</small>
    </span>`;
  return `
    <div class="dash-kpi${destacado ? " destacado" : ""}">
      <div class="dash-kpi-cab">
        <span class="dash-kpi-ico">${icono[ico](16)}</span>
        <span class="dash-kpi-titulo">${escapeHtml(titulo)}</span>
      </div>
      <div class="dash-kpi-valores">
        ${linea(usd, "USD")}
        ${linea(cup, "CUP", true)}
      </div>
      <span class="dash-kpi-sub">${escapeHtml(sub)}</span>
    </div>`;
}

function reinversionDe(r) {
  // `estudio` incluye reinversión + libre; al restar lo libre queda solo la
  // parte destinada a reinvertir en el salón.
  return Math.max(0, numero(r.totales.estudio) - numero(r.totales.estudio_libre));
}

function mejorPunto(r) {
  return [...(r.serie || [])].sort((a, b) => numero(b.ingresos) - numero(a.ingresos))[0];
}

function mejorValor(r, moneda) {
  const mejor = mejorPunto(r);
  return mejor && numero(mejor.ingresos) > 0 ? monto(mejor.ingresos, moneda) : "—";
}

function mejorEtiqueta(r, moneda) {
  const mejor = mejorPunto(r);
  if (!mejor || numero(mejor.ingresos) <= 0) return `${moneda}: sin movimiento`;
  return `${moneda}: ${r.periodo === "anio" ? mejor.etiqueta : `día ${mejor.etiqueta}`}`;
}

/** Dos importes apilados para las filas de servicios, clientas y empleadas. */
function montoDual(usd, cup) {
  return `
    <span class="dash-monto-dual">
      <span class="usd">${monto(usd, "USD")} <small>USD</small></span>
      <span class="cup">${monto(cup, "CUP")} <small>CUP</small></span>
    </span>`;
}

function chipsHtml(subtipos = []) {
  if (!subtipos.length) return "";
  return `<div class="dash-chips">${subtipos.map((st) => `
    <span class="dash-chip${st.citas === 0 ? " vacio" : ""}">
      ${escapeHtml(st.subtipo)} · ${st.citas}
    </span>`).join("")}</div>`;
}

function combinarSubtipos(usd = [], cup = []) {
  const mapa = new Map();
  for (const st of [...(usd || []), ...(cup || [])]) {
    const actual = mapa.get(st.subtipo) || { subtipo: st.subtipo, citas: 0 };
    actual.citas += Number(st.citas || 0);
    mapa.set(st.subtipo, actual);
  }
  return [...mapa.values()];
}

function combinarServicios(usd = [], cup = []) {
  const porUsd = new Map((usd || []).map((x) => [x.servicio_id, x]));
  const porCup = new Map((cup || []).map((x) => [x.servicio_id, x]));
  const ids = new Set([...porUsd.keys(), ...porCup.keys()]);
  return [...ids].map((id) => {
    const u = porUsd.get(id) || null;
    const c = porCup.get(id) || null;
    return {
      ...(u || c),
      USD: u,
      CUP: c,
      citas: Number(u?.citas || 0) + Number(c?.citas || 0),
      subtipos: combinarSubtipos(u?.subtipos, c?.subtipos),
    };
  }).sort((a, b) =>
    numero(b.USD?.ingresos) - numero(a.USD?.ingresos)
    || numero(b.CUP?.ingresos) - numero(a.CUP?.ingresos)
    || String(a.nombre).localeCompare(String(b.nombre), "es")
  );
}

function combinarClientes(usd = [], cup = []) {
  const porUsd = new Map((usd || []).map((x) => [x.cliente_id, x]));
  const porCup = new Map((cup || []).map((x) => [x.cliente_id, x]));
  const ids = new Set([...porUsd.keys(), ...porCup.keys()]);
  return [...ids].map((id) => {
    const u = porUsd.get(id) || null;
    const c = porCup.get(id) || null;
    const ultima = [u?.ultima_cita, c?.ultima_cita].filter(Boolean).sort().slice(-1)[0] || null;
    return {
      ...(u || c),
      USD: u,
      CUP: c,
      citas: Number(u?.citas || 0) + Number(c?.citas || 0),
      ultima_cita: ultima,
    };
  }).sort((a, b) =>
    b.citas - a.citas
    || numero(b.USD?.ingresos) - numero(a.USD?.ingresos)
    || numero(b.CUP?.ingresos) - numero(a.CUP?.ingresos)
    || String(a.nombre).localeCompare(String(b.nombre), "es")
  );
}

function combinarEmpleadas(usd = [], cup = []) {
  const porUsd = new Map((usd || []).map((x) => [x.empleado_id, x]));
  const porCup = new Map((cup || []).map((x) => [x.empleado_id, x]));
  const ids = new Set([...porUsd.keys(), ...porCup.keys()]);
  return [...ids].map((id) => {
    const u = porUsd.get(id) || null;
    const c = porCup.get(id) || null;
    return {
      ...(u || c),
      USD: u,
      CUP: c,
      citas: Number(u?.citas || 0) + Number(c?.citas || 0),
    };
  }).sort((a, b) =>
    b.citas - a.citas
    || numero(b.USD?.ingresos) - numero(a.USD?.ingresos)
    || String(a.nombre).localeCompare(String(b.nombre), "es")
  );
}

function combinarCategorias(usd = [], cup = []) {
  const porUsd = new Map((usd || []).map((x) => [x.categoria, x]));
  const porCup = new Map((cup || []).map((x) => [x.categoria, x]));
  const nombres = new Set([...porUsd.keys(), ...porCup.keys()]);
  return [...nombres].map((categoria) => {
    const u = porUsd.get(categoria) || null;
    const c = porCup.get(categoria) || null;
    return {
      categoria,
      USD: u,
      CUP: c,
      citas: Number(u?.citas || 0) + Number(c?.citas || 0),
      subtipos: combinarSubtipos(u?.subtipos, c?.subtipos),
    };
  }).sort((a, b) =>
    numero(b.USD?.ingresos) - numero(a.USD?.ingresos)
    || numero(b.CUP?.ingresos) - numero(a.CUP?.ingresos)
    || String(a.categoria).localeCompare(String(b.categoria), "es")
  );
}

function categoriasHtml(datos) {
  const categorias = combinarCategorias(
    datos.USD.por_categoria,
    datos.CUP.por_categoria
  );
  if (!categorias.length) {
    return `<p class="dash-vacio">Sin categorías con movimiento en este período.</p>`;
  }
  const coloresUsd = coloresPorCategoria(datos.USD.por_categoria, "USD");
  const coloresCup = coloresPorCategoria(datos.CUP.por_categoria, "CUP");
  return `
    <div class="dash-donuts">
      ${donutHtml(datos.USD.por_categoria || [], numero(datos.USD.totales.ingresos), "USD")}
      ${donutHtml(datos.CUP.por_categoria || [], numero(datos.CUP.totales.ingresos), "CUP")}
    </div>
    <div class="dash-cats">
      ${categorias.map((c, i) => filaCategoria(
        c, datos, i, coloresUsd, coloresCup
      )).join("")}
    </div>`;
}

function donutHtml(categorias, total, moneda) {
  if (total <= 0) {
    return `
      <div class="dash-donut-wrap">
        <div class="dash-donut" style="background:var(--border)">
          <div class="dash-donut-centro">
            <span>Sin movimiento</span>
            <strong class="${moneda === "CUP" ? "texto-cup" : "texto-usd"}">${monto(0, moneda)}</strong>
            <small>${moneda}</small>
          </div>
        </div>
      </div>`;
  }
  const ordenadas = [...categorias].sort(
    (a, b) => numero(b.ingresos) - numero(a.ingresos)
  );
  let acumulado = 0;
  const paradas = ordenadas.map((c, i) => {
    const inicio = (acumulado / total) * 100;
    acumulado += numero(c.ingresos);
    const fin = (acumulado / total) * 100;
    return `${colorCategoria(moneda, i)} ${inicio}% ${fin}%`;
  }).join(", ");

  return `
    <div class="dash-donut-wrap">
      <div class="dash-donut" style="background:conic-gradient(${paradas})">
        <div class="dash-donut-centro">
          <span>Total recaudado</span>
          <strong class="${moneda === "CUP" ? "texto-cup" : "texto-usd"}" data-contar-diferido="${monto(total, moneda)}">${monto(total, moneda)}</strong>
          <small>${moneda}</small>
        </div>
      </div>
      <div class="dash-donut-leyenda-box">
        <div class="dash-donut-leyenda-cab">
          <span>${moneda}</span>
          <span>% del total</span>
        </div>
        <ul class="dash-donut-leyenda">
          ${ordenadas.map((c, i) => {
            const pct = (numero(c.ingresos) / total) * 100;
            const color = colorCategoria(moneda, i);
            return `
              <li style="--i:${i}">
                <i style="background:${color}"></i>
                <span class="dash-donut-leyenda-texto">
                  <span class="dash-donut-leyenda-nombre">${escapeHtml(mostrarCategoria(c.categoria))}</span>
                  <span class="dash-donut-leyenda-barra"><span style="width:${pct}%;background:${color}"></span></span>
                </span>
                <strong class="dash-donut-leyenda-pct">${Number(pct.toFixed(1))}%</strong>
              </li>`;
          }).join("")}
        </ul>
      </div>
    </div>`;
}

function filaCategoria(c, datos, i = 0, coloresUsd = new Map(), coloresCup = new Map()) {
  const ico = icoCategoria(c.categoria);
  const ingresosUsd = numero(c.USD?.ingresos);
  const ingresosCup = numero(c.CUP?.ingresos);
  const totalUsd = numero(datos.USD.totales.ingresos);
  const totalCup = numero(datos.CUP.totales.ingresos);
  const shareUsd = totalUsd > 0 ? (ingresosUsd / totalUsd) * 100 : 0;
  const shareCup = totalCup > 0 ? (ingresosCup / totalCup) * 100 : 0;
  const colorUsd = coloresUsd.get(c.categoria) || colorCategoria("USD", i);
  const colorCup = coloresCup.get(c.categoria) || colorCategoria("CUP", i);
  return `
    <div class="dash-cat" style="--i:${i}">
      <div class="dash-cat-cab">
        <span class="dash-cat-ico">
          ${ico ? `<img class="cat-ico" src="${ico}" alt="" />` : `<i class="dash-dot" style="background:${ingresosUsd > 0 ? colorUsd : colorCup}"></i>`}
        </span>
        <span class="dash-cat-nombre">
          ${escapeHtml(mostrarCategoria(c.categoria))}
        </span>
        <span class="dash-cat-monto" title="Recaudado del estudio">
          ${montoDual(ingresosUsd, ingresosCup)}
        </span>
      </div>
      <div class="dash-cat-detalle">
        <span class="dash-serv-citas-tag">
          ${icono.etiqueta(11)}
          ${c.citas} ${c.citas === 1 ? "cita" : "citas"}
        </span>
        <span class="dash-cat-am">
          AM Luxury:
          <span class="texto-usd">${monto(c.USD?.estudio, "USD")} USD</span>
          · <span class="texto-cup">${monto(c.CUP?.estudio, "CUP")} CUP</span>
        </span>
      </div>
      <div class="dash-serv-barras">
        <div class="dash-serv-barra">
          <small>USD</small>
          <div class="dash-barra"><span style="width:${Math.max(shareUsd, 0)}%;background:${colorUsd}"></span></div>
          <small>${shareUsd.toFixed(0)}%</small>
        </div>
        <div class="dash-serv-barra">
          <small>CUP</small>
          <div class="dash-barra"><span style="width:${Math.max(shareCup, 0)}%;background:${colorCup}"></span></div>
          <small>${shareCup.toFixed(0)}%</small>
        </div>
      </div>
      ${chipsHtml(c.subtipos)}
    </div>`;
}

function listaServiciosHtml(titulo, sub, servicios, datos) {
  const maxUsd = Math.max(...servicios.map((x) => numero(x.USD?.ingresos)), 1);
  const maxCup = Math.max(...servicios.map((x) => numero(x.CUP?.ingresos)), 1);
  const totalUsd = numero(datos.USD.totales.ingresos);
  const totalCup = numero(datos.CUP.totales.ingresos);

  const barra = (moneda, ingresos, total, max) => {
    const ancho = Math.max((ingresos / max) * 100, 0);
    const share = total > 0 ? (ingresos / total) * 100 : 0;
    // Color sólido por moneda: la paleta por valor dejaba barras casi blancas.
    const color = moneda === "CUP" ? "#8E6BB8" : "#CE7C94";
    return `
      <div class="dash-serv-barra">
        <small>${moneda}</small>
        <div class="dash-barra"><span style="width:${ancho}%;background:${color}"></span></div>
        <small>${share.toFixed(0)}%</small>
      </div>`;
  };

  return `
    <div class="dash-card">
      <div class="dash-cab dash-cab-banda">
        <div class="dash-cab-titulo">
          <span class="dash-kpi-ico">${icono.etiqueta(16)}</span>
          <div><h2>${escapeHtml(titulo)}</h2><p>${escapeHtml(sub)}</p></div>
        </div>
      </div>
      ${servicios.length === 0
        ? `<p class="dash-vacio">Sin servicios con movimiento en este período.</p>`
        : `<div class="dash-servs">${servicios.map((x, i) => `
            <div class="dash-serv">
              <span class="dash-rank">${i + 1}</span>
              <div class="dash-serv-cuerpo">
                <div class="dash-serv-cab">
                  <span class="dash-serv-nombre">
                    ${escapeHtml(x.nombre)}
                    ${x.es_adicional ? `<span class="dash-tag">Adicional</span>` : ""}
                  </span>
                  <span class="dash-serv-monto">${montoDual(x.USD?.ingresos, x.CUP?.ingresos)}</span>
                </div>
                <span class="dash-serv-citas-tag">
                  ${icono.etiqueta(11)}
                  ${x.citas} ${x.citas === 1 ? "cita" : "citas"}
                </span>
                <div class="dash-serv-barras">
                  ${barra("USD", numero(x.USD?.ingresos), totalUsd, maxUsd)}
                  ${barra("CUP", numero(x.CUP?.ingresos), totalCup, maxCup)}
                </div>
                ${chipsHtml(x.subtipos)}
              </div>
            </div>`).join("")}</div>`}
    </div>`;
}

/** Las 5 clientas con más citas; cada fila abre su historial. */
function topClientasHtml(clientes) {
  return `
    <div class="dash-card">
      <div class="dash-cab dash-cab-banda">
        <div class="dash-cab-titulo">
          <span class="dash-kpi-ico">${icono.personas(16)}</span>
          <div>
            <h2>Clientas más frecuentes</h2>
            <p>Las 5 con más citas en el período · haz clic para ver su historial</p>
          </div>
        </div>
      </div>
      ${clientes.length === 0
        ? `<p class="dash-vacio">Sin clientas con citas en este período.</p>`
        : `<div class="dash-personas">${clientes.map((c, i) => `
          <a class="dash-persona" href="#/clientes/${c.cliente_id}">
            <span class="dash-persona-rank">${i + 1}</span>
            <span class="dash-persona-info">
              <span class="dash-persona-nombre">${escapeHtml(c.nombre)}</span>
              <span class="dash-persona-sub">
                ${c.citas} ${c.citas === 1 ? "cita" : "citas"}
                ${c.ultima_cita ? ` · última ${fechaCorta(c.ultima_cita)}` : ""}
              </span>
            </span>
            <span class="dash-persona-valores">
              ${montoDual(c.USD?.ingresos, c.CUP?.ingresos)}
              <small>recaudado</small>
            </span>
            <span class="dash-persona-flecha" aria-hidden="true">›</span>
          </a>`).join("")}</div>`}
    </div>`;
}

/** Citas, recaudado y ganancia de cada empleada. */
function empleadasHtml(empleadas) {
  return `
    <div class="dash-card">
      <div class="dash-cab dash-cab-banda">
        <div class="dash-cab-titulo">
          <span class="dash-kpi-ico">${icono.usuario(16)}</span>
          <div>
            <h2>Rendimiento de las empleadas</h2>
            <p>Citas, recaudado y ganancia en el período</p>
          </div>
        </div>
      </div>
      ${empleadas.length === 0
        ? `<p class="dash-vacio">Aún no hay empleadas registradas.</p>`
        : `<div class="dash-personas">${empleadas.map((e, i) => `
          <div class="dash-persona${e.activo ? "" : " inactiva"}">
            <span class="dash-persona-rank${e.citas === 0 ? " vacio" : ""}">${i + 1}</span>
            <span class="dash-persona-info">
              <span class="dash-persona-nombre">
                ${escapeHtml(e.nombre)}
                ${e.activo ? "" : `<span class="dash-tag">Inactiva</span>`}
              </span>
              <span class="dash-persona-sub">
                ${e.citas} ${e.citas === 1 ? "cita" : "citas"}
              </span>
              <span class="dash-persona-sub dash-empleada-recaudado">
                Recaudado: <span class="texto-usd">${monto(e.USD?.ingresos, "USD")} USD</span> · <span class="texto-cup">${monto(e.CUP?.ingresos, "CUP")} CUP</span>
              </span>
            </span>
            <span class="dash-persona-valores">
              ${montoDual(e.USD?.trabajadora, e.CUP?.trabajadora)}
              <small>para ella</small>
            </span>
          </div>`).join("")}</div>`}
    </div>`;
}

/** Primera gráfica: recaudado de AM Luxury en USD y CUP con dos ejes Y. */
function svgRecaudado(serieUsd, serieCup, periodo) {
  const serie = serieUsd.length ? serieUsd : serieCup;
  if (!serie.length) return "";
  const W = 720;
  const H = 264;
  const L = 58;
  const R = 62;
  const T = 28;
  const B = 42;
  const w = W - L - R;
  const h = H - T - B;
  const maxUsd = Math.max(...serieUsd.map((x) => numero(x.estudio)), 1);
  const maxCup = Math.max(...serieCup.map((x) => numero(x.estudio)), 1);
  const x = (i) => L + (serie.length > 1 ? (i * w) / (serie.length - 1) : w / 2);
  const yUsd = (v) => T + h - (v / maxUsd) * h;
  const yCup = (v) => T + h - (v / maxCup) * h;
  const puntosUsd = serie.map((_, i) => [x(i), yUsd(numero(serieUsd[i]?.estudio))]);
  const puntosCup = serie.map((_, i) => [x(i), yCup(numero(serieCup[i]?.estudio))]);
  const hayDatos = [...serieUsd, ...serieCup].some((p) => numero(p.estudio) > 0);

  const linea = (pts, color) => `
    <polyline class="dash-linea" fill="none" stroke="${color}" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round"
      points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
  const puntos = (pts, color) => pts.map((p, idx) => `
    <circle class="dash-punto" style="--i:${idx}" cx="${p[0]}" cy="${p[1]}" r="3.1" fill="#fff"
      stroke="${color}" stroke-width="2"/>`).join("");
  const area = (pts, gradiente) => pts.length
    ? `<path class="dash-area" d="M ${pts[0][0]} ${T + h} L ${pts.map((p) => p.join(" ")).join(" L ")} L ${pts[pts.length - 1][0]} ${T + h} Z"
        fill="url(#${gradiente})"/>`
    : "";
  const guias = [0, 1, 2, 3].map((i) => `
    <line class="dash-guia" x1="${L}" x2="${W - R}" y1="${T + (h / 3) * i}" y2="${T + (h / 3) * i}"
      stroke="#F1DDE4" stroke-width="1"/>`).join("");
  const dinero = (valor) => valor >= 1000
    ? `$${(valor / 1000).toFixed(valor >= 10000 ? 0 : 1)}k`
    : `$${Math.round(valor)}`;
  const etiquetasUsd = [0, 1, 2, 3].map((i) => {
    const valor = (maxUsd * (3 - i)) / 3;
    return `<text class="dash-eje-y" x="${L - 8}" y="${T + (h / 3) * i + 4}" text-anchor="end"
      font-size="9" fill="#B25572">${dinero(valor)}</text>`;
  }).join("");
  const etiquetasCup = [0, 1, 2, 3].map((i) => {
    const valor = (maxCup * (3 - i)) / 3;
    return `<text class="dash-eje-y" x="${W - R + 8}" y="${T + (h / 3) * i + 4}" text-anchor="start"
      font-size="9" fill="#74619D">${dinero(valor)}</text>`;
  }).join("");
  const indices = periodo === "anio"
    ? [0, 2, 4, 6, 8, 10, 11]
    : serie.map((_, i) => i);
  const fuenteEje = periodo === "anio" ? 11 : serie.length > 10 ? 8 : 10;
  const densas = periodo !== "anio" && serie.length > 10;
  const xEtiquetas = indices
    .filter((i) => i >= 0 && i < serie.length)
    .map((i) => {
      const secundaria = densas && i % 3 !== 0;
      return `<text class="dash-eje-x${secundaria ? " dash-eje-x-sec" : ""}" x="${x(i)}" y="${H - 16}" text-anchor="middle"
        font-size="${fuenteEje}" fill="#8A7680">${escapeHtml(serie[i].etiqueta)}</text>`;
    })
    .join("");

  return `
    <div class="dash-chart dash-chart-datos">
      <svg viewBox="0 0 ${W} ${H}" role="img"
        aria-label="Recaudado por AM Luxury en USD y CUP">
        <defs>
          <linearGradient id="degradadoUsd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#CE7C94" stop-opacity=".22"/>
            <stop offset="100%" stop-color="#CE7C94" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="degradadoCup" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#8E6BB8" stop-opacity=".16"/>
            <stop offset="100%" stop-color="#8E6BB8" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${guias}
        ${etiquetasUsd}
        ${etiquetasCup}
        <text class="dash-eje-titulo" x="${L - 8}" y="${T - 10}" text-anchor="end" font-size="9" font-weight="700" fill="#B25572">USD</text>
        <text class="dash-eje-titulo" x="${W - R + 8}" y="${T - 10}" text-anchor="start" font-size="9" font-weight="700" fill="#74619D">CUP</text>
        ${area(puntosUsd, "degradadoUsd")}
        ${area(puntosCup, "degradadoCup")}
        ${linea(puntosUsd, "#CE7C94")}
        ${linea(puntosCup, "#8E6BB8")}
        ${puntos(puntosUsd, "#CE7C94")}
        ${puntos(puntosCup, "#8E6BB8")}
        ${xEtiquetas}
        ${hayDatos ? "" : `<text x="${W / 2}" y="${T + h / 2}" text-anchor="middle"
          font-size="13" fill="#8A7680">Sin movimiento en este período</text>`}
      </svg>
    </div>`;
}

/** Segunda gráfica: barras verticales con todas las citas de cada punto. */
function svgBarrasCitas(serieUsd, serieCup, periodo) {
  const serie = serieUsd.length ? serieUsd : serieCup;
  if (!serie.length) return "";
  const W = 720;
  const H = 264;
  const L = 44;
  const R = 24;
  const T = 28;
  const B = 42;
  const w = W - L - R;
  const h = H - T - B;
  const citas = serie.map((_, i) =>
    Number(serieUsd[i]?.citas || 0) + Number(serieCup[i]?.citas || 0)
  );
  const maximo = Math.max(...citas, 1);
  const paso = w / serie.length;
  const centro = (i) => L + paso * i + paso / 2;
  const ancho = Math.max(4, Math.min(30, paso * 0.56));
  const hayDatos = citas.some((v) => v > 0);
  const guias = [0, 1, 2, 3].map((i) => `
    <line class="dash-guia" x1="${L}" x2="${W - R}" y1="${T + (h / 3) * i}" y2="${T + (h / 3) * i}"
      stroke="#F1DDE4" stroke-width="1"/>`).join("");
  const etiquetasY = [0, 1, 2, 3].map((i) => {
    const valor = Math.round((maximo * (3 - i)) / 3);
    return `<text class="dash-eje-y" x="${L - 8}" y="${T + (h / 3) * i + 4}" text-anchor="end"
      font-size="10" fill="#8A7680">${valor}</text>`;
  }).join("");
  const barras = citas.map((valor, i) => {
    const alto = (valor / maximo) * h;
    const y = T + h - alto;
    const etiqueta = serie.length <= 12 && valor > 0
      ? `<text class="dash-dato-valor" style="--i:${i}" x="${centro(i)}" y="${Math.max(y - 6, T + 9)}" text-anchor="middle"
          font-size="9" font-weight="700" fill="#4F8F6B">${valor}</text>`
      : "";
    return `
      <rect class="dash-barra-citas" style="--i:${i}" x="${centro(i) - ancho / 2}" y="${y}" width="${ancho}" height="${Math.max(alto, 0)}"
        rx="${Math.min(4, ancho / 3)}" fill="url(#degradadoCitas)"/>
      ${etiqueta}`;
  }).join("");
  const indices = periodo === "anio"
    ? [0, 2, 4, 6, 8, 10, 11]
    : serie.map((_, i) => i);
  const fuenteEje = periodo === "anio" ? 11 : serie.length > 10 ? 8 : 10;
  const densas = periodo !== "anio" && serie.length > 10;
  const xEtiquetas = indices
    .filter((i) => i >= 0 && i < serie.length)
    .map((i) => {
      const secundaria = densas && i % 3 !== 0;
      return `<text class="dash-eje-x${secundaria ? " dash-eje-x-sec" : ""}" x="${centro(i)}" y="${H - 16}" text-anchor="middle"
        font-size="${fuenteEje}" fill="#8A7680">${escapeHtml(serie[i].etiqueta)}</text>`;
    })
    .join("");

  return `
    <div class="dash-chart dash-chart-datos">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Citas completadas del período">
        <defs>
          <linearGradient id="degradadoCitas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#5B9A6B"/>
            <stop offset="100%" stop-color="#A8CFB0"/>
          </linearGradient>
        </defs>
        ${guias}
        ${etiquetasY}
        <text class="dash-eje-titulo" x="${L - 8}" y="${T - 10}" text-anchor="end" font-size="9" font-weight="700" fill="#4F8F6B">CITAS</text>
        ${barras}
        <line x1="${L}" x2="${W - R}" y1="${T + h}" y2="${T + h}" stroke="#D9C7CF" stroke-width="1"/>
        ${xEtiquetas}
        ${hayDatos ? "" : `<text x="${W / 2}" y="${T + h / 2}" text-anchor="middle"
          font-size="13" fill="#8A7680">Sin citas en este período</text>`}
      </svg>
    </div>`;
}
