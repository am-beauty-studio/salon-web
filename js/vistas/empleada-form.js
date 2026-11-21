// Formulario de empleada (nueva / editar, solo admin).
// Equivalente a EmpleadaForm + HorarioEditor de src/app/empleadas/*.

import { get, post, patch, put, del } from "../api.js?v=48";
import { $, $$, aviso, confirmar, escapeHtml, mostrarCategoria, errorTelefonoCuba, compararCategorias, colorCategoriaCabecera } from "../util.js?v=52";
import { icoCategoria } from "../iconos.js?v=64";
import { icono } from "../iconos.js?v=64";

const DIAS_SIGLA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const HORARIO_DEFECTO = [
  { dia_semana: 0, hora_inicio: "08:00", hora_fin: "18:00" },
  { dia_semana: 1, hora_inicio: "08:00", hora_fin: "18:00" },
  { dia_semana: 2, hora_inicio: "08:00", hora_fin: "18:00" },
  { dia_semana: 3, hora_inicio: "08:00", hora_fin: "18:00" },
  { dia_semana: 4, hora_inicio: "08:00", hora_fin: "18:00" },
];

// La API acepta fotos de hasta 1.5 MB (ya codificadas en base64). Nos quedamos
// algo por debajo para que la cabecera `data:image/jpeg;base64,` no la supere.
const MAX_FOTO = 1_450_000;

/** Duración compacta para la lista de servicios: "45m", "1h", "1h 30m". */
function duracionCorta(min) {
  const n = Number(min);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 60) return `${n}m`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function inicialDe(nombre) {
  return (nombre || "?").trim().charAt(0).toUpperCase() || "?";
}

function leerArchivo(file) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(file);
  });
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("La imagen no es válida."));
    img.src = src;
  });
}

/** Recorta la imagen en cuadrado (centro) y la reduce a un JPEG pequeño. */
async function prepararFoto(file) {
  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("Elige una imagen JPEG, PNG o WebP.");
  }
  const original = await leerArchivo(file);
  const img = await cargarImagen(original);
  if (!img.width || !img.height) throw new Error("La imagen no es válida.");

  const lado = Math.min(img.width, img.height);
  const sx = (img.width - lado) / 2;
  const sy = (img.height - lado) / 2;

  const lienzo = document.createElement("canvas");
  const tam = lado > 480 ? 360 : 320;
  lienzo.width = lienzo.height = tam;
  const ctx = lienzo.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, lado, lado, 0, 0, tam, tam);

  let calidad = 0.82;
  let salida = lienzo.toDataURL("image/jpeg", calidad);
  while (salida.length > MAX_FOTO && calidad > 0.4) {
    calidad -= 0.1;
    salida = lienzo.toDataURL("image/jpeg", calidad);
  }
  if (salida.length > MAX_FOTO) {
    throw new Error("La foto pesa demasiado incluso comprimida. Prueba con otra imagen.");
  }
  return salida;
}

