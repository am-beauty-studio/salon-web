// Formulario de servicio (nuevo / editar, solo admin).
// Equivalente a ServicioForm + zonas de peligro de src/app/servicios/*.

import { get, post, patch, del } from "../api.js?v=49";
import { $, $$, aviso, confirmar, escapeHtml, categoriasDe, mostrarCategoria, categoriaCanonica, nombreCorto, compararCategorias, normalizarClave, usd } from "../util.js?v=55";
import { icono, icoCategoria } from "../iconos.js?v=64";

const ROSAS = [
  "#B25572", "#C06A86", "#CD7E97", "#D992A8",
  "#E3A6B9", "#EBBAC9", "#F2CCD8", "#F8DEE6",
];

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

export async function render(raiz, params, query) {
  const nuevo = params.modo === "nuevo";
  let servicio = nuevo ? null : await get(`/servicios/${params.id}`);
  const servicios = await get("/servicios");
  const empleados = await get("/empleados");
  // Categoría preseleccionada al llegar desde el "+" de una categoría.
  const categoriaInicial = nuevo ? (query?.get("categoria") || "").trim() : "";

  const categoriasExistentes = [
    ...new Set(servicios.flatMap((s) => categoriasDe(s))),
  ].sort(compararCategorias);

  let especialistas = new Set(servicio?.empleado_ids || []);

  raiz.innerHTML = `
    <div class="form-vista">
      <div class="vista-cab">
        <span class="vista-ico">${icono.etiqueta(22)}</span>
        <div class="vista-cab-texto">
          <h1 class="vista-titulo">${nuevo ? "Nuevo servicio" : "Editar servicio"}</h1>
          <p class="form-sub">${nuevo
            ? (categoriaInicial
              ? `Añade un servicio a la categoría «${escapeHtml(mostrarCategoria(categoriaInicial))}».`
              : "Añade un servicio al catálogo del salón.")
            : `Actualiza los datos de «${escapeHtml(servicio.nombre)}».`}</p>
        </div>
      </div>

      <section class="form-seccion">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.etiqueta(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Datos del servicio</p>
            <p class="form-seccion-sub">Nombre, categoría y variantes que verá la clienta.</p>
          </div>
        </div>

        <div class="campo">
          <label class="etiqueta" for="sv-nombre">Nombre *</label>
          <div class="campo-ico">
            ${icono.lapiz()}
            <input class="input" id="sv-nombre" value="${escapeHtml(servicio?.nombre || "")}"
                   placeholder="Ej.: Manicura SPA Premium" />
          </div>
        </div>

        <div class="campo">
          <label class="etiqueta" for="sv-categoria">Categoría *</label>
          <div class="campo-ico">
            ${icono.etiqueta()}
            <input class="input" id="sv-categoria" value="${escapeHtml(servicio?.categoria || categoriaInicial)}"
                   placeholder="Ej.: Manicura" />
          </div>
          <div class="chips" style="margin-top:8px">
            ${categoriasExistentes.map((cat) => {
              const ico = icoCategoria(cat);
              return `
              <button type="button" class="chip chip-cat" data-cat="${escapeHtml(cat)}">${ico ? `<img class="cat-ico" src="${ico}" alt="" />` : ""}${escapeHtml(mostrarCategoria(cat))}</button>`;
            }).join("")}
          </div>
        </div>

        <div class="campo" style="margin-bottom:0">
          <label class="etiqueta" for="sv-subtipos">Tipos / subtipos (opcional)</label>
          <div class="campo-ico">
            ${icono.lista()}
            <input class="input" id="sv-subtipos" value="${escapeHtml((servicio?.subtipos || []).join(", "))}"
                   placeholder="Ej.: C, D" />
          </div>
          <p class="nota">Sepáralos con coma. Se ofrecen como opciones al agendar (Ej.: Tipo C / Tipo D).</p>
        </div>
      </section>

      <section class="form-seccion">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.reloj(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Tiempo y precio</p>
            <p class="form-seccion-sub">Duración en agenda y precio que paga la clienta.</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="campo">
            <label class="etiqueta" for="sv-duracion">Duración (min) *</label>
            <div class="campo-ico">
              ${icono.reloj()}
              <input class="input" id="sv-duracion" type="number" min="1" max="600"
                     value="${servicio?.duracion_min ?? 60}" />
            </div>
          </div>
          <div class="campo">
            <label class="etiqueta" for="sv-precio">Precio USD *</label>
            <div class="campo-ico">
              ${icono.dolar()}
              <input class="input" id="sv-precio" type="number" min="0" step="0.01"
                     value="${servicio?.precio ?? ""}" placeholder="0.00" />
            </div>
          </div>
        </div>
        <p class="form-pista" id="pista-precio"></p>
      </section>

      <section class="form-seccion">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.porcentaje(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Reparto de ganancias</p>
            <p class="form-seccion-sub">Cómo se divide el precio de cada cita.</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="campo">
            <label class="etiqueta" for="sv-reinv">% Reinversión</label>
            <div class="campo-ico">
              ${icono.porcentaje()}
              <input class="input" id="sv-reinv" type="number" min="0" max="100" step="0.01"
                     value="${servicio?.pct_reinversion ?? 10}" />
            </div>
          </div>
          <div class="campo">
            <label class="etiqueta" for="sv-trab">% Trabajadora</label>
            <div class="campo-ico">
              ${icono.porcentaje()}
              <input class="input" id="sv-trab" type="number" min="0" max="100" step="0.01"
                     value="${servicio?.pct_trabajadora ?? 30}" />
            </div>
          </div>
        </div>

        <div class="reparto">
          <div class="reparto-barra" aria-hidden="true">
            <span class="reparto-tramo reparto-reinv" id="rep-reinv"></span>
            <span class="reparto-tramo reparto-trab" id="rep-trab"></span>
            <span class="reparto-tramo reparto-estudio" id="rep-estudio"></span>
          </div>
          <div class="reparto-leyenda" id="rep-leyenda"></div>
        </div>
        <p class="nota" id="nota-reparto"></p>
      </section>

      <section class="form-seccion">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.personas(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Disponibilidad</p>
            <p class="form-seccion-sub">Dónde se ofrece y qué especialistas lo realizan.</p>
          </div>
        </div>

        <div class="switch-fila">
          <input type="checkbox" id="sv-adicional" ${servicio?.es_adicional ? "checked" : ""} />
          <label class="switch-texto" for="sv-adicional">
            <span class="switch-titulo">Servicio adicional</span>
            <span class="switch-sub">Se suma a un servicio principal (jelly, parafina…).</span>
          </label>
        </div>
        ${!nuevo ? `
          <div class="switch-fila">
            <input type="checkbox" id="sv-activo" ${servicio?.activo ? "checked" : ""} />
            <label class="switch-texto" for="sv-activo">
              <span class="switch-titulo">Servicio activo</span>
              <span class="switch-sub">Si lo desactivas, no aparecerá al agendar citas.</span>
            </label>
          </div>` : ""}

        <div class="paso-titulo" id="esp-titulo">Especialistas que lo realizan (${especialistas.size})</div>
        <div class="chips" id="chips-empleadas">
          ${empleados.map((e) => {
            const nombre = nombreCorto(e.nombre);
            const marcado = especialistas.has(e.id);
            return `
            <button type="button" class="chip chip-persona ${marcado ? "activo" : ""}"
                    data-id="${e.id}" data-nombre="${escapeHtml(nombre)}">
              ${marcado ? icono.check(13) : ""}${escapeHtml(nombre)}
            </button>`;
          }).join("")}
        </div>
        <p class="nota">Sin especialistas asignadas no aparecerá al agendar citas.</p>
      </section>

      <p class="error-txt oculto" id="sv-error"></p>

      <div class="form-acciones">
        <a class="btn btn-contorno" href="#/servicios">Volver</a>
        <button class="btn btn-dorado" id="btn-guardar" type="button">
          ${nuevo ? "Guardar servicio" : "Guardar cambios"}
        </button>
      </div>

      ${!nuevo ? `
        <div class="zona-peligro">
          <h3>Eliminar servicio</h3>
          <p>Se borrará definitivamente del catálogo. Si tiene citas asociadas,
             la API lo impedirá y podrás desactivarlo en su lugar.</p>
          <button class="btn btn-rojo-contorno" id="btn-eliminar" type="button">Eliminar servicio</button>
        </div>` : ""}
    </div>`;

  const pintarPistaPrecio = () => {
    const duracion = Number($("#sv-duracion").value);
    const precio = Number($("#sv-precio").value);
    const pista = $("#pista-precio");
    if (duracion > 0 && Number.isFinite(precio) && precio >= 0) {
      pista.innerHTML = `${icono.reloj(14)}<span>Aproximadamente <b>${usd(precio / (duracion / 60))}</b> por hora de trabajo.</span>`;
    } else {
      pista.innerHTML = "";
    }
  };
  $("#sv-duracion").addEventListener("input", pintarPistaPrecio);
  $("#sv-precio").addEventListener("input", pintarPistaPrecio);
  pintarPistaPrecio();

  const pintarNotaReparto = () => {
    const reinv = Math.max(0, Number($("#sv-reinv").value || 0));
    const trab = Math.max(0, Number($("#sv-trab").value || 0));
    const estudio = Math.max(100 - reinv - trab, 0);
    const excede = estudio < 0;

    // El color depende del porcentaje: el mayor toma el rosa más oscuro.
    const valores = [reinv, trab, estudio];
    const maxRep = Math.max(...valores);
    const minRep = Math.min(...valores);
    const colorReinv = colorRosa(reinv, maxRep, minRep);
    const colorTrab = colorRosa(trab, maxRep, minRep);
    const colorEstudio = colorRosa(estudio, maxRep, minRep);

    $("#rep-reinv").style.width = `${Math.min(reinv, 100)}%`;
    $("#rep-trab").style.width = `${Math.min(trab, 100)}%`;
    $("#rep-estudio").style.width = `${Math.min(estudio, 100)}%`;
    $("#rep-reinv").style.background = colorReinv;
    $("#rep-trab").style.background = colorTrab;
    $("#rep-estudio").style.background = colorEstudio;

    $("#rep-leyenda").innerHTML = `
      <span class="rep-leyenda-item"><i class="rep-punto" style="background:${colorReinv}"></i>Reinversión ${reinv.toFixed(2)}%</span>
      <span class="rep-leyenda-item"><i class="rep-punto" style="background:${colorTrab}"></i>Trabajadora ${trab.toFixed(2)}%</span>
      <span class="rep-leyenda-item"><i class="rep-punto" style="background:${colorEstudio}"></i>Estudio ${estudio.toFixed(2)}%</span>`;

    const nota = $("#nota-reparto");
    nota.textContent = excede
      ? "⚠️ La suma de porcentajes no puede pasar de 100."
      : `Queda ${estudio.toFixed(2)}% para el estudio.`;
    nota.classList.toggle("nota-error", excede);
  };
  $("#sv-reinv").addEventListener("input", pintarNotaReparto);
  $("#sv-trab").addEventListener("input", pintarNotaReparto);
  pintarNotaReparto();

  $$("#chips-empleadas .chip").forEach((chip) => {
    chip.onclick = () => {
      const id = Number(chip.dataset.id);
      if (especialistas.has(id)) especialistas.delete(id); else especialistas.add(id);
      const marcado = especialistas.has(id);
      chip.classList.toggle("activo", marcado);
      chip.innerHTML = `${marcado ? icono.check(13) : ""}${escapeHtml(chip.dataset.nombre)}`;
      $("#esp-titulo").textContent = `Especialistas que lo realizan (${especialistas.size})`;
    };
  });

  // Categoría señalada: el chip elegido se marca con un fondo más oscuro.
  const chipsCategoria = $$(".chip-cat");
  const marcarCategoria = () => {
    const valor = normalizarClave($("#sv-categoria").value);
    chipsCategoria.forEach((chip) => {
      chip.classList.toggle(
        "activo",
        Boolean(valor) && normalizarClave(chip.dataset.cat) === valor
      );
    });
  };
  chipsCategoria.forEach((chip) => {
    chip.onclick = () => {
      $("#sv-categoria").value = chip.dataset.cat;
      marcarCategoria();
    };
  });
  $("#sv-categoria").addEventListener("input", marcarCategoria);
  marcarCategoria();

  function leerFormulario() {
    const error = $("#sv-error");
    error.classList.add("oculto");
    const nombre = $("#sv-nombre").value.trim();
    let categoria = $("#sv-categoria").value.trim();
    const duracion = Number($("#sv-duracion").value);
    const precio = Number(String($("#sv-precio").value).replace(",", "."));
    const reinv = Number($("#sv-reinv").value || 0);
    const trab = Number($("#sv-trab").value || 0);
    const subtipos = $("#sv-subtipos").value.split(",").map((t) => t.trim()).filter(Boolean);

    if (nombre.length < 2) { return fallo("Escribe el nombre del servicio (mínimo 2 letras)."); }
    if (!categoria) { return fallo("Escribe la categoría del servicio."); }
    if (!duracion || duracion < 1 || duracion > 600) { return fallo("La duración debe estar entre 1 y 600 minutos."); }
    if (Number.isNaN(precio) || precio < 0) { return fallo("Escribe un precio válido."); }
    if (reinv + trab > 100) { return fallo("Reinversión + trabajadora no puede pasar de 100%."); }

    // Si la categoría ya existe con otra grafía, se reutiliza la existente.
    categoria = categoriaCanonica(categoria, categoriasExistentes);
    $("#sv-categoria").value = categoria;

    return {
      nombre,
      categoria,
      subtipos,
      es_adicional: $("#sv-adicional").checked,
      duracion_min: duracion,
      precio,
      pct_reinversion: reinv,
      pct_trabajadora: trab,
      empleado_ids: [...especialistas],
    };

    function fallo(mensaje) {
      error.textContent = mensaje;
      error.classList.remove("oculto");
      return null;
    }
  }

  $("#btn-guardar").onclick = async () => {
    const datos = leerFormulario();
    if (!datos) return;
    try {
      if (nuevo) {
        await post("/servicios", datos);
      } else {
        datos.activo = $("#sv-activo").checked;
        await patch(`/servicios/${servicio.id}`, datos);
      }
      aviso(nuevo ? "Servicio guardado" : "Cambios guardados", "ok");
      location.hash = "#/servicios";
    } catch (e) {
      $("#sv-error").textContent = e.message;
      $("#sv-error").classList.remove("oculto");
    }
  };

  if (!nuevo) {
    $("#btn-eliminar").onclick = async () => {
      if (!(await confirmar("Eliminar servicio",
        `¿Borrar definitivamente «${servicio.nombre}»?\n\nTambién se quitará de las especialistas asignadas.`,
        "Sí, eliminar"))) {
        return;
      }
      try {
        await del(`/servicios/${servicio.id}`);
        aviso("Servicio eliminado", "ok");
        location.hash = "#/servicios";
      } catch (e) {
        if (e.status === 409 || e.status === 405) {
          if (await confirmar("No se puede eliminar", e.message, "Desactivar")) {
            try {
              await patch(`/servicios/${servicio.id}`, { activo: false });
              aviso("Servicio desactivado", "ok");
              location.hash = "#/servicios";
            } catch (e2) { aviso(e2.message, "error"); }
          }
        } else {
          aviso(e.message, "error");
        }
      }
    };
  }
}
