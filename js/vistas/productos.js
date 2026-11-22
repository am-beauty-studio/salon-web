// Inventario de productos (solo admin). Agrupado por categoría, igual que el
// catálogo de servicios. Equivalente a src/app/productos/index.tsx.

import { get } from "../api.js?v=49";
import {
  $, compararCategorias, escapeHtml, mostrarCategoria, textoSubtipo,
  colorCategoria, colorCategoriaCabecera,
} from "../util.js?v=52";
import { icono, icoCategoria } from "../iconos.js?v=64";

/** "69.00" -> "69"; "0.350" -> "0.35" (sin ceros sobrantes). */
function num(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "0";
  return String(Number(n.toFixed(3)));
}

function plural(unidad, cantidad) {
  const u = (unidad || "unidad").trim();
  if (Number(cantidad) === 1) return u;
  return /[aeiouáéíóú]$/i.test(u) ? `${u}s` : `${u}es`;
}

/** "1 flor por cita" / "7 unidades cada 20 citas". */
function consumoTxt(p) {
  const cantidad = Number(p.consumo_cantidad);
  const citas = Number(p.consumo_citas);
  if (!cantidad || !citas) return "Sin consumo definido";
  const unidad = plural(p.unidad, cantidad);
  if (citas === 1) return `${num(cantidad)} ${unidad} por cita`;
  return `${num(cantidad)} ${unidad} cada ${citas} citas`;
}

/** "≈ 69 citas", "Sin stock" o "Sin consumo". */
function coberturaTxt(p) {
  if (Number(p.cantidad) <= 0) return "Sin stock";
  if (p.citas_restantes === null || p.citas_restantes === undefined) {
    return "Sin consumo";
  }
  return p.citas_restantes === 1 ? "≈ 1 cita" : `≈ ${p.citas_restantes} citas`;
}

export async function render(raiz, _params, query) {
  const productos = await get("/productos?solo_activos=false");
  let mostrarInactivos = query?.get("inactivos") === "1";
  let textoBusqueda = "";

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${icono.caja(22)}</span>
      <h1 class="vista-titulo">Productos</h1>
      <a class="chip-enlace" href="#/productos/nuevo">＋ Nuevo</a>
    </div>
    <div class="buscador-fila">
      <div class="campo-ico" style="flex:1">
        ${icono.lupa()}
        <input class="input" id="buscar" placeholder="Buscar por producto, categoría o servicio" />
      </div>
    </div>
    <div class="chips">
      <button class="chip ${mostrarInactivos ? "activo" : ""}" id="chip-inactivos" type="button">Mostrar inactivos</button>
      <span class="contador" id="contador"></span>
    </div>
    <div id="lista"></div>`;

  $("#chip-inactivos").onclick = () => {
    mostrarInactivos = !mostrarInactivos;
    $("#chip-inactivos").classList.toggle("activo", mostrarInactivos);
    pintar();
  };

  $("#buscar").addEventListener("input", (e) => {
    textoBusqueda = e.target.value.trim().toLowerCase();
    pintar();
  });

  function pintar() {
    const visibles = productos.filter((p) => {
      if (!mostrarInactivos && !p.activo) return false;
      if (!textoBusqueda) return true;
      const campos = [
        p.nombre, p.unidad, p.servicio_nombre, p.subtipo, p.notas,
        ...(p.categorias || [p.categoria]),
      ];
      return campos
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(textoBusqueda));
    });

    $("#contador").textContent =
      `${visibles.length} producto${visibles.length === 1 ? "" : "s"}`;

    const grupos = new Map();
    visibles.forEach((p) => {
      (p.categorias?.length ? p.categorias : [p.categoria]).forEach((cat) => {
        if (!grupos.has(cat)) grupos.set(cat, []);
        grupos.get(cat).push(p);
      });
    });

    if (!visibles.length) {
      $("#lista").innerHTML = `<div class="vacio">Sin resultados.</div>`;
      return;
    }

    $("#lista").innerHTML = [...grupos.entries()]
      .sort((a, b) => compararCategorias(a[0], b[0]))
      .map(([cat, lista]) => {
        const ico = icoCategoria(cat);
        const fondo = colorCategoria(cat);
        const fondoOscuro = colorCategoriaCabecera(cat);
        return `
        <div class="tarjeta-grupo-cat" style="background:${fondo}">
          <div class="grupo-cat-cab" style="background:${fondoOscuro}">
            ${ico ? `<img class="cat-ico" src="${ico}" alt="" />` : ""}
            <span class="grupo-cat-titulo">${escapeHtml(mostrarCategoria(cat))}</span>
            <span class="grupo-cat-chip">${lista.length}</span>
          </div>
          <div class="cat-cuerpo-lista">
          ${[...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
            .map((p) => {
              const sinStock = Number(p.cantidad) <= 0;
              const stockBajo = Number(p.cantidad) <= Number(p.stock_minimo);
              return `
              <a class="lista-fila ${p.activo ? "" : "opaca"}" href="#/productos/${p.id}">
                <span class="prod-principal">
                  <span class="prod-nombre">
                    <span class="prod-nombre-txt" title="${escapeHtml(p.nombre)}">${escapeHtml(p.nombre)}</span>
                    ${!p.activo ? `<span class="badge badge-gris">Inactivo</span>` : ""}
                    ${stockBajo ? `<span class="badge ${sinStock ? "badge-rojo" : "badge-aviso"}">${sinStock ? "Agotado" : "Stock bajo"}</span>` : ""}
                  </span>
                  ${p.servicio_nombre ? `
                    <span class="prod-servicio">
                      ${icono.etiqueta(12)}
                      <span class="prod-servicio-txt">${escapeHtml(p.servicio_nombre)}</span>
                      ${p.subtipo ? `<span class="svc-subtipo">${escapeHtml(textoSubtipo(p.subtipo))}</span>` : ""}
                    </span>` : ""}
                  <span class="prod-consumo">
                    ${icono.repetir(12)}
                    <span class="prod-consumo-txt">${escapeHtml(consumoTxt(p))}</span>
                  </span>
                </span>
                <span class="prod-derecha">
                  <span class="prod-cantidad${sinStock ? " sin-stock" : ""}">${num(p.cantidad)} <small>${escapeHtml(plural(p.unidad, p.cantidad))}</small></span>
                  <span class="prod-citas ${sinStock ? "sin-stock" : ""}">${escapeHtml(coberturaTxt(p))}</span>
                </span>
              </a>`;
            }).join("")}
          </div>
        </div>`;
      })
      .join("");
  }

  pintar();
}
