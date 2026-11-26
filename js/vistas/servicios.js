// Gestión de servicios (solo admin). Equivalente a src/app/servicios/index.tsx.

import { get } from "../api.js?v=49";
import { $, categoriasDe, escapeHtml, mostrarCategoria, usd, compararCategorias, colorCategoria, colorCategoriaCabecera, textoSubtipo } from "../util.js?v=55";
import { icono, icoCategoria } from "../iconos.js?v=64";
import { activarFabAlDesplazar } from "../fab-flotante.js?v=1";

/** Duración compacta para el catálogo: "45m", "1h", "1h 30m". */
function duracionCorta(min) {
  const n = Number(min);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 60) return `${n}m`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export async function render(raiz) {
  const [servicios, empleados] = await Promise.all([get("/servicios"), get("/empleados")]);
  const nombresPorId = new Map((empleados || []).map((e) => [e.id, e.nombre]));
  let mostrarInactivos = false;
  let textoBusqueda = "";

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${icono.etiqueta(22)}</span>
      <h1 class="vista-titulo">Servicios</h1>
      <a class="chip-enlace" id="btn-nuevo-servicio" href="#/servicios/nuevo">＋ Nuevo</a>
    </div>
    <div class="buscador-fila">
      <div class="campo-ico" style="flex:1">
        ${icono.lupa()}
        <input class="input" id="buscar" placeholder="Buscar por nombre o categoría" />
      </div>
    </div>
    <div class="chips">
      <button class="chip" id="chip-inactivos" type="button">Mostrar inactivos</button>
      <span class="contador" id="contador"></span>
    </div>
    <div id="lista"></div>
    <a class="fab-nueva" id="fab-nuevo-servicio" href="#/servicios/nuevo"
       aria-label="Nuevo servicio" title="Nuevo servicio">${icono.mas(24)}</a>`;

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
    const visibles = servicios.filter((s) => {
      if (!mostrarInactivos && !s.activo) return false;
      if (!textoBusqueda) return true;
      const enNombre = s.nombre.toLowerCase().includes(textoBusqueda);
      const enCategoria = categoriasDe(s).some((c) =>
        c.toLowerCase().includes(textoBusqueda) || mostrarCategoria(c).toLowerCase().includes(textoBusqueda));
      return enNombre || enCategoria;
    });

    $("#contador").textContent = `${visibles.length} servicios`;

    // Agrupar por categoría (un servicio con categorías extra aparece en cada una).
    const grupos = new Map();
    visibles.forEach((s) => {
      categoriasDe(s).forEach((cat) => {
        if (!grupos.has(cat)) grupos.set(cat, []);
        grupos.get(cat).push(s);
      });
    });

    if (!visibles.length) {
      $("#lista").innerHTML = `<div class="vacio">Sin resultados.</div>`;
      return;
    }

    // Dentro de cada categoría los servicios típicos van siempre antes que los adicionales.
    $("#lista").innerHTML = [...grupos.entries()].sort((a, b) => compararCategorias(a[0], b[0]))
      .map(([cat, lista]) => {
        const ico = icoCategoria(cat);
        const fondo = colorCategoria(cat);
        const fondoOscuro = colorCategoriaCabecera(cat);
        return `
        <div class="tarjeta-grupo-cat" style="background:${fondo}">
          <div class="grupo-cat-cab" style="background:${fondoOscuro}">
            ${ico ? `<img class="cat-ico" src="${ico}" alt="" />` : ""}
            <span class="grupo-cat-titulo">${escapeHtml(mostrarCategoria(cat))}</span>
            <a class="grupo-cat-add" href="#/servicios/nuevo?categoria=${encodeURIComponent(cat)}"
               title="Añadir servicio a ${escapeHtml(mostrarCategoria(cat))}"
               aria-label="Añadir servicio a ${escapeHtml(mostrarCategoria(cat))}">${icono.mas(14)}</a>
            <span class="grupo-cat-chip">${lista.length}</span>
          </div>
          <div class="cat-cuerpo-lista">
          ${[...lista].sort((a, b) =>
            Number(Boolean(a.es_adicional)) - Number(Boolean(b.es_adicional))
          ).map((s) => {
            const especialistas = (s.empleado_ids || [])
              .map((id) => nombresPorId.get(id))
              .filter(Boolean);
            const subtipos = (s.subtipos || []).map(textoSubtipo).filter(Boolean);
            return `
            <a class="lista-fila ${s.activo ? "" : "opaca"}" href="#/servicios/${s.id}">
              <span class="svc-principal">
                <span class="svc-nombre">
                  <span class="svc-nombre-txt" title="${escapeHtml(s.nombre)}">${escapeHtml(s.nombre)}</span>
                  ${!s.activo ? `<span class="badge badge-gris">Inactivo</span>` : ""}
                  ${s.es_adicional ? `<span class="badge badge-azul">Adicional</span>` : ""}
                </span>
                <span class="svc-especialista${especialistas.length ? "" : " sin"}">
                  ${icono.usuario(13)}
                  <span class="svc-especialista-txt">${especialistas.length ? escapeHtml(especialistas.join(" · ")) : "Sin especialista asignada"}</span>
                </span>
                ${subtipos.length ? `
                  <span class="svc-subtipos">
                    ${subtipos.map((t) => `<span class="svc-subtipo">${escapeHtml(t)}</span>`).join("")}
                  </span>` : ""}
              </span>
              <span class="svc-derecha">
                <span class="svc-precio" title="${usd(s.precio)} USD">${usd(s.precio)}</span>
                <span class="svc-duracion">${icono.reloj(11)}${duracionCorta(s.duracion_min)}</span>
              </span>
            </a>`;
          }).join("")}
          </div>
        </div>`;
      })
      .join("");
  }

  pintar();

  // Botón flotante: sustituye al "+ Nuevo" cuando este se oculta al bajar.
  activarFabAlDesplazar(
    $("#btn-nuevo-servicio"),
    $("#fab-nuevo-servicio"),
    document.querySelector(".cabecera")
  );
}
