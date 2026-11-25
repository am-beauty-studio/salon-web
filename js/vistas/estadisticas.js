// Estadísticas (solo admin). Dashboard distinto al de barras de Ganancias.

import { get } from "../api.js?v=49";
import { animarCifras } from "../contador.js?v=2";
import {
  $, $$, aISO, escapeHtml, fechaCorta, sumarDias, sumarMeses, etiquetaSemana,
  tituloMes, tituloAnio, importe, mostrarCategoria,
} from "../util.js?v=54";
import { icoCategoria, icono } from "../iconos.js?v=64";

const ROSAS = [
  "#B25572", "#C06A86", "#CD7E97", "#D992A8",
  "#E3A6B9", "#EBBAC9", "#F2CCD8", "#F8DEE6",
];

// Moneda del filtro. El API devuelve importes ya convertidos.
let monedaActual = "USD";
const monto = (valor) => importe(valor, monedaActual);

/** Rosa según el peso del valor: el mayor recibe el tono más oscuro y el menor el más claro. */
function colorRosa(valor, maximo, minimo = 0) {
  const max = Number(maximo) || 0;
  const min = Number(minimo) || 0;
  if (max <= 0) return ROSAS[ROSAS.length - 1];
  const rango = max - min;
  const peso = rango > 0 ? (Number(valor) - min) / rango : 1;
  const paso = Math.round((1 - Math.min(Math.max(peso, 0), 1)) * (ROSAS.length - 1));
  return ROSAS[paso];
}

