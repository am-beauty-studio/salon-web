// Ganancias (solo admin). Equivalente a src/app/ganancias.tsx.

import { get } from "../api.js?v=49";
import {
  $, $$, escapeHtml, sumarDias, sumarMeses, etiqueta, etiquetaSemana, tituloMes,
  tituloTrimestre, tituloSemestre, tituloAnio, mesCorto,
  diaCorto, importe, mostrarCategoria, compararCategorias,
} from "../util.js?v=55";
import { icoCategoria, icono } from "../iconos.js?v=64";
import { abrirCalendario } from "./componentes.js?v=52";
import { selectorMoneda, conectarSelectorMoneda } from "../moneda-switch.js?v=1";

const ROSAS = [
  "#B25572", "#C06A86", "#CD7E97", "#D992A8",
  "#E3A6B9", "#EBBAC9", "#F2CCD8", "#F8DEE6",
];
const VIOLETAS = [
  "#65548F", "#74619D", "#8571AB", "#9682B9",
  "#A793C7", "#B8A5D5", "#C9B7E2", "#E1D7F0",
];

// Moneda elegida para la gráfica de ingresos. El resto de la sección muestra
// siempre los importes de las dos monedas.
let monedaGrafica = "USD";
let monedaActual = "USD";
const monto = (valor) => importe(valor, monedaActual);
const numero = (valor) => Number(valor) || 0;

/** Importes de las dos monedas apilados, con el mismo estilo de Estadísticas. */
function ambas(usd, cup) {
  return `
    <span class="dash-monto-dual">
      <span class="usd">${importe(usd, "USD")} <small>USD</small></span>
      <span class="cup">${importe(cup, "CUP")} <small>CUP</small></span>
    </span>`;
}

/** Citas de las dos monedas en un mismo concepto. */
function citasDe(item) {
  return numero(item?.USD?.citas) + numero(item?.CUP?.citas);
}

/** Une por clave los resúmenes de USD y CUP para mostrarlos juntos. */
function unirMonedas(clave, listaUsd = [], listaCup = []) {
  const mapa = new Map();
  for (const x of listaUsd) mapa.set(clave(x), { ...x, USD: x, CUP: null });
  for (const x of listaCup) {
    const k = clave(x);
    if (mapa.has(k)) mapa.get(k).CUP = x;
    else mapa.set(k, { ...x, USD: null, CUP: x });
  }
  return [...mapa.values()];
}

/**
 * Colores por puesto para las gráficas de barra: el porcentaje mayor toma el
 * tono más oscuro y los siguientes bajan de forma pareja hasta el más claro,
 * sin importar cuánto se diferencien entre sí. Devuelve valor → color.
 */
function coloresPorPuesto(valores, moneda = "USD") {
  const colores = moneda === "CUP" ? VIOLETAS : ROSAS;
  const unicos = [...new Set(valores.map(Number))].sort((a, b) => b - a);
  const pasos = new Map();
  unicos.forEach((v, i) => {
    const paso = unicos.length > 1
      ? Math.round((i / (unicos.length - 1)) * (colores.length - 1))
      : 0;
    pasos.set(v, colores[paso]);
  });
  return (valor) => pasos.get(Number(valor)) ?? colores[colores.length - 1];
}

