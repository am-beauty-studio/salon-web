// Ficha de clienta: ver/editar datos + historial de citas.
// Equivalente a src/app/clientes/[id].tsx y clientes/nuevo.tsx (modo nueva).

import { get, post, patch, del } from "../api.js?v=49";
import {
  $, $$, aviso, confirmar, escapeHtml, hora, importe, etiquetaMoneda, badgeCita,
  textoSubtipo, errorTelefonoCuba, esReprogramada,
} from "../util.js?v=57";
import { icono } from "../iconos.js?v=65";
import { esAdmin } from "../auth.js?v=52";

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export async function render(raiz, params) {
  const nueva = params.modo === "nueva";
  let cliente = null;
  let historial = [];

  if (!nueva) {
    cliente = await get(`/clientes/${params.id}`);
    historial = await get(`/clientes/${params.id}/historial`);
  }

  function formCliente(valor = {}) {
    return `
      <section class="form-seccion">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.usuario(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Datos personales</p>
            <p class="form-seccion-sub">Cómo la reconoces y cómo puedes contactarla.</p>
          </div>
        </div>
        <div class="form-grid">
          <div class="campo">
            <label class="etiqueta" for="cl-nombre">Nombre y apellido *</label>
            <div class="campo-ico">
              ${icono.usuario()}
              <input class="input" id="cl-nombre" autocomplete="name" maxlength="100"
                     placeholder="Ej.: Ana Pérez" value="${escapeHtml(valor.nombre || "")}" />
            </div>
          </div>
          <div class="campo">
            <label class="etiqueta" for="cl-telefono">Teléfono</label>
            <div class="campo-ico">
              ${icono.telefono()}
              <input class="input" id="cl-telefono" type="tel" inputmode="tel"
                     autocomplete="tel" maxlength="30" placeholder="+53 5..."
                     value="${escapeHtml(valor.telefono || "")}" />
            </div>
          </div>
        </div>
      </section>

      <section class="form-seccion">
        <div class="form-seccion-cab">
          <span class="form-seccion-ico">${icono.correo(17)}</span>
          <div class="form-seccion-textos">
            <p class="form-seccion-titulo">Contacto y notas</p>
            <p class="form-seccion-sub">Opcional: correo y detalles que conviene recordar.</p>
          </div>
        </div>
        <div class="campo">
          <label class="etiqueta" for="cl-email">Correo</label>
          <div class="campo-ico">
            ${icono.correo()}
            <input class="input" id="cl-email" type="email" inputmode="email"
                   autocomplete="email" placeholder="correo@ejemplo.com"
                   value="${escapeHtml(valor.email || "")}" />
          </div>
        </div>
        <div class="campo" style="margin-bottom:0">
          <label class="etiqueta" for="cl-notas">Notas</label>
          <div class="campo-ico campo-ico-arriba">
            ${icono.notas()}
            <textarea class="input" id="cl-notas"
                      placeholder="Preferencias, alergias, colores favoritos...">${escapeHtml(valor.notas || "")}</textarea>
          </div>
        </div>
      </section>

      <p class="error-txt oculto" id="cl-error"></p>`;
  }

  function leerFormulario() {
    const error = $("#cl-error");
    const nombre = $("#cl-nombre").value.trim();
    const email = $("#cl-email").value.trim();
    error.classList.add("oculto");
    if (nombre.length < 2) {
      error.textContent = "Falta el nombre de la clienta (mínimo 2 letras).";
      error.classList.remove("oculto");
      return null;
    }
    if (email && !email.includes("@")) {
      error.textContent = "El correo no parece válido.";
      error.classList.remove("oculto");
      return null;
    }
    const telefono = $("#cl-telefono").value.trim() || null;
    const problemaTelefono = errorTelefonoCuba(telefono || "");
    if (problemaTelefono) {
      error.textContent = problemaTelefono;
      error.classList.remove("oculto");
      return null;
    }
    return {
      nombre,
      telefono,
      email: email || null,
      notas: $("#cl-notas").value.trim() || null,
    };
  }

  if (nueva) {
    raiz.innerHTML = `
      <div class="form-vista">
        <div class="vista-cab">
          <span class="vista-ico">${icono.personas(22)}</span>
          <div class="vista-cab-texto">
            <h1 class="vista-titulo">Nueva clienta</h1>
            <p class="form-sub">Añádela a tu lista para agendar citas y llevar su historial.</p>
          </div>
        </div>
        ${formCliente()}
        <div class="form-acciones">
          <a class="btn btn-contorno" href="#/clientes">Volver</a>
          <button class="btn btn-dorado" id="btn-guardar" type="button">
            ${icono.check(16)} Guardar clienta
          </button>
        </div>
      </div>`;
    $("#btn-guardar").onclick = async () => {
      const datos = leerFormulario();
      if (!datos) return;
      try {
        const creada = await post("/clientes", datos);
        aviso("Clienta guardada", "ok");
        location.hash = `#/clientes/${creada.id}`;
      } catch (e) {
        $("#cl-error").textContent = e.message;
        $("#cl-error").classList.remove("oculto");
      }
    };
    return;
  }

  function pintarVista() {
    raiz.innerHTML = `
      <div class="vista-cab">
        <span class="vista-ico">${icono.personas(22)}</span>
        <h1 class="vista-titulo">${escapeHtml(cliente.nombre)}</h1>
      </div>

      <div class="tarjeta cliente-perfil">
        <div class="cliente-avatar">${icono.usuario(26)}</div>
        <div class="cliente-perfil-datos">
          <div class="cliente-perfil-nombre">${escapeHtml(cliente.nombre)}</div>
          ${cliente.telefono
            ? `<div class="cliente-dato">${icono.telefono(14)}<span>${escapeHtml(cliente.telefono)}</span></div>`
            : `<div class="cliente-dato sin">${icono.telefono(14)}<span>Sin teléfono</span></div>`}
          ${cliente.email
            ? `<div class="cliente-dato">${icono.correo(14)}<span>${escapeHtml(cliente.email)}</span></div>`
            : `<div class="cliente-dato sin">${icono.correo(14)}<span>Sin correo</span></div>`}
        </div>
      </div>

      ${cliente.notas ? `<div class="tarjeta cliente-notas"><div class="cita-nota" style="margin:0">“${escapeHtml(cliente.notas)}”</div></div>` : ""}

      <div class="fila-btns">
        ${esAdmin() ? `<button class="btn btn-dorado" id="btn-agendar" type="button">${icono.calendario(15)}Agendar cita</button>` : ""}
        <button class="btn btn-suave" id="btn-editar" type="button">${icono.lapiz(15)}Editar datos</button>
      </div>

      <div class="hist-cab">
        <div class="paso-titulo" style="margin:0">Historial</div>
        <span class="hist-contador">${historial.length} ${historial.length === 1 ? "cita" : "citas"}</span>
      </div>
      <div class="hist-lista" id="historial"></div>

      ${esAdmin() ? `
        <div class="zona-peligro">
          <h3>Eliminar clienta</h3>
          <p>Se borrará definitivamente. Si tiene citas registradas, la API lo
             impedirá para no perder el historial del salón.</p>
          <button class="btn btn-rojo-contorno" id="btn-eliminar" type="button">Eliminar clienta</button>
        </div>` : ""}`;

    $("#btn-agendar")?.addEventListener("click", () => {
      location.hash = `#/cita/nueva?cliente=${cliente.id}&nombre=${encodeURIComponent(cliente.nombre)}`;
    });
    $("#btn-editar").onclick = () => pintarEdicion();
    if (esAdmin()) {
      $("#btn-eliminar").onclick = async () => {
        if (!(await confirmar(
          "Eliminar clienta",
          `¿Borrar definitivamente a «${cliente.nombre}»? Esta acción no se puede deshacer.`,
          "Sí, eliminar"
        ))) return;
        try {
          await del(`/clientes/${cliente.id}`);
          aviso("Clienta eliminada", "ok");
          location.hash = "#/clientes";
        } catch (e) {
          aviso(e.message, "error");
        }
      };
    }

    $("#historial").innerHTML = historial.length
      ? historial.map((c) => {
          const dia = c.inicio.slice(8, 10);
          const mes = MESES_CORTOS[Number(c.inicio.slice(5, 7)) - 1] || "";
          const reprogramada = c.estado === "programada" && (c.reprogramada || esReprogramada(c.id));
          const servicioTxt = [c.servicio_nombre, textoSubtipo(c.subtipo)].filter(Boolean).join(" · ");
          const extras = (c.adicionales || []).length
            ? ` + ${(c.adicionales || []).join(", ")}` : "";
          return `
          <a class="hist-item ${c.estado === "cancelada" ? "cancelada" : ""}" href="#/cita/${c.id}">
            <span class="hist-fecha">
              <span class="hist-dia">${dia}</span>
              <span class="hist-mes">${mes}</span>
            </span>
            <span class="hist-datos">
              <span class="hist-servicio">${escapeHtml(servicioTxt)}${extras ? escapeHtml(extras) : ""}</span>
              <span class="hist-meta">
                <span>${icono.reloj(12)}${hora(c.inicio)}</span>
                <span>${icono.usuario(12)}${escapeHtml(c.empleado_nombre)}</span>
              </span>
            </span>
            <span class="hist-der">
              <span class="hist-precio">${importe(c.precio_total_moneda ?? c.precio_total, c.moneda)}<small>${etiquetaMoneda(c.moneda)}</small></span>
              ${reprogramada
                ? `<span class="badge badge-reprogramada">Reprogramada</span>`
                : badgeCita(c)}
            </span>
          </a>`;
        }).join("")
      : `<div class="vacio">Todavía no tiene citas.</div>`;
  }

  function pintarEdicion() {
    raiz.innerHTML = `
      <div class="form-vista">
        <div class="vista-cab">
          <span class="vista-ico">${icono.usuario(22)}</span>
          <div class="vista-cab-texto">
            <h1 class="vista-titulo">Editar clienta</h1>
            <p class="form-sub">Actualiza los datos de «${escapeHtml(cliente.nombre)}».</p>
          </div>
        </div>
        ${formCliente(cliente)}
        <div class="form-acciones">
          <button class="btn btn-contorno" id="btn-cancelar" type="button">Cancelar edición</button>
          <button class="btn btn-dorado" id="btn-guardar" type="button">
            ${icono.check(16)} Guardar cambios
          </button>
        </div>
      </div>`;
    $("#btn-cancelar").onclick = () => pintarVista();
    $("#btn-guardar").onclick = async () => {
      const datos = leerFormulario();
      if (!datos) return;
      try {
        cliente = await patch(`/clientes/${cliente.id}`, datos);
        aviso("Cambios guardados", "ok");
        pintarVista();
      } catch (e) {
        $("#cl-error").textContent = e.message;
        $("#cl-error").classList.remove("oculto");
      }
    };
  }

  pintarVista();
}
