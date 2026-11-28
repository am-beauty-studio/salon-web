// Formulario de producto (nuevo / editar, solo admin).
// Equivalente a ProductoForm + zonas de peligro de src/app/productos/*.

import { get, post, patch, del } from "../api.js?v=49";
import {
  $, $$, aviso, confirmar, escapeHtml, categoriasDe, categoriaCanonica,
  compararCategorias, mostrarCategoria, normalizarClave, textoSubtipo,
} from "../util.js?v=56";
import { icono, icoCategoria } from "../iconos.js?v=65";

function numero(valor, defecto = 0) {
  const texto = String(valor ?? "").trim().replace(",", ".");
  if (!texto) return defecto;
  const n = Number(texto);
  return Number.isFinite(n) ? n : defecto;
}

function limpiar(valor) {
  return String(valor ?? "").trim();
}

function numeroCorto(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "0";
  return String(Number(n.toFixed(3)));
}

function fechaMovimiento(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

function plural(unidad, cantidad) {
  const u = limpiar(unidad) || "unidad";
  if (Number(cantidad) === 1) return u;
  return /[aeiouáéíóú]$/i.test(u) ? `${u}s` : `${u}es`;
}

export async function render(raiz, params, query) {
  const nuevo = params.modo === "nuevo";
  const [producto, productos, servicios, movimientos] = await Promise.all([
    nuevo ? Promise.resolve(null) : get(`/productos/${params.id}`),
    get("/productos?solo_activos=false"),
    get("/servicios?solo_activos=false"),
    nuevo ? Promise.resolve([]) : get(`/productos/${params.id}/movimientos?limit=12`)
      .catch(() => []),
  ]);
  // Categoría preseleccionada al llegar desde el "+" de una categoría.
  const categoriaInicial = nuevo ? (query?.get("categoria") || "").trim() : "";

  // "Paquete" y "Full Service" se ven igual: se unen en un solo chip.
  const categorias = [...new Map(
    [
      ...productos.flatMap((p) => p.categorias || [p.categoria]),
      ...servicios.flatMap(categoriasDe),
    ]
      .filter(Boolean)
      .map((cat) => [normalizarClave(mostrarCategoria(cat)), cat])
  ).values()].sort(compararCategorias);

  // Se compara el texto visible: "Paquete" y "Full Service" son la misma.
  const claveVisible = (texto) => normalizarClave(mostrarCategoria(texto));
  // Categorías adicionales ya guardadas; se reutiliza la grafía del listado.
  const extras = new Set(
    (producto?.categorias_extra || [])
      .map((cat) => categorias.find((c) => claveVisible(c) === claveVisible(cat)) || cat)
  );
  const categoriasExtra = [...categorias];
  extras.forEach((cat) => {
    if (!categoriasExtra.some((c) => claveVisible(c) === claveVisible(cat))) {
      categoriasExtra.push(cat);
    }
  });

  raiz.innerHTML = `
    <div class="form-vista">
      <div class="vista-cab">
        <span class="vista-ico">${icono.caja(22)}</span>
        <div class="vista-cab-texto">
          <h1 class="vista-titulo">${nuevo ? "Nuevo producto" : "Editar producto"}</h1>
          <p class="form-sub">${nuevo
            ? (categoriaInicial
              ? `Añade un producto a la categoría «${escapeHtml(mostrarCategoria(categoriaInicial))}».`
              : "Añade un producto al inventario del salón.")
            : `Actualiza los datos de «${escapeHtml(producto.nombre)}».`}</p>
        </div>
      </div>

      <section class="form-seccion">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.etiqueta(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Datos del producto</p>
            <p class="form-seccion-sub">Nombre y categorías con las que se encontrará.</p>
          </div>
        </div>

        <div class="campo">
          <label class="etiqueta" for="pf-nombre">Nombre *</label>
          <div class="campo-ico">
            ${icono.caja()}
            <input class="input" id="pf-nombre" value="${escapeHtml(producto?.nombre || "")}"
                   placeholder="Ej.: Flor de jabón" />
          </div>
        </div>

        <div class="campo">
          <label class="etiqueta" for="pf-categoria">Categoría *</label>
          <div class="campo-ico">
            ${icono.etiqueta()}
            <input class="input" id="pf-categoria" value="${escapeHtml(producto?.categoria || categoriaInicial)}"
                   placeholder="Ej.: Manicura SPA" />
          </div>
          <div class="chips" style="margin-top:8px">
            ${categorias.map((cat) => {
              const ico = icoCategoria(cat);
              return `<button type="button" class="chip chip-cat" data-cat="${escapeHtml(cat)}">
                ${ico ? `<img class="cat-ico" src="${ico}" alt="" />` : ""}${escapeHtml(mostrarCategoria(cat))}
              </button>`;
            }).join("")}
          </div>
        </div>

        <div class="campo" style="margin-bottom:0">
          <details class="acordeon extras-plegable"${extras.size ? " open" : ""}>
            <summary>
              <span class="acordeon-flecha">›</span>
              <span class="acordeon-titulo">
                Categorías adicionales
                <span class="lista-secundario">Opcional: elige las que comparten este producto</span>
              </span>
              <span class="extras-contador" id="pf-extras-cuenta">${extras.size}</span>
            </summary>
            <div class="acordeon-cuerpo">
              <div class="extras-grid" id="pf-extras">
                ${categoriasExtra.map((cat) => {
                  const ico = icoCategoria(cat);
                  const marcada = [...extras].some(
                    (e) => claveVisible(e) === claveVisible(cat)
                  );
                  return `<label class="extra-opcion" data-extra-opcion="${escapeHtml(cat)}">
                    <input type="checkbox" data-extra="${escapeHtml(cat)}"${marcada ? " checked" : ""} />
                    <span class="extra-casilla"></span>
                    ${ico ? `<img class="cat-ico" src="${ico}" alt="" />` : ""}
                    <span class="extra-nombre">${escapeHtml(mostrarCategoria(cat))}</span>
                  </label>`;
                }).join("")}
              </div>
              <p class="nota">Marca las categorías que también comparten este producto. Se guardan al seleccionarlas.</p>
            </div>
          </details>
        </div>
      </section>

      <section class="form-seccion" id="pf-seccion-servicio">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.tijeras(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Vínculo con servicio</p>
            <p class="form-seccion-sub">A qué servicio se descuenta este producto al completar una cita.</p>
          </div>
        </div>

        <div class="campo" id="pf-bloque-servicio">
          <label class="etiqueta">Servicio vinculado</label>
          <select class="oculto" id="pf-servicio" tabindex="-1" aria-hidden="true">
            <option value="">— En todos —</option>
            ${servicios.map((sv) => `
              <option value="${sv.id}" ${Number(producto?.servicio_id) === Number(sv.id) ? "selected" : ""}>
                ${escapeHtml(sv.nombre)} · ${escapeHtml(mostrarCategoria(sv.categoria))}${sv.activo ? "" : " (inactivo)"}
              </option>`).join("")}
          </select>
          <details class="acordeon servicio-plegable" id="pf-servicio-plegable">
            <summary>
              <span class="acordeon-flecha">›</span>
              <span class="acordeon-titulo">
                <span class="servicio-plegable-nombre" id="pf-servicio-nombre">Todos los servicios</span>
                <span class="lista-secundario" id="pf-servicio-detalle">Aplica a toda la categoría</span>
              </span>
              <span class="servicio-plegable-cambio">Cambiar</span>
            </summary>
            <div class="acordeon-cuerpo">
              <div class="campo-ico servicio-buscador">
                ${icono.lupa()}
                <input class="input" id="pf-servicio-buscar" type="search"
                       placeholder="Buscar servicio..." autocomplete="off" />
              </div>
              <div class="servicio-lista" id="pf-servicio-lista" role="listbox"
                   aria-label="Servicio vinculado"></div>
              <p class="servicio-vacio oculto" id="pf-servicio-vacio">No hay servicios que coincidan.</p>
              <p class="nota" id="pf-servicio-nota">«En todos» aplica el producto a toda la categoría. El stock se rebaja al completar la cita.</p>
            </div>
          </details>
        </div>

        <div class="campo" id="pf-bloque-subtipo" style="margin-bottom:0">
          <label class="etiqueta">Tipo / variante del servicio (opcional)</label>
          <input type="hidden" id="pf-subtipo" value="" />
          <div class="chips subtipo-chips oculto" id="pf-subtipo-chips" role="radiogroup"
               aria-label="Tipo o variante del servicio"></div>
          <p class="nota" id="pf-subtipo-nota">Selecciona primero un servicio para elegir su tipo.</p>
        </div>
      </section>

      <section class="form-seccion">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.caja(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Existencias</p>
            <p class="form-seccion-sub">Cuánto hay ahora y cuándo conviene reponer.</p>
          </div>
          <span class="stock-chip" id="pf-estado-stock"></span>
        </div>

        <div class="form-grid">
          <div class="campo">
            <label class="etiqueta" for="pf-cantidad">Cantidad en stock *</label>
            <div class="campo-ico">
              ${icono.caja()}
              <input class="input" id="pf-cantidad" type="number" min="0" step="0.01"
                     value="${producto ? Number(producto.cantidad) : ""}" />
            </div>
          </div>
          <div class="campo">
            <label class="etiqueta" for="pf-unidad">Unidad *</label>
            <div class="campo-ico">
              ${icono.etiqueta()}
              <input class="input" id="pf-unidad" value="${escapeHtml(producto?.unidad || "unidad")}"
                     placeholder="unidad, flor, vela…" />
            </div>
          </div>
        </div>

        <div class="campo" style="margin-bottom:0">
          <label class="etiqueta" for="pf-stock-minimo">Stock mínimo para avisar</label>
          <div class="campo-ico">
            ${icono.campana()}
            <input class="input" id="pf-stock-minimo" type="number" min="0" step="0.01"
                   value="${producto ? Number(producto.stock_minimo) : 0}" />
          </div>
          <p class="nota">Cuando el stock llegue a este valor aparecerá una alerta en Notificaciones. Con 0 se avisa al agotarse.</p>
        </div>
      </section>

      <section class="form-seccion">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.repetir(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Consumo por cita</p>
            <p class="form-seccion-sub">Cuánto producto se gasta y cada cuántas citas.</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="campo">
            <label class="etiqueta" for="pf-consumo-cantidad">Unidades que se gastan</label>
            <div class="campo-ico">
              ${icono.repetir()}
              <input class="input" id="pf-consumo-cantidad" type="number" min="0" step="0.001"
                     value="${producto ? Number(producto.consumo_cantidad) : 1}" />
            </div>
          </div>
          <div class="campo">
            <label class="etiqueta" for="pf-consumo-citas">Cada cuántas citas</label>
            <div class="campo-ico">
              ${icono.calendario()}
              <input class="input" id="pf-consumo-citas" type="number" min="1" step="1"
                     value="${producto?.consumo_citas ?? 1}" />
            </div>
          </div>
        </div>
        <p class="nota">Ejemplo: 7 unidades cada 20 citas. El consumo se rebaja automáticamente del stock al completar cada cita.</p>

        <div class="prod-resumen" id="pf-resumen"></div>
      </section>

      ${!nuevo && movimientos.length ? `
        <section class="form-seccion">
          <div class="form-seccion-cab">
            <span class="form-seccion-ico">${icono.archivo(17)}</span>
            <div class="form-seccion-textos">
              <p class="form-seccion-titulo">Movimientos de inventario</p>
              <p class="form-seccion-sub">Últimos cambios de stock de este producto.</p>
            </div>
          </div>
          <div class="prod-movs">
            ${movimientos.map((m) => {
              const cantidad = Number(m.cantidad);
              const signo = cantidad < 0 ? "−" : "+";
              const clase = cantidad < 0 ? "prod-mov-cant baja" : "prod-mov-cant sube";
              return `
              <div class="prod-mov">
                <div class="prod-mov-linea">
                  <span class="${clase}">${signo}${numeroCorto(Math.abs(cantidad))} ${escapeHtml(producto.unidad)}</span>
                  <span class="prod-mov-fecha">${escapeHtml(fechaMovimiento(m.creado_en))}</span>
                </div>
                <div class="prod-mov-desc">${escapeHtml(m.descripcion || "Consumo de inventario")}</div>
                <div class="prod-mov-stock">Stock después: ${numeroCorto(m.stock_nuevo)} ${escapeHtml(producto.unidad)}</div>
              </div>`;
            }).join("")}
          </div>
        </section>` : ""}

      <section class="form-seccion">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.notas(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Notas y estado</p>
            <p class="form-seccion-sub">Detalles internos y disponibilidad del producto.</p>
          </div>
        </div>

        <div class="campo" style="margin-bottom:0">
          <label class="etiqueta" for="pf-notas">Notas (opcional)</label>
          <textarea class="input" id="pf-notas" maxlength="500"
                    placeholder="Marca, contenido, observaciones…">${escapeHtml(producto?.notas || "")}</textarea>
        </div>

        ${!nuevo ? `
          <div class="switch-fila">
            <input type="checkbox" id="pf-activo" ${producto.activo ? "checked" : ""} />
            <label class="switch-texto" for="pf-activo">
              <span class="switch-titulo">Producto activo</span>
              <span class="switch-sub">Si lo desactivas no se descontará en las citas nuevas.</span>
            </label>
          </div>` : ""}
      </section>

      <p class="error-txt oculto" id="pf-error"></p>

      <div class="form-acciones">
        <a class="btn btn-contorno" href="#/productos">Volver</a>
        <button class="btn btn-dorado" id="btn-guardar" type="button">
          ${nuevo ? "Guardar producto" : "Guardar cambios"}
        </button>
      </div>

      ${!nuevo ? `
        <div class="zona-peligro">
          <h3>Eliminar producto</h3>
          <p>Se borrará definitivamente del inventario. Esta acción no se puede deshacer.</p>
          <button class="btn btn-rojo-contorno" id="btn-eliminar" type="button">Eliminar producto</button>
        </div>` : ""}
    </div>`;

  // Tipo guardado del producto: se conserva hasta que el desplegable lo pinta.
  let subtipoGuardado = limpiar(producto?.subtipo);

  // El vínculo con un servicio solo se pide cuando la categoría tiene más de
  // un servicio principal entre los que elegir.
  function serviciosDeCategoria(valor) {
    const clave = normalizarClave(valor);
    if (!clave) return [];
    return servicios.filter(
      (sv) => !sv.es_adicional && categoriasDe(sv).some((c) => normalizarClave(c) === clave)
    );
  }

  function usaServicioVinculado(valor = $("#pf-categoria").value) {
    return serviciosDeCategoria(valor).length > 1;
  }

  function servicioDeSelect() {
    const valor = $("#pf-servicio").value;
    if (!valor) return null;
    return servicios.find((sv) => Number(sv.id) === Number(valor)) || null;
  }

  function pintarServicioElegido() {
    const servicio = servicioDeSelect();
    const nombre = $("#pf-servicio-nombre");
    const detalle = $("#pf-servicio-detalle");
    if (nombre) nombre.textContent = servicio ? servicio.nombre : "Todos los servicios";
    if (detalle) {
      detalle.textContent = servicio
        ? `${mostrarCategoria(servicio.categoria)}${servicio.activo ? "" : " · Inactivo"}`
        : "Aplica a toda la categoría";
    }

    // Refleja la selección en la lista plegable sin reconstruirla.
    const valor = $("#pf-servicio").value;
    $$("#pf-servicio-lista [data-servicio]").forEach((opcion) => {
      const activa = opcion.dataset.servicio === valor;
      opcion.classList.toggle("activo", activa);
      opcion.setAttribute("aria-selected", activa ? "true" : "false");
      const check = opcion.querySelector(".servicio-opcion-check");
      if (check) check.innerHTML = activa ? icono.check(15) : "";
    });

    const nota = $("#pf-servicio-nota");
    if (nota) {
      nota.textContent = servicio
        ? "El stock se rebaja al completar las citas de este servicio."
        : "«En todos» aplica el producto a toda la categoría. El stock se rebaja al completar la cita.";
    }
  }

  /** Lista plegable de servicios: filas grandes, con categoría y búsqueda. */
  function pintarListaServicios(lista, mismaCategoria) {
    const caja = $("#pf-servicio-lista");
    if (!caja) return;

    const opciones = [
      {
        id: "",
        nombre: "Todos los servicios",
        detalle: "Aplica a toda la categoría",
        buscar: "todos los servicios categoria",
      },
      ...lista.map((sv) => ({
        id: String(sv.id),
        nombre: sv.nombre,
        detalle: [
          mostrarCategoria(sv.categoria),
          sv.activo ? "" : "Inactivo",
          mismaCategoria(sv) ? "" : "Otra categoría",
        ].filter(Boolean).join(" · "),
        buscar: `${sv.nombre} ${mostrarCategoria(sv.categoria)}`,
      })),
    ];

    caja.innerHTML = opciones.map((o) => `
      <button class="servicio-opcion" type="button" role="option"
              data-servicio="${escapeHtml(o.id)}"
              data-buscar="${escapeHtml(normalizarClave(o.buscar))}"
              aria-selected="false">
        <span class="servicio-opcion-ico">${o.id ? icono.etiqueta(15) : icono.lista(15)}</span>
        <span class="servicio-opcion-txt">
          <span class="servicio-opcion-nombre">${escapeHtml(o.nombre)}</span>
          <span class="servicio-opcion-sub">${escapeHtml(o.detalle)}</span>
        </span>
        <span class="servicio-opcion-check"></span>
      </button>`).join("");

    caja.querySelectorAll("[data-servicio]").forEach((boton) => {
      boton.onclick = () => {
        const select = $("#pf-servicio");
        select.value = boton.dataset.servicio;
        select.dispatchEvent(new Event("change"));
        const plegable = $("#pf-servicio-plegable");
        if (plegable) plegable.open = false;
      };
    });

    const buscador = $("#pf-servicio-buscar");
    if (buscador) buscador.value = "";
    $("#pf-servicio-vacio")?.classList.add("oculto");
    pintarServicioElegido();
  }

  function pintarServicios() {
    const visible = usaServicioVinculado();
    $("#pf-seccion-servicio").classList.toggle("oculto", !visible);
    if (!visible) return;

    const clave = normalizarClave($("#pf-categoria").value);
    const valorActual = $("#pf-servicio").value;
    const mismaCategoria = (sv) =>
      categoriasDe(sv).some((c) => normalizarClave(c) === clave);

    const lista = servicios
      .filter((sv) => !sv.es_adicional && mismaCategoria(sv))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    // El servicio guardado debe seguir visible aunque no cumpla el filtro
    // (por ejemplo, si el producto cambió de categoría). Así la usuaria ve
    // siempre qué servicio tiene señalado.
    const guardado = servicioDeSelect();
    if (guardado && !lista.some((sv) => Number(sv.id) === Number(guardado.id))) {
      lista.unshift(guardado);
    }

    const sigue = lista.some((sv) => Number(sv.id) === Number(valorActual));
    if (!sigue) {
      $("#pf-servicio").value = "";
      $("#pf-subtipo").value = "";
      subtipoGuardado = "";
    }

    $("#pf-servicio").innerHTML = `<option value="">— En todos —</option>` + lista
      .map((sv) => {
        const nota = `${sv.activo ? "" : " (inactivo)"}${mismaCategoria(sv) ? "" : " (otra categoría)"}`;
        return `<option value="${sv.id}" ${sigue && Number(sv.id) === Number(valorActual) ? "selected" : ""}>
          ${escapeHtml(sv.nombre)}${nota}</option>`;
      })
      .join("");

    pintarListaServicios(lista, mismaCategoria);
    pintarSubtipos();
  }

  function marcarSubtipo() {
    const valor = $("#pf-subtipo").value;
    $$("#pf-subtipo-chips [data-subtipo]").forEach((chip) => {
      const activo = chip.dataset.subtipo === valor;
      chip.classList.toggle("activo", activo);
      chip.setAttribute("aria-checked", activo ? "true" : "false");
    });
  }

  /** Chips con los tipos del servicio (sustituye al desplegable nativo). */
  function pintarSubtipos() {
    const servicio = servicioDeSelect();
    const subtipos = (servicio?.subtipos || []).map((t) => String(t)).filter(Boolean);
    const actual = limpiar($("#pf-subtipo").value) || subtipoGuardado;
    // Si el producto guardado tiene un tipo que ya no está en la lista, se
    // conserva como opción para no perder el dato.
    const opciones = [...subtipos];
    if (actual && !opciones.includes(actual)) opciones.push(actual);

    const valor = opciones.includes(actual) ? actual : "";
    $("#pf-subtipo").value = valor;

    const caja = $("#pf-subtipo-chips");
    const hayOpciones = Boolean(servicio) && opciones.length > 0;
    caja.classList.toggle("oculto", !hayOpciones);
    caja.innerHTML = hayOpciones
      ? [
        `<button class="chip chip-subtipo" type="button" role="radio" data-subtipo="">Sin tipo</button>`,
        ...opciones.map((t) => `
          <button class="chip chip-subtipo" type="button" role="radio"
                  data-subtipo="${escapeHtml(t)}">${escapeHtml(textoSubtipo(t))}</button>`),
      ].join("")
      : "";
    marcarSubtipo();
    subtipoGuardado = "";

    const nota = $("#pf-subtipo-nota");
    if (nota) {
      if (!servicio) {
        nota.textContent = "Selecciona primero un servicio para elegir su tipo.";
      } else if (subtipos.length) {
        nota.textContent = `${subtipos.length} ${subtipos.length === 1 ? "tipo disponible" : "tipos disponibles"} para ${servicio.nombre}.`;
      } else {
        nota.textContent = `${servicio.nombre} no tiene tipos definidos.`;
      }
    }
  }

  function pintarEstadoStock(cantidad, minimo, unidad) {
    const chip = $("#pf-estado-stock");
    if (!chip) return;
    const u = escapeHtml(plural(unidad, cantidad));
    if (cantidad <= 0) {
      chip.className = "stock-chip agotado";
      chip.innerHTML = `${icono.equis(12)} Agotado`;
    } else if (cantidad <= minimo) {
      chip.className = "stock-chip bajo";
      chip.innerHTML = `${icono.campana(12)} ${numeroCorto(cantidad)} ${u} · reponer`;
    } else {
      chip.className = "stock-chip ok";
      chip.innerHTML = `${icono.check(12)} ${numeroCorto(cantidad)} ${u}`;
    }
  }

  function pintarResumen() {
    const cantidad = numero($("#pf-cantidad").value);
    const minimo = numero($("#pf-stock-minimo").value);
    const consumo = numero($("#pf-consumo-cantidad").value);
    const citas = numero($("#pf-consumo-citas").value);
    const unidad = limpiar($("#pf-unidad").value) || "unidad";

    pintarEstadoStock(cantidad, minimo, unidad);

    const caja = $("#pf-resumen");
    if (!consumo || !citas) {
      caja.innerHTML = `<p class="resumen-vacio">Sin consumo definido: no se puede calcular la cobertura.</p>`;
      return;
    }
    const porCita = consumo / citas;
    const restantes = Math.floor(cantidad / porCita);
    const consumoTexto = citas === 1
      ? `${Number(consumo.toFixed(3))} ${escapeHtml(plural(unidad, consumo))} por cita`
      : `${Number(consumo.toFixed(3))} ${escapeHtml(plural(unidad, consumo))} cada ${citas} citas`;
    const enMinimo = cantidad <= minimo;

    caja.innerHTML = `
      <p class="resumen-consumo">Consumo: <b>${consumoTexto}</b></p>
      <div class="resumen-metricas">
        <div class="metrica">
          <span class="metrica-valor">≈ ${restantes}</span>
          <span class="metrica-label">citas cubiertas</span>
        </div>
        <div class="metrica">
          <span class="metrica-valor">${Number(porCita.toFixed(3))}</span>
          <span class="metrica-label">${escapeHtml(plural(unidad, porCita))} por cita</span>
        </div>
      </div>
      ${enMinimo
        ? `<p class="resumen-aviso">${icono.campana(13)} El stock está en el mínimo: se avisará para reponer.</p>`
        : `<p class="resumen-pie">Con el stock actual alcanza para unas ${restantes} citas.</p>`}`;
  }

  $("#pf-servicio").addEventListener("change", () => {
    // Al cambiar de servicio el tipo anterior deja de aplicar.
    $("#pf-subtipo").value = "";
    subtipoGuardado = "";
    pintarServicioElegido();
    pintarSubtipos();
  });
  $("#pf-subtipo-chips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-subtipo]");
    if (!chip) return;
    $("#pf-subtipo").value = chip.dataset.subtipo;
    marcarSubtipo();
  });
  $("#pf-servicio-buscar").addEventListener("input", () => {
    const texto = normalizarClave($("#pf-servicio-buscar").value);
    let visibles = 0;
    $$("#pf-servicio-lista .servicio-opcion").forEach((opcion) => {
      const coincide = !texto || opcion.dataset.buscar.includes(texto);
      opcion.classList.toggle("oculto", !coincide);
      if (coincide) visibles += 1;
    });
    $("#pf-servicio-vacio").classList.toggle("oculto", visibles > 0);
  });
  ["#pf-cantidad", "#pf-stock-minimo", "#pf-consumo-cantidad", "#pf-consumo-citas", "#pf-unidad"]
    .forEach((sel) => $(sel).addEventListener("input", pintarResumen));

  // Categoría señalada: el chip elegido se marca con el fondo oscuro del
  // proyecto, igual que en el formulario de servicio.
  const chipsCategoria = $$("[data-cat]");
  const marcarCategoria = () => {
    const valor = claveVisible($("#pf-categoria").value);
    chipsCategoria.forEach((chip) => {
      chip.classList.toggle(
        "activo",
        Boolean(valor) && claveVisible(chip.dataset.cat) === valor
      );
    });
  };

  // Categorías adicionales: se eligen con un clic en su casilla. La categoría
  // principal no puede repetirse como adicional, así que se oculta de la lista.
  const chipsExtra = $$("[data-extra]");
  const cuentaExtra = $("#pf-extras-cuenta");
  const quitarExtra = (cat) => {
    const clave = claveVisible(cat);
    for (const guardada of [...extras]) {
      if (claveVisible(guardada) === clave) extras.delete(guardada);
    }
  };
  const marcarExtras = () => {
    const principal = claveVisible($("#pf-categoria").value);
    chipsExtra.forEach((input) => {
      const clave = claveVisible(input.dataset.extra);
      const esPrincipal = Boolean(principal) && clave === principal;
      if (esPrincipal) quitarExtra(input.dataset.extra);
      const opcion = input.closest("[data-extra-opcion]");
      if (opcion) opcion.classList.toggle("oculto", esPrincipal);
      input.checked = !esPrincipal
        && [...extras].some((cat) => claveVisible(cat) === clave);
    });
    if (cuentaExtra) cuentaExtra.textContent = String(extras.size);
  };
  chipsExtra.forEach((input) => {
    input.addEventListener("change", () => {
      const cat = input.dataset.extra;
      if (input.checked) extras.add(cat);
      else quitarExtra(cat);
      marcarExtras();
    });
  });

  chipsCategoria.forEach((chip) => {
    chip.onclick = () => {
      $("#pf-categoria").value = chip.dataset.cat;
      marcarCategoria();
      pintarServicios();
      marcarExtras();
    };
  });
  $("#pf-categoria").addEventListener("input", () => {
    marcarCategoria();
    pintarServicios();
    marcarExtras();
  });

  pintarServicios();
  pintarResumen();
  marcarCategoria();
  marcarExtras();

  function leerFormulario() {
    const error = $("#pf-error");
    error.classList.add("oculto");

    const nombre = limpiar($("#pf-nombre").value);
    let categoria = limpiar($("#pf-categoria").value);
    const unidad = limpiar($("#pf-unidad").value);
    const cantidad = numero($("#pf-cantidad").value, NaN);
    const stockMinimo = numero($("#pf-stock-minimo").value, NaN);
    const consumoCantidad = numero($("#pf-consumo-cantidad").value, NaN);
    const consumoCitas = numero($("#pf-consumo-citas").value, NaN);
    const servicioId = $("#pf-servicio").value;

    if (nombre.length < 2) return fallo("Escribe el nombre del producto (mínimo 2 letras).");
    if (categoria.length < 2) return fallo("Escribe la categoría del producto.");
    if (!unidad) return fallo("Escribe la unidad (unidad, flor, vela…).");
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      return fallo("La cantidad en stock debe ser un número igual o mayor que 0.");
    }
    if (!Number.isFinite(stockMinimo) || stockMinimo < 0) {
      return fallo("El stock mínimo debe ser un número igual o mayor que 0.");
    }
    if (!Number.isFinite(consumoCantidad) || consumoCantidad < 0) {
      return fallo("Las unidades que se gastan deben ser un número igual o mayor que 0.");
    }
    if (!Number.isInteger(consumoCitas) || consumoCitas < 1) {
      return fallo("El consumo debe ser cada un número entero de citas (1 o más).");
    }

    categoria = categoriaCanonica(categoria, categorias);
    $("#pf-categoria").value = categoria;
    const conServicio = usaServicioVinculado(categoria);
    // Nunca se repite la categoría principal como adicional.
    const clavePrincipal = claveVisible(categoria);
    const extra = [...extras].filter((cat) => claveVisible(cat) !== clavePrincipal);

    return {
      nombre,
      categoria,
      categorias_extra: extra,
      servicio_id: conServicio && servicioId ? Number(servicioId) : null,
      subtipo: conServicio ? (limpiar($("#pf-subtipo").value) || null) : null,
      unidad,
      cantidad,
      stock_minimo: stockMinimo,
      consumo_cantidad: consumoCantidad,
      consumo_citas: consumoCitas,
      notas: limpiar($("#pf-notas").value) || null,
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
        await post("/productos", datos);
      } else {
        datos.activo = $("#pf-activo").checked;
        await patch(`/productos/${producto.id}`, datos);
      }
      aviso(nuevo ? "Producto guardado" : "Cambios guardados", "ok");
      location.hash = "#/productos";
    } catch (e) {
      $("#pf-error").textContent = e.message;
      $("#pf-error").classList.remove("oculto");
    }
  };

  if (!nuevo) {
    $("#btn-eliminar").onclick = async () => {
      if (!(await confirmar(
        "Eliminar producto",
        `¿Borrar definitivamente «${producto.nombre}» del inventario?`,
        "Sí, eliminar",
      ))) return;
      try {
        await del(`/productos/${producto.id}`);
        aviso("Producto eliminado", "ok");
        location.hash = "#/productos";
      } catch (e) {
        aviso(e.message, "error");
      }
    };
  }
}
