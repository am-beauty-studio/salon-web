// Ganancias (solo admin). Equivalente a src/app/ganancias.tsx.

import { get } from "../api.js?v=49";
import {
  $, $$, escapeHtml, sumarDias, sumarMeses, etiqueta, etiquetaSemana, tituloMes,
  tituloTrimestre, tituloSemestre, tituloAnio, mesCorto,
  diaCorto, importe, mostrarCategoria, compararCategorias,
} from "../util.js?v=54";
import { icoCategoria, icono } from "../iconos.js?v=64";
import { abrirCalendario } from "./componentes.js?v=52";

const ROSAS = [
  "#B25572", "#C06A86", "#CD7E97", "#D992A8",
  "#E3A6B9", "#EBBAC9", "#F2CCD8", "#F8DEE6",
];

// Moneda seleccionada en el filtro. Los importes que llegan del API ya están
// convertidos, así que solo hay que darles formato con su símbolo.
let monedaActual = "USD";
const monto = (valor) => importe(valor, monedaActual);

/**
 * Colores por puesto para las gráficas de barra: el porcentaje mayor toma el
 * tono más oscuro y los siguientes bajan de forma pareja hasta el más claro,
 * sin importar cuánto se diferencien entre sí. Devuelve valor → color.
 */
function coloresPorPuesto(valores) {
  const unicos = [...new Set(valores.map(Number))].sort((a, b) => b - a);
  const pasos = new Map();
  unicos.forEach((v, i) => {
    const paso = unicos.length > 1
      ? Math.round((i / (unicos.length - 1)) * (ROSAS.length - 1))
      : 0;
    pasos.set(v, ROSAS[paso]);
  });
  return (valor) => pasos.get(Number(valor)) ?? ROSAS[ROSAS.length - 1];
}