export async function render(raiz) {
  let periodo = "mes";
  let fecha = new Date();
  let moneda = "USD";
  let observadorDonut = null;

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
      <div class="filtro-etiqueta">Moneda</div>
      <div class="segmentado" role="tablist" aria-label="Moneda de las estadísticas">
        <button class="segmento activo" data-m="USD" type="button" role="tab" aria-selected="true">USD</button>
        <button class="segmento" data-m="CUP" type="button" role="tab" aria-selected="false">CUP</button>
      </div>
      <div class="nav-fecha">
        <button class="nav-flecha" id="e-prev" type="button" aria-label="Período anterior">‹</button>
        <button class="nav-fecha-titulo" id="e-titulo" type="button"></button>
        <button class="nav-flecha" id="e-next" type="button" aria-label="Período siguiente">›</button>
      </div>
    </div>
    <div id="dash"></div>
    <p class="nota" style="text-align:center;margin-top:14px">
      Los importes se calculan con las citas completadas y se separan por moneda.
      AM Luxury incluye reinversión más ganancia libre.
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

  $$(".segmentado [data-m]").forEach((chip) => {
    chip.onclick = () => {
      moneda = chip.dataset.m;
      $$(".segmentado [data-m]").forEach((c) => {
        const activo = c.dataset.m === moneda;
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
    $("#dash").innerHTML = `<div class="cargando">Cargando…</div>`;
    try {
      const r = await get(
        `/finanzas/estadisticas?periodo=${periodo}&fecha=${aISO(fecha)}&moneda=${moneda}`
      );
      const $dash = $("#dash");
      $dash.innerHTML = dashboard(r);
      animarCifras($dash);
      observadorDonut = observarDonut($dash);
    } catch (e) {
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
  const wrap = dash.querySelector(".dash-donut-wrap");
  if (!wrap) return null;

  const activar = () => {
    wrap.classList.remove("pendiente");
    const cifra = wrap.querySelector("[data-contar-diferido]");
    if (cifra) {
      cifra.dataset.contar = cifra.dataset.contarDiferido;
      delete cifra.dataset.contarDiferido;
      animarCifras(cifra.parentElement || wrap);
    }
  };

  if (!("IntersectionObserver" in window)) {
    activar();
    return null;
  }

  wrap.classList.add("pendiente");
  const observador = new IntersectionObserver((entradas) => {
    if (entradas.some((e) => e.isIntersecting)) {
      observador.disconnect();
      activar();
    }
  }, { threshold: 0.3 });
  observador.observe(wrap);
  return observador;
}

function dashboard(r) {
  const t = r.totales;
  monedaActual = r.moneda || "USD";
  // De mayor a menor ingreso: el tono más oscuro siempre es el que más recauda.
  const categorias = [...(r.por_categoria || [])].sort(
    (a, b) => Number(b.ingresos) - Number(a.ingresos)
  );
  const maxCategoria = categorias.length ? Math.max(...categorias.map((c) => Number(c.ingresos))) : 0;
  const minCategoria = categorias.length ? Math.min(...categorias.map((c) => Number(c.ingresos))) : 0;
  const servicios = r.por_servicio || [];
  const mejoresClientes = r.mejores_clientes || [];
  const empleadas = r.por_empleada || [];
  const principales = servicios.filter((x) => !x.es_adicional);
  const adicionales = servicios.filter((x) => x.es_adicional);
  const mejor = [...(r.serie || [])].sort(
    (a, b) => Number(b.estudio) - Number(a.estudio)
  )[0];
  const mejorValor = mejor && Number(mejor.estudio) > 0 ? monto(mejor.estudio) : "—";
  const mejorSub = mejor && Number(mejor.estudio) > 0
    ? (r.periodo === "anio" ? mejor.etiqueta : `día ${mejor.etiqueta}`)
    : "sin movimiento";

  return `
    <div class="dash-kpis">
      ${kpi("dolar", "AM Luxury", monto(t.estudio), `de ${monto(t.ingresos)} ${monedaActual} recaudados`, true)}
      ${kpi("calendario", "Citas completadas", String(t.citas),
        `${t.citas === 1 ? "1 cita" : `${t.citas} citas`} en el período`)}
      ${kpi("porcentaje", "Ticket promedio", monto(t.ticket_promedio), "por cita completada")}
      ${kpi("grafico", r.periodo === "anio" ? "Mejor mes" : "Mejor día", mejorValor, mejorSub)}
    </div>

    <div class="dash-card">
      <div class="dash-cab">
        <div>
          <h2>Tendencia del período</h2>
          <p>Recaudado por AM Luxury y cantidad de citas</p>
        </div>
        <div class="dash-leyenda">
          <span><i style="background:var(--gold)"></i>AM Luxury ${monto(t.estudio)} ${monedaActual}</span>
          <span><i style="background:var(--violeta)"></i>${t.citas} citas</span>
        </div>
      </div>
      ${svgTendencia(r.serie || [], r.periodo)}
    </div>

    <div class="dash-card">
      <div class="dash-cab">
        <div>
          <h2>Recaudado por categoría</h2>
          <p>${categorias.length} ${categorias.length === 1 ? "categoría" : "categorías"} con movimiento</p>
        </div>
      </div>
      ${categorias.length === 0
        ? `<p class="dash-vacio">Sin categorías con movimiento en este período.</p>`
        : `${donutHtml(categorias, Number(t.ingresos))}
           <div class="dash-cats">
             ${categorias.map((c, i) => filaCategoria(c, Number(t.ingresos), maxCategoria, minCategoria, i)).join("")}
           </div>`}
    </div>

    ${listaServiciosHtml("Recaudado por servicio",
      "Ordenados por lo cobrado en el período", principales, Number(t.ingresos))}
    ${adicionales.length
      ? listaServiciosHtml("Servicios adicionales",
        "Complementos sumados a una cita", adicionales, Number(t.ingresos))
      : ""}
    ${topClientasHtml(mejoresClientes)}
    ${empleadasHtml(empleadas)}`;
}

function kpi(ico, titulo, valor, sub, destacado = false) {
  return `
    <div class="dash-kpi${destacado ? " destacado" : ""}">
      <span class="dash-kpi-ico">${icono[ico](16)}</span>
      <span class="dash-kpi-titulo">${escapeHtml(titulo)}</span>
      <strong class="dash-kpi-valor" data-contar="${escapeHtml(String(valor))}">${escapeHtml(String(valor))}</strong>
      <span class="dash-kpi-sub">${escapeHtml(sub)}</span>
    </div>`;
}

function chipsHtml(subtipos = []) {
  if (!subtipos.length) return "";
  return `<div class="dash-chips">${subtipos.map((st) => `
    <span class="dash-chip${st.citas === 0 ? " vacio" : ""}">
      ${escapeHtml(st.subtipo)} · ${st.citas}
    </span>`).join("")}</div>`;
}

function donutHtml(categorias, total) {
  if (total <= 0) return "";
  const max = Math.max(...categorias.map((c) => Number(c.ingresos)), 0);
  const min = Math.min(...categorias.map((c) => Number(c.ingresos)), 0);
  let acumulado = 0;
  const paradas = categorias.map((c) => {
    const inicio = (acumulado / total) * 100;
    acumulado += Number(c.ingresos);
    const fin = (acumulado / total) * 100;
    return `${colorRosa(c.ingresos, max, min)} ${inicio}% ${fin}%`;
  }).join(", ");

  return `
    <div class="dash-donut-wrap">
      <div class="dash-donut" style="background:conic-gradient(${paradas})">
        <div class="dash-donut-centro">
          <span>Total recaudado</span>
          <strong data-contar-diferido="${monto(total)}">${monto(total)}</strong>
        </div>
      </div>
      <ul class="dash-donut-leyenda">
        ${categorias.map((c, i) => `
          <li style="--i:${i}">
            <i style="background:${colorRosa(c.ingresos, max, min)}"></i>
            <span>${escapeHtml(mostrarCategoria(c.categoria))}</span>
            <strong>${total > 0 ? ((Number(c.ingresos) / total) * 100).toFixed(0) : 0}%</strong>
          </li>`).join("")}
      </ul>
    </div>`;
}

function filaCategoria(c, total, max, min, i = 0) {
  const color = colorRosa(c.ingresos, max, min);
  const ico = icoCategoria(c.categoria);
  const share = total > 0 ? (Number(c.ingresos) / total) * 100 : 0;
  return `
    <div class="dash-cat" style="--i:${i}">
      <div class="dash-cat-cab">
        <span class="dash-cat-ico">
          ${ico ? `<img class="cat-ico" src="${ico}" alt="" />` : `<i class="dash-dot" style="background:${color}"></i>`}
        </span>
        <span class="dash-cat-nombre">
          ${escapeHtml(mostrarCategoria(c.categoria))}
          <small>${c.citas} ${c.citas === 1 ? "cita" : "citas"} · AM Luxury ${monto(c.estudio)}</small>
        </span>
        <span class="dash-cat-monto">
          ${monto(c.ingresos)}
          <small>${share.toFixed(0)}%</small>
        </span>
      </div>
      <div class="dash-barra"><span style="width:${Math.max(share, 0)}%;background:${color}"></span></div>
      ${chipsHtml(c.subtipos)}
    </div>`;
}

function listaServiciosHtml(titulo, sub, servicios, total) {
  const max = Math.max(...servicios.map((x) => Number(x.ingresos)), 1);
  const min = servicios.length ? Math.min(...servicios.map((x) => Number(x.ingresos))) : 0;
  return `
    <div class="dash-card">
      <div class="dash-cab">
        <div><h2>${escapeHtml(titulo)}</h2><p>${escapeHtml(sub)}</p></div>
      </div>
      ${servicios.length === 0
        ? `<p class="dash-vacio">Sin servicios con movimiento en este período.</p>`
        : `<div class="dash-servs">${servicios.map((x, i) => {
          const share = total > 0 ? (Number(x.ingresos) / total) * 100 : 0;
          const ancho = Math.max((Number(x.ingresos) / max) * 100, 0);
          return `
            <div class="dash-serv">
              <span class="dash-rank">${i + 1}</span>
              <div class="dash-serv-cuerpo">
                <div class="dash-serv-cab">
                  <span class="dash-serv-nombre">
                    ${escapeHtml(x.nombre)}
                    ${x.es_adicional ? `<span class="dash-tag">Adicional</span>` : ""}
                  </span>
                  <span class="dash-serv-monto">${monto(x.ingresos)}</span>
                </div>
                <div class="dash-serv-sub">
                  ${x.citas} ${x.citas === 1 ? "cita" : "citas"} · AM Luxury ${monto(x.estudio)}
                  <span>${share.toFixed(0)}%</span>
                </div>
                <div class="dash-barra"><span style="width:${ancho}%;background:${colorRosa(x.ingresos, max, min)}"></span></div>
                ${chipsHtml(x.subtipos)}
              </div>
            </div>`;
        }).join("")}</div>`}
    </div>`;
}

/** Las 5 clientas con más citas; cada fila abre su historial. */
function topClientasHtml(clientes) {
  return `
    <div class="dash-card">
      <div class="dash-cab">
        <div>
          <h2>Clientas más frecuentes</h2>
          <p>Las 5 con más citas en el período · haz clic para ver su historial</p>
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
              <strong>${monto(c.ingresos)}</strong>
              <small>recaudado</small>
            </span>
            <span class="dash-persona-flecha" aria-hidden="true">›</span>
          </a>`).join("")}</div>`}
    </div>`;
}

/** Citas, recaudado, AM Luxury y ganancia de cada empleada. */
function empleadasHtml(empleadas) {
  return `
    <div class="dash-card">
      <div class="dash-cab">
        <div>
          <h2>Rendimiento de las empleadas</h2>
          <p>Citas, recaudado y ganancia en el período</p>
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
                ${e.citas} ${e.citas === 1 ? "cita" : "citas"} ·
                ${monto(e.ingresos)} recaudado · AM ${monto(e.estudio)}
              </span>
            </span>
            <span class="dash-persona-valores">
              <strong>${monto(e.trabajadora)}</strong>
              <small>para ella</small>
            </span>
          </div>`).join("")}</div>`}
    </div>`;
}

/** Gráfico de líneas con dos series y escalas independientes (SVG). */
function svgTendencia(serie, periodo) {
  if (!serie.length) return "";
  const W = 720;
  const H = 264;
  const L = 48;
  const R = 46;
  const T = 26;
  const B = 42;
  const w = W - L - R;
  const h = H - T - B;
  const maxE = Math.max(...serie.map((x) => Number(x.estudio)), 1);
  const maxC = Math.max(...serie.map((x) => x.citas), 1);
  const x = (i) => L + (serie.length > 1 ? (i * w) / (serie.length - 1) : w / 2);
  const yE = (v) => T + h - (v / maxE) * h;
  const yC = (v) => T + h - (v / maxC) * h;
  const pe = serie.map((p, i) => [x(i), yE(Number(p.estudio))]);
  const pc = serie.map((p, i) => [x(i), yC(p.citas)]);
  const hayDatos = serie.some((p) => Number(p.estudio) > 0 || p.citas > 0);

  const linea = (pts, color) => `
    <polyline fill="none" stroke="${color}" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round"
      points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
  const puntos = (pts, color) => pts.map((p) => `
    <circle cx="${p[0]}" cy="${p[1]}" r="3.1" fill="#fff"
      stroke="${color}" stroke-width="2"/>`).join("");
  const area = pe.length
    ? `<path d="M ${pe[0][0]} ${T + h} L ${pe.map((p) => p.join(" ")).join(" L ")} L ${pe[pe.length - 1][0]} ${T + h} Z"
        fill="url(#degradadoEstudio)"/>`
    : "";
  const guias = [0, 1, 2, 3].map((i) => `
    <line x1="${L}" x2="${W - R}" y1="${T + (h / 3) * i}" y2="${T + (h / 3) * i}"
      stroke="#F1DDE4" stroke-width="1"/>`).join("");
  const yEtiquetas = [0, 1, 2, 3].map((i) => {
    const valor = (maxE * (3 - i)) / 3;
    return `<text x="${L - 8}" y="${T + (h / 3) * i + 4}" text-anchor="end"
      font-size="10" fill="#8A7680">$${valor >= 100 ? Math.round(valor) : valor.toFixed(0)}</text>`;
  }).join("");
  // Con "Mes" se muestran todos los días en el eje X (y también con "Semana",
  // que son solo 7 puntos). En "Año" basta con algunos meses.
  const indices = periodo === "anio"
    ? [0, 2, 4, 6, 8, 10, 11]
    : serie.map((_, i) => i);
  const fuenteEje = periodo === "anio" ? 11 : serie.length > 10 ? 8 : 10;
  const xEtiquetas = indices
    .filter((i) => i >= 0 && i < serie.length)
    .map((i) => `<text x="${x(i)}" y="${H - 16}" text-anchor="middle"
      font-size="${fuenteEje}" fill="#8A7680">${escapeHtml(serie[i].etiqueta)}</text>`)
    .join("");

  return `
    <div class="dash-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img"
        aria-label="Tendencia de lo recaudado por AM Luxury y las citas">
        <defs>
          <linearGradient id="degradadoEstudio" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#CE7C94" stop-opacity=".22"/>
            <stop offset="100%" stop-color="#CE7C94" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${guias}
        ${yEtiquetas}
        <text x="${W - R + 8}" y="${T + 4}" font-size="10" fill="#8A7680">${maxC}</text>
        ${area}
        ${linea(pc, "#8E6BB8")}
        ${linea(pe, "#CE7C94")}
        ${puntos(pc, "#8E6BB8")}
        ${puntos(pe, "#CE7C94")}
        ${xEtiquetas}
        ${hayDatos ? "" : `<text x="${W / 2}" y="${T + h / 2}" text-anchor="middle"
          font-size="13" fill="#8A7680">Sin movimiento en este período</text>`}
      </svg>
    </div>`;
}