export async function render(raiz) {
  let periodo = "dia";
  let fecha = new Date();
  let resumenes = null;

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${icono.grafico(22)}</span>
      <h1 class="vista-titulo">Ganancias</h1>
    </div>
    <div class="filtro-ganancias">
      <div class="filtro-etiqueta">Período</div>
      <div class="segmentado" role="tablist" aria-label="Período de las ganancias">
        <button class="segmento" data-p="dia" type="button" role="tab">Día</button>
        <button class="segmento" data-p="semana" type="button" role="tab">Semana</button>
        <button class="segmento" data-p="mes" type="button" role="tab">Mes</button>
        <button class="segmento" data-p="trimestre" type="button" role="tab">Trimestre</button>
        <button class="segmento" data-p="semestre" type="button" role="tab">Semestre</button>
        <button class="segmento" data-p="anio" type="button" role="tab">Año</button>
      </div>
      <div class="nav-fecha">
        <button class="nav-flecha" id="g-prev" type="button" aria-label="Período anterior">‹</button>
        <button class="nav-fecha-titulo" id="g-hoy" type="button"></button>
        <button class="nav-flecha" id="g-next" type="button" aria-label="Período siguiente">›</button>
      </div>
    </div>
    <div id="contenido"></div>
    <p class="nota" style="text-align:center;margin-top:14px">
      La ganancia se cuenta cuando la cita se marca como completada, en el día del servicio.
      La gráfica de ingresos se puede ver en USD o en CUP; el resto muestra ambas monedas.
    </p>`;

  $$(".segmentado [data-p]").forEach((chip) => {
    chip.onclick = () => {
      periodo = chip.dataset.p;
      pintarChips();
      cargar();
    };
  });
  $("#g-prev").onclick = () => { fecha = retroceder(fecha, -1); cargar(); };
  $("#g-next").onclick = () => { fecha = retroceder(fecha, 1); cargar(); };
  $("#g-hoy").onclick = () => {
    if (periodo === "dia") {
      abrirCalendario({
        fecha,
        onElegir: (nueva) => { fecha = nueva; cargar(); },
      });
    } else {
      fecha = new Date();
      cargar();
    }
  };

  function pintarChips() {
    $$(".segmentado [data-p]").forEach((chip) => {
      const activo = chip.dataset.p === periodo;
      chip.classList.toggle("activo", activo);
      chip.setAttribute("aria-selected", activo ? "true" : "false");
    });
  }

  function retroceder(d, n) {
    if (periodo === "dia") return sumarDias(d, n);
    if (periodo === "semana") return sumarDias(d, 7 * n);
    const meses = { mes: 1, trimestre: 3, semestre: 6, anio: 12 };
    return sumarMeses(d, (meses[periodo] || 1) * n);
  }

  function pintarTitulo() {
    const titulo = periodo === "dia" ? etiqueta(fecha)
      : periodo === "semana" ? etiquetaSemana(fecha)
      : periodo === "mes" ? tituloMes(fecha)
      : periodo === "trimestre" ? tituloTrimestre(fecha)
      : periodo === "semestre" ? tituloSemestre(fecha)
      : tituloAnio(fecha);
    const esDia = periodo === "dia";
    const linea = esDia
      ? `<span class="nav-fecha-linea">${icono.calendario(14)}<span>${escapeHtml(titulo)}</span></span>`
      : escapeHtml(titulo);
    const ayuda = esDia ? "Toca para elegir el día" : "Toca para volver a hoy";
    $("#g-hoy").innerHTML = `${linea}<span class="nav-sub">${ayuda}</span>`;
  }

  async function cargar() {
    pintarTitulo();
    const caja = $("#contenido");
    caja.innerHTML = `<div class="vacio">Cargando…</div>`;
    try {
      const iso = aISOFecha(fecha);
      const [usd, cup] = await Promise.all(["USD", "CUP"].map((moneda) =>
        get(`/finanzas/resumen?periodo=${periodo}&fecha=${iso}&moneda=${moneda}`)
      ));
      resumenes = { USD: usd, CUP: cup };
    } catch (e) {
      caja.innerHTML = `<p class="error-txt">${escapeHtml(e.message)}</p>`;
      return;
    }
    pintar(resumenes);
  }

  function pintar(dos) {
    // Solo la gráfica sigue la moneda elegida en su interruptor.
    const r = monedaGrafica === "CUP" ? dos.CUP : dos.USD;
    const t = r.totales;
    const caja = $("#contenido");
    monedaActual = r.moneda || monedaGrafica;
    caja.classList.toggle("moneda-cup", monedaActual === "CUP");

    const hayCitas = numero(dos.USD.totales.citas) + numero(dos.CUP.totales.citas) > 0;
    const porTrabajadora = unirMonedas(
      (x) => x.empleado_id, dos.USD.por_trabajadora, dos.CUP.por_trabajadora
    );
    const porServicio = unirMonedas(
      (x) => x.servicio_id, dos.USD.por_servicio, dos.CUP.por_servicio
    );
    const porDia = unirMonedas((x) => x.fecha, dos.USD.por_dia, dos.CUP.por_dia);
    const pendiente = { USD: dos.USD.pendiente, CUP: dos.CUP.pendiente };

    const pct = (valor) => numero(t.ingresos) ? (numero(valor) / numero(t.ingresos)) * 100 : 0;
    // El mayor porcentaje toma el tono más oscuro; los demás bajan parejo.
    const colorDe = coloresPorPuesto([
      numero(t.trabajadoras), numero(t.reinversion), numero(t.estudio_libre),
    ], monedaActual);
    const filas = [
      { nombre: "Trabajadoras", monto: t.trabajadoras },
      { nombre: "Reinversión en el salón", monto: t.reinversion },
      { nombre: "Libre para AM Luxury", monto: t.estudio_libre },
    ].map((f) => ({ ...f, color: colorDe(numero(f.monto)) }));
    // Tramos de menor a mayor: el tono más oscuro siempre queda a la derecha.
    const tramos = [...filas].sort((a, b) => numero(a.monto) - numero(b.monto));

    caja.innerHTML = `
      <div class="tarjeta gan-ingresos">
        <div class="gan-ingresos-cab">
          <div class="gan-ingresos-titulo">
            <strong>Ingresos</strong>
            <span>${t.citas} ${t.citas === 1 ? "cita" : "citas"} completada(s)</span>
          </div>
          <div class="gan-ingresos-moneda">${selectorMoneda(monedaGrafica)}</div>
        </div>
        <div class="gan-num">${monto(t.ingresos)} <small>${monedaActual}</small></div>
        <div class="barra-reparto">
          ${tramos.map((f) => `
            <div style="background:${f.color};width:${pct(f.monto)}%"></div>`).join("")}
        </div>
        ${filas.map((f) => `
          <div class="reparto-fila">
            <span class="reparto-punto" style="background:${f.color}"></span>
            <span class="reparto-nombre">${f.nombre}</span>
            <span class="lista-secundario">${pct(f.monto).toFixed(1)}%</span>
            <span class="reparto-monto">${monto(f.monto)} ${monedaActual}</span>
          </div>`).join("")}
        <hr style="border:none;border-top:1px solid var(--border);margin:10px 0" />
        <div class="reparto-fila">
          <span class="reparto-nombre" style="font-weight:700">AM Luxury en total</span>
          <span class="reparto-monto" style="font-size:16px">${monto(t.estudio_total)} ${monedaActual}</span>
        </div>
        <p class="nota">Reinversión + parte libre. La parte de cada trabajadora sale directo del servicio.</p>
      </div>

      ${!hayCitas ? `<div class="vacio">Sin ganancias registradas en este período.</div>` : ""}
      ${citasDe(pendiente) ? pendienteHtml(pendiente) : ""}

      ${seccionLista("Por trabajadora", porTrabajadora.map((x) => {
        const citas = citasDe(x);
        return {
          titulo: x.empleado_nombre,
          detalle: `${citas} ${citas === 1 ? "cita" : "citas"} · ${ambas(x.USD?.ingresos, x.CUP?.ingresos)} generados`,
          derecho: `le corresponde ${ambas(x.USD?.trabajadoras, x.CUP?.trabajadoras)}`,
        };
      }), !porTrabajadora.length)}

      ${seccionServicios(porServicio)}

      ${periodo !== "dia" ? seccionBarras(porDia) : ""}
    `;

    conectarSelectorMoneda(caja, (nueva) => {
      monedaGrafica = nueva;
      if (resumenes) pintar(resumenes);
    });
  }

  function pendienteHtml(p) {
    const citas = citasDe(p);
    return `
      <div class="caja-amarilla">
        <b>Pendiente: ${citas} ${citas === 1 ? "cita" : "citas"} programada(s) · ${ambas(p.USD?.monto, p.CUP?.monto)}</b>
        <div class="nota">Aún no cuentan como ganancia: se suman al marcarlas como completadas.</div>
      </div>`;
  }

  function seccionLista(titulo, filas, vacio) {
    if (vacio) return "";
    return `
      <div class="gan-bloque">
        <div class="gan-bloque-cab">
          <span class="gan-bloque-ico">${icono.usuario(16)}</span>
          <h3>${escapeHtml(titulo)}</h3>
        </div>
        <div class="gan-bloque-filas">
          ${filas.map((f) => `
            <div class="gan-fila">
              <span class="gan-fila-info">
                <span class="gan-fila-titulo">${escapeHtml(f.titulo)}</span>
                <span class="gan-fila-detalle">${f.detalle}</span>
              </span>
              <span class="gan-fila-valores">${f.derecho}</span>
            </div>`).join("")}
        </div>
      </div>`;
  }

  /** Acordeón "Por categoría": servicios agrupados por su categoría, con
      etiqueta "Adicional" en los servicios adicionales. Cada servicio abre
      la gráfica del reparto. Estilos críticos inline (a prueba de caché). */
  function seccionServicios(servicios) {
    if (!servicios?.length) return "";
    const TARJETA = "background:var(--card,#fff);border:1px solid var(--border,#E3BCCC);border-radius:12px;margin:0;overflow:hidden";
    const CABECERA = "display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer;list-style:none";
    const FLECHA = "flex-shrink:0;width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;background:rgba(223, 185, 140, .14);color:var(--gold-dark,#96405C);font-size:19px;transition:transform .15s";
    const TITULO = "flex:1;min-width:0;font-weight:600;font-size:15px;color:var(--text,#3A2B31)";
    const SUB = "display:block;color:var(--muted,#8A7680);font-size:12.5px;font-weight:400";
    const ETIQUETA = "display:inline-block;margin-left:7px;padding:1px 8px 2px;border-radius:10px;background:rgba(223, 185, 140, .16);color:var(--gold-dark,#96405C);font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;vertical-align:1px;white-space:nowrap";
    const MONTO = "font-weight:700;font-size:15px;white-space:nowrap;text-align:right";
    const CUERPO = "padding:6px 16px 14px;border-top:1px solid var(--border,#E3BCCC)";
    const FILA = "display:flex;align-items:center;gap:8px;margin:6px 0;font-size:14px";
    const NOTA = "color:var(--muted,#8A7680);font-size:12.5px;line-height:17px;margin:6px 0 0";

    // Agrupar por categoría (agrupando sin importar el orden del API) y dentro
    // de cada una ordenar los servicios de mayor a menor recaudación.
    const mapa = new Map();
    for (const p of servicios) {
      const cat = (p.categoria || "").trim() || "Otros";
      const clave = cat.toLowerCase();
      if (!mapa.has(clave)) mapa.set(clave, { categoria: cat, items: [] });
      mapa.get(clave).items.push(p);
    }
    const grupos = [...mapa.values()];
    // Orden fijo del salón sin importar el período ni el orden del API:
    // Manicura, Manicura SPA, Pedicura, Pedicura SPA, Cejas, Pestañas y luego
    // el resto (Full Service y categorías desconocidas).
    grupos.sort((a, b) => compararCategorias(a.categoria, b.categoria));
    for (const g of grupos) {
      g.items.sort((a, b) =>
        Math.max(numero(b.USD?.ingresos), numero(b.CUP?.ingresos))
        - Math.max(numero(a.USD?.ingresos), numero(a.CUP?.ingresos))
        || String(a.servicio_nombre).localeCompare(String(b.servicio_nombre), "es")
      );
    }

    /** Totales de la categoría por moneda: montos y número de citas. */
    const sumarCategoria = (items) => {
      const t = {
        USD: { ingresos: 0, reinversion: 0, libre: 0, citas: 0 },
        CUP: { ingresos: 0, reinversion: 0, libre: 0, citas: 0 },
      };
      for (const p of items) {
        for (const m of ["USD", "CUP"]) {
          t[m].ingresos += numero(p[m]?.ingresos);
          t[m].reinversion += numero(p[m]?.reinversion);
          t[m].libre += numero(p[m]?.estudio_libre);
          t[m].citas += numero(p[m]?.citas);
        }
      }
      return t;
    };

    const acordeon = (p) => {
      // Porcentajes tal como están configurados en el servicio
      // (respaldo: según lo liquidado, por si el API aún no los envía).
      const base = p.USD || p.CUP || {};
      const pctR = base.pct_reinversion != null ? Number(base.pct_reinversion)
        : numero(base.ingresos) ? (numero(base.reinversion) / numero(base.ingresos)) * 100 : 0;
      const pctT = base.pct_trabajadora != null ? Number(base.pct_trabajadora)
        : numero(base.ingresos) ? (numero(base.trabajadoras) / numero(base.ingresos)) * 100 : 0;
      const pctE = Math.max(0, 100 - pctR - pctT);
      const filas = [
        { nombre: "Ganancia de la empleada", USD: p.USD?.trabajadoras, CUP: p.CUP?.trabajadoras, pct: pctT },
        { nombre: "Reinversión en el salón", USD: p.USD?.reinversion, CUP: p.CUP?.reinversion, pct: pctR },
        { nombre: "AM Luxury Beauty Estudio", USD: p.USD?.estudio_libre, CUP: p.CUP?.estudio_libre, pct: pctE },
      ];
      // El mayor porcentaje toma el rosa más oscuro; los demás bajan parejo.
      const colorDe = coloresPorPuesto(filas.map((f) => f.pct), "USD");
      for (const f of filas) f.color = colorDe(f.pct);
      // Tramos de menor a mayor: el tono más oscuro siempre queda a la derecha.
      const tramos = [...filas].sort((a, b) => a.pct - b.pct);
      const citas = citasDe(p);
      const conIngresos = numero(p.USD?.ingresos) + numero(p.CUP?.ingresos) > 0;
      return `
      <details class="acordeon" style="${TARJETA}">
        <summary style="${CABECERA}">
          <span class="acordeon-flecha" style="${FLECHA}">›</span>
          <span class="acordeon-titulo" style="${TITULO}">
            ${escapeHtml(p.servicio_nombre)}${p.es_adicional ? `<span class="etiqueta-adicional" style="${ETIQUETA}">Adicional</span>` : ""}
            <span style="${SUB}">${citas} ${citas === 1 ? "cita" : "citas"}</span>
          </span>
          <span class="acordeon-monto" style="${MONTO}">${ambas(p.USD?.ingresos, p.CUP?.ingresos)}</span>
        </summary>
        <div class="acordeon-cuerpo" style="${CUERPO}">
          ${conIngresos ? `
          <div class="barra-reparto" style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin:10px 0;background:var(--border,#E3BCCC)">
            ${tramos.map((f) => `<div style="background:${f.color};width:${f.pct}%"></div>`).join("")}
          </div>
          ${filas.map((f) => `
            <div class="reparto-fila" style="${FILA}">
              <span class="reparto-punto" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${f.color}"></span>
              <span class="reparto-nombre" style="flex:1">${f.nombre}</span>
              <span class="lista-secundario" style="color:var(--muted,#8A7680);font-size:13px">${pctTxt(f.pct)}</span>
              <span class="reparto-monto" style="font-weight:700;white-space:nowrap">${ambas(f.USD, f.CUP)}</span>
            </div>`).join("")}
          <hr style="border:none;border-top:1px solid var(--border,#E3BCCC);margin:8px 0" />
          <div class="reparto-fila" style="${FILA}">
            <span style="flex:1;font-weight:700">AM Luxury en total</span>
            <span class="reparto-monto" style="font-weight:700;white-space:nowrap">${ambas(
              numero(p.USD?.reinversion) + numero(p.USD?.estudio_libre),
              numero(p.CUP?.reinversion) + numero(p.CUP?.estudio_libre)
            )}</span>
          </div>
          <p style="${NOTA}">Porcentajes del servicio: reinversión ${pctTxt(pctR)} · empleada ${pctTxt(pctT)}. La reinversión también es de AM Luxury.</p>
          ` : `<p style="${NOTA};margin:8px 0 0">Sin ingresos en este período.</p>`}
        </div>
      </details>`;
    };

    return `
      <div class="gan-bloque gan-categorias">
        <div class="gan-bloque-cab">
          <span class="gan-bloque-ico">${icono.capas(16)}</span>
          <h3>Por categoría</h3>
        </div>
        <div class="gan-categorias-lista">
      ${grupos.map((g) => {
        const ico = icoCategoria(g.categoria);
        const t = sumarCategoria(g.items);
        const base = numero(t.USD.ingresos) > 0 ? t.USD : t.CUP;
        const totalCitas = t.USD.citas + t.CUP.citas;
        const pctDe = (v) => (base.ingresos > 0 ? (v / base.ingresos) * 100 : 0);
        // Cada métrica: importes de ambas monedas y su peso en el total.
        const metrica = (etiqueta, usd, cup, pct, destacada = false) => `
          <div class="cat-metrica${destacada ? " destacada" : ""}">
            <span>${etiqueta}</span>
            <strong>${ambas(usd, cup)}</strong>
            ${base.ingresos > 0 ? `<small>${pctTxt(pct)} del total</small>` : ""}
          </div>`;
        return `
        <div class="cat-card">
          <div class="cat-cab">
            <span class="cat-cab-ico">${ico ? `<img src="${ico}" alt="" />` : `<i></i>`}</span>
            <div class="cat-cab-info">
              <div class="cat-cab-nombre">${escapeHtml(mostrarCategoria(g.categoria))}</div>
              <div class="cat-cab-meta">${g.items.length} ${g.items.length === 1 ? "servicio" : "servicios"} · ${totalCitas} ${totalCitas === 1 ? "cita" : "citas"}</div>
            </div>
            <div class="cat-cab-total">
              <span>Recaudado</span>
              <strong>${ambas(t.USD.ingresos, t.CUP.ingresos)}</strong>
            </div>
          </div>
          <div class="cat-cuerpo">
            <div class="cat-metricas">
              ${metrica("Reinversión", t.USD.reinversion, t.CUP.reinversion, pctDe(base.reinversion))}
              ${metrica("Libre para AM", t.USD.libre, t.CUP.libre, pctDe(base.libre))}
              ${metrica("AM Luxury", t.USD.reinversion + t.USD.libre, t.CUP.reinversion + t.CUP.libre,
                pctDe(base.reinversion + base.libre), true)}
            </div>
            <div class="cat-lista-titulo">Servicios <b>(${g.items.length})</b></div>
            <div class="cat-servicios">${g.items.map(acordeon).join("")}</div>
          </div>
        </div>`;
      }).join("")}
        </div>
      </div>`;
  }

  /** 15 -> "15%", 12.5 -> "12.5%" */
  function pctTxt(v) {
    const n = Number(v);
    return `${n % 1 ? n.toFixed(1) : n}%`;
  }

  function seccionBarras(dias) {
    if (!dias?.length) return "";
    // En trimestre/semestre/año se resume por mes (un día por barra sería ilegible).
    const porMes = ["trimestre", "semestre", "anio"].includes(periodo);
    const mapa = new Map();
    for (const d of dias) {
      const clave = porMes ? d.fecha.slice(0, 7) : d.fecha;
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          etiqueta: porMes ? mesCorto(clave) : diaCorto(d.fecha),
          usd: 0, cup: 0,
        });
      }
      const fila = mapa.get(clave);
      fila.usd += numero(d.USD?.ingresos);
      fila.cup += numero(d.CUP?.ingresos);
    }
    const filas = [...mapa.values()];
    const maxUsd = Math.max(...filas.map((f) => f.usd), 1);
    const maxCup = Math.max(...filas.map((f) => f.cup), 1);
    return `
      <div class="paso-titulo">${porMes ? "Por mes" : "Por día"}</div>
      ${filas.map((f) => `
        <div class="barra-dia">
          <span class="nombre">${escapeHtml(f.etiqueta)}</span>
          <span class="pista">
            <span class="relleno relleno-usd" style="width:${(f.usd / maxUsd) * 100}%;background:#CE7C94"></span>
            <span class="relleno relleno-cup" style="width:${(f.cup / maxCup) * 100}%;background:#8E6BB8"></span>
          </span>
          <span class="monto">${ambas(f.usd, f.cup)}</span>
        </div>`).join("")}`;
  }

  /** Fecha local como YYYY-MM-DD. */
  function aISOFecha(d) {
    const dos = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  }

  pintarChips();
  await cargar();
}