export async function render(raiz) {
  let periodo = "dia";
  let fecha = new Date();
  let moneda = "USD";

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
      <div class="filtro-etiqueta">Moneda</div>
      <div class="segmentado" role="tablist" aria-label="Moneda de las ganancias">
        <button class="segmento activo" data-m="USD" type="button" role="tab" aria-selected="true">USD</button>
        <button class="segmento" data-m="CUP" type="button" role="tab" aria-selected="false">CUP</button>
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
      El filtro de moneda separa lo cobrado en USD de lo cobrado en CUP.
    </p>`;

  $$(".segmentado [data-p]").forEach((chip) => {
    chip.onclick = () => {
      periodo = chip.dataset.p;
      pintarChips();
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
    let resumen;
    try {
      const iso = aISOFecha(fecha);
      resumen = await get(`/finanzas/resumen?periodo=${periodo}&fecha=${iso}&moneda=${moneda}`);
    } catch (e) {
      caja.innerHTML = `<p class="error-txt">${escapeHtml(e.message)}</p>`;
      return;
    }
    pintar(resumen);
  }

  function pintar(r) {
    const t = r.totales;
    const caja = $("#contenido");
    monedaActual = r.moneda || moneda;

    if (!t.citas) {
      caja.innerHTML = `<div class="vacio">Sin ganancias registradas en este período.</div>
        ${r.pendiente.citas ? pendienteHtml(r) : ""}`;
      return;
    }

    const pct = (monto) => Number(t.ingresos) ? (Number(monto) / Number(t.ingresos)) * 100 : 0;
    // El mayor porcentaje toma el rosa más oscuro; los demás bajan parejo.
    const colorDe = coloresPorPuesto([
      Number(t.trabajadoras) || 0,
      Number(t.reinversion) || 0,
      Number(t.estudio_libre) || 0,
    ]);
    const filas = [
      { nombre: "Trabajadoras", monto: t.trabajadoras },
      { nombre: "Reinversión en el salón", monto: t.reinversion },
      { nombre: "Libre para AM Luxury", monto: t.estudio_libre },
    ].map((f) => ({ ...f, color: colorDe(f.monto) }));
    // Tramos de menor a mayor: el tono más oscuro siempre queda a la derecha.
    const tramos = [...filas].sort((a, b) => Number(a.monto) - Number(b.monto));

    caja.innerHTML = `
      <div class="tarjeta">
        <div class="nota">Ingresos · ${t.citas} ${t.citas === 1 ? "cita" : "citas"} completada(s)</div>
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

      ${r.pendiente.citas ? pendienteHtml(r) : ""}

      ${seccionLista("Por trabajadora", r.por_trabajadora.map((x) => ({
        titulo: x.empleado_nombre,
        detalle: `${x.citas} ${x.citas === 1 ? "cita" : "citas"} · ${monto(x.ingresos)} ${monedaActual} generados`,
        derecho: `le corresponde ${monto(x.trabajadoras)} ${monedaActual}`,
      })), !r.por_trabajadora.length)}

      ${seccionServicios(r.por_servicio)}

      ${periodo !== "dia" ? seccionBarras(r.por_dia) : ""}
    `;
  }

  function pendienteHtml(r) {
    return `
      <div class="caja-amarilla">
        <b>Pendiente: ${r.pendiente.citas} ${r.pendiente.citas === 1 ? "cita" : "citas"} programada(s) · ${monto(r.pendiente.monto)} ${monedaActual}</b>
        <div class="nota">Aún no cuentan como ganancia: se suman al marcarlas como completadas.</div>
      </div>`;
  }

  function seccionLista(titulo, filas, vacio) {
    if (vacio) return "";
    return `
      <div class="paso-titulo">${titulo}</div>
      ${filas.map((f) => `
        <div class="lista-fila" style="cursor:default">
          <span class="lista-principal">
            ${escapeHtml(f.titulo)}
            <br/><span class="lista-secundario">${escapeHtml(f.detalle)}</span>
          </span>
          <span class="lista-secundario">${escapeHtml(f.derecho)}</span>
        </div>`).join("")}`;
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
    const MONTO = "color:var(--gold-dark,#96405C);font-weight:700;font-size:16px;white-space:nowrap";
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
        (Number(b.ingresos) || 0) - (Number(a.ingresos) || 0)
        || String(a.servicio_nombre).localeCompare(String(b.servicio_nombre), "es")
      );
    }

    /** Totales de la categoría: montos y número de citas. */
    const sumarCategoria = (items) => {
      const t = { ingresos: 0, reinversion: 0, libre: 0, citas: 0 };
      for (const p of items) {
        t.ingresos += Number(p.ingresos) || 0;
        t.reinversion += Number(p.reinversion) || 0;
        t.libre += Number(p.estudio_libre) || 0;
        t.citas += Number(p.citas) || 0;
      }
      return t;
    };

    const acordeon = (p) => {
      // Porcentajes tal como están configurados en el servicio
      // (respaldo: según lo liquidado, por si el API aún no los envía).
      const pctR = p.pct_reinversion != null ? Number(p.pct_reinversion)
        : Number(p.ingresos) ? (Number(p.reinversion) / Number(p.ingresos)) * 100 : 0;
      const pctT = p.pct_trabajadora != null ? Number(p.pct_trabajadora)
        : Number(p.ingresos) ? (Number(p.trabajadoras) / Number(p.ingresos)) * 100 : 0;
      const pctE = Math.max(0, 100 - pctR - pctT);
      const filas = [
        { nombre: "Ganancia de la empleada", monto: p.trabajadoras, pct: pctT },
        { nombre: "Reinversión en el salón", monto: p.reinversion, pct: pctR },
        { nombre: "AM Luxury Beauty Estudio", monto: p.estudio_libre, pct: pctE },
      ];
      // El mayor porcentaje toma el rosa más oscuro; los demás bajan parejo.
      const colorDe = coloresPorPuesto(filas.map((f) => f.pct));
      for (const f of filas) f.color = colorDe(f.pct);
      // Tramos de menor a mayor: el tono más oscuro siempre queda a la derecha.
      const tramos = [...filas].sort((a, b) => a.pct - b.pct);
      return `
      <details class="acordeon" style="${TARJETA}">
        <summary style="${CABECERA}">
          <span class="acordeon-flecha" style="${FLECHA}">›</span>
          <span class="acordeon-titulo" style="${TITULO}">
            ${escapeHtml(p.servicio_nombre)}${p.es_adicional ? `<span class="etiqueta-adicional" style="${ETIQUETA}">Adicional</span>` : ""}
            <span style="${SUB}">${p.citas} ${p.citas === 1 ? "cita" : "citas"}</span>
          </span>
          <span class="acordeon-monto" style="${MONTO}">${monto(p.ingresos)}</span>
        </summary>
        <div class="acordeon-cuerpo" style="${CUERPO}">
          ${Number(p.ingresos) > 0 ? `
          <div class="barra-reparto" style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin:10px 0;background:var(--border,#E3BCCC)">
            ${tramos.map((f) => `<div style="background:${f.color};width:${f.pct}%"></div>`).join("")}
          </div>
          ${filas.map((f) => `
            <div class="reparto-fila" style="${FILA}">
              <span class="reparto-punto" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${f.color}"></span>
              <span class="reparto-nombre" style="flex:1">${f.nombre}</span>
              <span class="lista-secundario" style="color:var(--muted,#8A7680);font-size:13px">${pctTxt(f.pct)}</span>
              <span class="reparto-monto" style="color:var(--gold-dark,#96405C);font-weight:700;white-space:nowrap">${monto(f.monto)}</span>
            </div>`).join("")}
          <hr style="border:none;border-top:1px solid var(--border,#E3BCCC);margin:8px 0" />
          <div class="reparto-fila" style="${FILA}">
            <span style="flex:1;font-weight:700">AM Luxury en total</span>
            <span style="color:var(--gold-dark,#96405C);font-weight:700;white-space:nowrap">${monto(p.estudio_total)}</span>
          </div>
          <p style="${NOTA}">Porcentajes del servicio: reinversión ${pctTxt(pctR)} · empleada ${pctTxt(pctT)}. La reinversión también es de AM Luxury.</p>
          ` : `<p style="${NOTA};margin:8px 0 0">Sin ingresos en este período.</p>`}
        </div>
      </details>`;
    };

    return `
      <div class="paso-titulo" style="margin-top:18px">Por categoría · ${monedaActual}</div>
      ${grupos.map((g) => {
        const ico = icoCategoria(g.categoria);
        const t = sumarCategoria(g.items);
        const amLuxury = t.reinversion + t.libre;
        const pctDe = (v) => (t.ingresos > 0 ? (v / t.ingresos) * 100 : 0);
        // Cada métrica: importe principal y, si hay ingresos, su peso en el total.
        const metrica = (etiqueta, valor, pct, destacada = false) => `
          <div class="cat-metrica${destacada ? " destacada" : ""}">
            <span>${etiqueta}</span>
            <strong>${monto(valor)}</strong>
            ${t.ingresos > 0 ? `<small>${pctTxt(pct)} del total</small>` : ""}
          </div>`;
        return `
        <div class="cat-card">
          <div class="cat-cab">
            <span class="cat-cab-ico">${ico ? `<img src="${ico}" alt="" />` : `<i></i>`}</span>
            <div class="cat-cab-info">
              <div class="cat-cab-nombre">${escapeHtml(mostrarCategoria(g.categoria))}</div>
              <div class="cat-cab-meta">${g.items.length} ${g.items.length === 1 ? "servicio" : "servicios"} · ${t.citas} ${t.citas === 1 ? "cita" : "citas"}</div>
            </div>
            <div class="cat-cab-total">
              <span>Recaudado</span>
              <strong>${monto(t.ingresos)}</strong>
            </div>
          </div>
          <div class="cat-cuerpo">
            <div class="cat-metricas">
              ${metrica("Reinversión", t.reinversion, pctDe(t.reinversion))}
              ${metrica("Libre para AM", t.libre, pctDe(t.libre))}
              ${metrica("AM Luxury", amLuxury, pctDe(amLuxury), true)}
            </div>
            <div class="cat-lista-titulo">Servicios <b>(${g.items.length})</b></div>
            <div class="cat-servicios">${g.items.map(acordeon).join("")}</div>
          </div>
        </div>`;
      }).join("")}`;
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
    let filas;
    if (porMes) {
      const mapa = new Map();
      for (const d of dias) {
        const clave = d.fecha.slice(0, 7);
        mapa.set(clave, (mapa.get(clave) || 0) + Number(d.ingresos));
      }
      filas = [...mapa.entries()].map(([clave, monto]) => ({ etiqueta: mesCorto(clave), monto }));
    } else {
      filas = dias.map((d) => ({ etiqueta: diaCorto(d.fecha), monto: Number(d.ingresos) }));
    }
    const max = Math.max(...filas.map((f) => f.monto), 1);
    // La barra mayor toma el tono más oscuro; el resto baja parejo hasta el claro.
    const colorDe = coloresPorPuesto(
      filas.filter((f) => Number(f.monto) > 0).map((f) => f.monto)
    );
    return `
      <div class="paso-titulo">${porMes ? "Por mes" : "Por día"}</div>
      ${filas.map((f) => `
        <div class="barra-dia">
          <span class="nombre">${escapeHtml(f.etiqueta)}</span>
          <span class="pista"><span class="relleno"
            style="display:block;height:100%;background:linear-gradient(to right,#F8DEE6,${colorDe(f.monto)});border-radius:5px;width:${(f.monto / max) * 100}%"></span></span>
          <span class="monto">${monto(f.monto)}</span>
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