export async function render(raiz, params) {
  const nueva = params.modo === "nueva";
  let empleada = nueva ? null : await get(`/empleados/${params.id}`);
  const servicios = await get("/servicios?solo_activos=true");

  let datos = {
    nombre: empleada?.nombre || "",
    telefono: empleada?.telefono || "",
    activo: empleada?.activo ?? true,
    foto: empleada?.foto || null,
    servicio_ids: new Set(empleada?.servicio_ids || []),
    horarios: nueva
      ? HORARIO_DEFECTO.map((h) => ({ ...h }))
      : (empleada?.horarios || []).map((h) => ({
          dia_semana: h.dia_semana,
          hora_inicio: h.hora_inicio.slice(0, 5),
          hora_fin: h.hora_fin.slice(0, 5),
        })),
  };
  let fotoCambiada = false;

  raiz.innerHTML = `
    <div class="vista-cab">
      <h1 class="vista-titulo">${nueva ? "Nueva empleada" : "Editar empleada"}</h1>
    </div>
    <div class="tarjeta">
      <div class="paso-titulo">Datos personales</div>
      <div class="emp-foto-zona">
        <div class="emp-foto-avatar" id="em-foto-prev"></div>
        <div class="emp-foto-info">
          <div class="emp-foto-titulo">Foto de la empleada</div>
          <div class="emp-foto-ayuda">Solo administradores. Se recorta en cuadrado y se guarda optimizada.</div>
          <div class="emp-foto-botones">
            <button class="emp-foto-btn" id="btn-foto" type="button"></button>
            <button class="emp-foto-btn quitar oculto" id="btn-quitar-foto" type="button">
              ${icono.papelera(14)} Quitar
            </button>
          </div>
          <input type="file" id="em-foto-input" accept="image/jpeg,image/png,image/webp" hidden />
          <div class="emp-foto-estado" id="em-foto-estado"></div>
        </div>
      </div>
      <div class="emp-campos">
        <div class="campo">
          <label class="etiqueta">Nombre *</label>
          <div class="campo-ico">
            ${icono.usuario()}
            <input class="input" id="em-nombre" value="${escapeHtml(datos.nombre)}" autocomplete="off" />
          </div>
        </div>
        <div class="campo">
          <label class="etiqueta">Teléfono</label>
          <div class="campo-ico">
            ${icono.telefono()}
            <input class="input" id="em-telefono" value="${escapeHtml(datos.telefono || "")}" placeholder="+53 5..." />
          </div>
        </div>
      </div>
      ${!nueva ? `
        <div class="swicha">
          <input type="checkbox" id="em-activa" ${datos.activo ? "checked" : ""} />
          <span>Empleada activa</span>
        </div>` : ""}
    </div>

    <div class="tarjeta">
      <div class="paso-titulo emp-serv-cab">
        <span>Servicios que realiza</span>
        <span class="emp-serv-total"><span id="cuenta-servicios">${datos.servicio_ids.size}</span> seleccionados</span>
      </div>
      <div class="emp-serv-barra">
        <div class="campo-ico">
          ${icono.lupa()}
          <input class="input" id="em-serv-buscar" placeholder="Filtrar servicios…" />
        </div>
        <button class="emp-serv-mini" id="btn-todos" type="button">Seleccionar todo</button>
        <button class="emp-serv-mini" id="btn-ninguno" type="button">Limpiar</button>
      </div>
      <div id="servicios-por-cat" class="emp-acordeon"></div>
      <p class="nota">Sin servicios asignados no podrá realizar citas.</p>
    </div>

    <div class="tarjeta">
      <div class="paso-titulo">Horario semanal</div>
      <div id="horarios"></div>
      <p class="nota">Usa el formato 24 h (HH:MM). El fin debe ser posterior al inicio y no puede
      haber dos bloques que se crucen el mismo día. Sin horarios no aparecerá disponible para agendar citas.</p>
    </div>

    <p class="error-txt oculto" id="em-error"></p>
    <div class="fila-btns">
      <a class="btn btn-contorno" href="#/empleadas">Volver</a>
      <button class="btn btn-dorado" id="btn-guardar" type="button">
        ${nueva ? "Guardar empleada" : "Guardar cambios"}
      </button>
    </div>

    ${!nueva ? `
      <div class="zona-peligro">
        <h3>Eliminar empleada</h3>
        <p>Se borrará definitivamente. Si tiene citas o ganancias registradas,
           la API lo impedirá y podrás desactivarla en su lugar.</p>
        <button class="btn btn-rojo-contorno" id="btn-eliminar" type="button">Eliminar empleada</button>
      </div>` : ""}`;

  // ----- Foto -----
  function pintarFoto() {
    const caja = $("#em-foto-prev");
    const nombreLimpio = (datos.nombre || "").trim();
    if (datos.foto) {
      caja.innerHTML = `<img src="${escapeHtml(datos.foto)}" alt="Foto de la empleada" />`;
    } else if (nombreLimpio) {
      caja.textContent = inicialDe(nombreLimpio);
    } else {
      caja.innerHTML = icono.usuario(32);
    }
    const boton = $("#btn-foto");
    if (boton) boton.innerHTML = `${icono.camara(15)} ${datos.foto ? "Cambiar foto" : "Subir foto"}`;
    const quitar = $("#btn-quitar-foto");
    if (quitar) quitar.classList.toggle("oculto", !datos.foto);
  }

  pintarFoto();

  $("#btn-foto").onclick = () => $("#em-foto-input").click();

  $("#em-foto-input").onchange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const estado = $("#em-foto-estado");
    estado.textContent = "Preparando foto…";
    try {
      datos.foto = await prepararFoto(file);
      fotoCambiada = true;
      pintarFoto();
      estado.textContent = "Foto lista. Se guardará al pulsar Guardar.";
    } catch (err) {
      estado.textContent = "";
      aviso(err.message || "No se pudo procesar la foto.", "error");
    }
  };

  $("#btn-quitar-foto").onclick = () => {
    datos.foto = null;
    fotoCambiada = true;
    pintarFoto();
    $("#em-foto-estado").textContent = "Foto quitada. Se aplicará al guardar.";
  };

  $("#em-nombre").addEventListener("input", (e) => {
    datos.nombre = e.target.value;
    if (!datos.foto) {
      const limpio = e.target.value.trim();
      const caja = $("#em-foto-prev");
      if (limpio) caja.textContent = inicialDe(limpio);
      else caja.innerHTML = icono.usuario(32);
    }
  });

  // ----- Servicios agrupados por categoría (acordeón con checkbox) -----
  const grupos = new Map();
  servicios.forEach((s) => {
    const cat = s.categoria || "Otros";
    if (!grupos.has(cat)) grupos.set(cat, []);
    grupos.get(cat).push(s);
  });

  const categorias = [...grupos.entries()].sort((a, b) => compararCategorias(a[0], b[0]));
  const abiertas = new Set(
    categorias.filter(([, lista]) => lista.some((s) => datos.servicio_ids.has(s.id))).map(([cat]) => cat)
  );
  if (!abiertas.size && categorias.length) abiertas.add(categorias[0][0]);

  $("#servicios-por-cat").innerHTML = categorias.map(([cat, lista]) => {
    const ico = icoCategoria(cat);
    return `
      <section class="emp-cat" data-cat="${escapeHtml(cat)}">
        <button class="emp-cat-cab" type="button" style="background:${colorCategoriaCabecera(cat)}" aria-expanded="false">
          ${ico ? `<img class="cat-ico" src="${ico}" alt="" />` : ""}
          <span class="emp-cat-nombre">${escapeHtml(mostrarCategoria(cat))}</span>
          <span class="emp-cat-cuenta" data-cuenta="${escapeHtml(cat)}">0/${lista.length}</span>
          <span class="emp-cat-flecha">▾</span>
        </button>
        <div class="emp-cat-cuerpo">
          <div class="emp-cat-acciones">
            <button type="button" data-todo="${escapeHtml(cat)}">Todos</button>
            <button type="button" data-ninguno="${escapeHtml(cat)}">Ninguno</button>
          </div>
          ${lista.map((s) => {
            const dur = duracionCorta(s.duracion_min);
            return `
            <label class="emp-servicio" data-buscar="${escapeHtml(s.nombre)} ${escapeHtml(cat)}">
              <input type="checkbox" data-id="${s.id}" ${datos.servicio_ids.has(s.id) ? "checked" : ""} />
              <span class="emp-servicio-txt">${escapeHtml(s.nombre)}</span>
              ${dur ? `<span class="emp-servicio-meta">${icono.reloj(10)}${dur}</span>` : ""}
            </label>`;
          }).join("")}
        </div>
      </section>`;
  }).join("");

  function aplicarAbiertas() {
    $$("#servicios-por-cat .emp-cat").forEach((sec) => {
      const abierta = abiertas.has(sec.dataset.cat);
      sec.classList.toggle("abierta", abierta);
      const cab = $(".emp-cat-cab", sec);
      if (cab) cab.setAttribute("aria-expanded", abierta ? "true" : "false");
    });
  }

  function actualizarCuentas() {
    $$("#servicios-por-cat .emp-cat").forEach((sec) => {
      const total = $$("input[type=checkbox]", sec).length;
      const marcados = $$("input[type=checkbox]:checked", sec).length;
      const etiqueta = $(`[data-cuenta]`, sec);
      if (etiqueta) etiqueta.textContent = `${marcados}/${total}`;
    });
    $("#cuenta-servicios").textContent = datos.servicio_ids.size;
  }

  aplicarAbiertas();
  actualizarCuentas();

  $$("#servicios-por-cat .emp-cat-cab").forEach((cab) => {
    cab.onclick = () => {
      const sec = cab.closest(".emp-cat");
      const cat = sec.dataset.cat;
      if (abiertas.has(cat)) abiertas.delete(cat);
      else abiertas.add(cat);
      aplicarAbiertas();
    };
  });

  $$("#servicios-por-cat input[type=checkbox]").forEach((check) => {
    check.onchange = () => {
      const id = Number(check.dataset.id);
      if (check.checked) datos.servicio_ids.add(id);
      else datos.servicio_ids.delete(id);
      actualizarCuentas();
    };
  });

  $$("#servicios-por-cat [data-todo]").forEach((boton) => {
    boton.onclick = () => {
      const sec = boton.closest(".emp-cat");
      $$("input[type=checkbox]", sec).forEach((check) => {
        check.checked = true;
        datos.servicio_ids.add(Number(check.dataset.id));
      });
      actualizarCuentas();
    };
  });

  $$("#servicios-por-cat [data-ninguno]").forEach((boton) => {
    boton.onclick = () => {
      const sec = boton.closest(".emp-cat");
      $$("input[type=checkbox]", sec).forEach((check) => {
        check.checked = false;
        datos.servicio_ids.delete(Number(check.dataset.id));
      });
      actualizarCuentas();
    };
  });

  $("#btn-todos").onclick = () => {
    $$("#servicios-por-cat input[type=checkbox]").forEach((check) => {
      check.checked = true;
      datos.servicio_ids.add(Number(check.dataset.id));
    });
    actualizarCuentas();
  };

  $("#btn-ninguno").onclick = () => {
    $$("#servicios-por-cat input[type=checkbox]").forEach((check) => {
      check.checked = false;
      datos.servicio_ids.delete(Number(check.dataset.id));
    });
    actualizarCuentas();
  };

  $("#em-serv-buscar").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$("#servicios-por-cat .emp-cat").forEach((sec) => {
      let visibles = 0;
      $$(".emp-servicio", sec).forEach((fila) => {
        const coincide = !q || (fila.dataset.buscar || "").toLowerCase().includes(q);
        fila.classList.toggle("oculto", !coincide);
        if (coincide) visibles++;
      });
      sec.classList.toggle("oculto", visibles === 0);
      if (q) sec.classList.add("abierta");
      else sec.classList.toggle("abierta", abiertas.has(sec.dataset.cat));
    });
  });

  // ----- Editor de horarios -----
  function pintarHorarios() {
    const porDia = new Map();
    for (let d = 0; d < 7; d++) porDia.set(d, []);
    datos.horarios.forEach((h, i) => porDia.get(h.dia_semana).push({ ...h, i }));

    $("#horarios").innerHTML = DIAS_SIGLA.map((nombre, d) => {
      const bloques = porDia.get(d);
      return `
        <div class="dia-card">
          <div class="dia-nombre">${nombre}</div>
          ${bloques.length ? bloques.map((b) => `
            <div class="bloque-fila">
              <input class="input" type="time" data-h="inicio" data-i="${b.i}" value="${b.hora_inicio}" />
              <span class="nota">a</span>
              <input class="input" type="time" data-h="fin" data-i="${b.i}" value="${b.hora_fin}" />
              <button class="bloque-borrar" data-borrar="${b.i}" type="button" title="Quitar">✕</button>
            </div>`).join("")
            : `<div class="dia-cerrado">Cerrado</div>`}
          <button class="bloque-anadir" data-anadir="${d}" type="button">＋ Añadir</button>
        </div>`;
    }).join("");

    $$("#horarios [data-h]").forEach((input) => {
      input.addEventListener("input", () => {
        datos.horarios[Number(input.dataset.i)][input.dataset.h === "inicio" ? "hora_inicio" : "hora_fin"] = input.value;
      });
    });
    $$("#horarios [data-borrar]").forEach((boton) => {
      boton.onclick = () => {
        datos.horarios.splice(Number(boton.dataset.borrar), 1);
        pintarHorarios();
      };
    });
    $$("#horarios [data-anadir]").forEach((boton) => {
      boton.onclick = () => {
        datos.horarios.push({ dia_semana: Number(boton.dataset.anadir), hora_inicio: "09:00", hora_fin: "18:00" });
        pintarHorarios();
      };
    });
  }

  function validarHorarios() {
    const porDia = new Map();
    for (let d = 0; d < 7; d++) porDia.set(d, []);
    for (const h of datos.horarios) {
      const inicio = minutos(h.hora_inicio);
      const fin = minutos(h.hora_fin);
      if (inicio === null || fin === null) {
        return `Hay una hora mal escrita (${h.hora_inicio || "—"} / ${h.hora_fin || "—"}). Usa el formato 24 h, Ej.: 09:30.`;
      }
      if (inicio >= fin) {
        return `En ${DIAS_SIGLA[h.dia_semana]}, la hora de fin debe ser posterior a la hora de inicio.`;
      }
      porDia.get(h.dia_semana).push({ inicio, fin, h });
    }
    for (const [, bloques] of porDia) {
      bloques.sort((a, b) => a.inicio - b.inicio);
      for (let i = 1; i < bloques.length; i++) {
        if (bloques[i].inicio < bloques[i - 1].fin) {
          return `En ${DIAS_SIGLA[bloques[i].h.dia_semana]} hay dos bloques de horario que se cruzan.`;
        }
      }
    }
    return null;
  }

  function minutos(texto) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(texto || "");
    if (!m) return null;
    const h = Number(m[1]), min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  pintarHorarios();

  // ----- Guardar -----
  $("#btn-guardar").onclick = async () => {
    const error = $("#em-error");
    error.classList.add("oculto");

    const nombre = $("#em-nombre").value.trim();
    const telefono = $("#em-telefono").value.trim() || null;
    if (nombre.length < 2) {
      error.textContent = "Escribe el nombre de la empleada (mínimo 2 letras).";
      error.classList.remove("oculto");
      return;
    }
    const problemaTelefono = errorTelefonoCuba(telefono || "");
    if (problemaTelefono) {
      error.textContent = problemaTelefono;
      error.classList.remove("oculto");
      return;
    }
    const problemaHorario = validarHorarios();
    if (problemaHorario) {
      error.textContent = problemaHorario;
      error.classList.remove("oculto");
      return;
    }

    const horariosLimpios = datos.horarios
      .map((h) => ({ dia_semana: h.dia_semana, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin }))
      .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));

    try {
      if (nueva) {
        await post("/empleados", {
          nombre, telefono,
          servicio_ids: [...datos.servicio_ids],
          horarios: horariosLimpios,
          foto: datos.foto,
        });
      } else {
        const cambios = {
          nombre, telefono,
          activo: $("#em-activa").checked,
        };
        if (fotoCambiada) cambios.foto = datos.foto;
        await patch(`/empleados/${empleada.id}`, cambios);
        await put(`/empleados/${empleada.id}/servicios`, { servicio_ids: [...datos.servicio_ids] });
        await put(`/empleados/${empleada.id}/horarios`, { horarios: horariosLimpios });
      }
      aviso(nueva ? "Empleada guardada" : "Cambios guardados", "ok");
      location.hash = "#/empleadas";
    } catch (e) {
      error.textContent = e.message;
      error.classList.remove("oculto");
    }
  };

  if (!nueva) {
    $("#btn-eliminar").onclick = async () => {
      if (!(await confirmar("Eliminar empleada",
        `¿Borrar definitivamente a «${empleada.nombre}»?`, "Sí, eliminar"))) return;
      try {
        await del(`/empleados/${empleada.id}`);
        aviso("Empleada eliminada", "ok");
        location.hash = "#/empleadas";
      } catch (e) {
        if (e.status === 409 || e.status === 405) {
          if (await confirmar("No se puede eliminar", e.message, "Desactivar")) {
            try {
              await patch(`/empleados/${empleada.id}`, { activo: false });
              aviso("Empleada desactivada", "ok");
              location.hash = "#/empleadas";
            } catch (e2) { aviso(e2.message, "error"); }
          }
        } else {
          aviso(e.message, "error");
        }
      }
    };
  }
}
