// Confirmación visual para acciones delicadas (borrar avisos, eliminar datos).
// Sustituye el confirm() del navegador por una tarjeta con el detalle de lo que
// se va a borrar y un botón rojo, igual que ModalConfirmacion de salon_app.
//
// Uso:
//   if (!await confirmarPeligro({ titulo, mensaje, filas, accion })) return;
// filas = [{ icono: svg, texto: "..." }]

import { $, escapeHtml } from "./util.js?v=53";
import { icono } from "./iconos.js?v=64";

export function confirmarPeligro(datos) {
  return new Promise((resolver) => {
    const zona = $("#modal-zona");
    const filas = (datos.filas || [])
      .filter((f) => f && f.texto)
      .map(
        (f) => `
        <div class="modal-dato">
          ${f.icono || icono.campana(15)}
          <span>${escapeHtml(f.texto)}</span>
        </div>`
      )
      .join("");

    zona.innerHTML = `
      <div class="modal-fondo">
        <div class="modal-caja modal-caja-peligro" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
          <button class="modal-cerrar" type="button" aria-label="Cerrar">
            ${icono.equis(18)}
          </button>

          <div class="modal-ico-peligro">${datos.icono || icono.papelera(26)}</div>
          <div class="modal-titulo" id="modal-titulo">${escapeHtml(datos.titulo)}</div>
          ${datos.mensaje ? `<div class="modal-msg">${escapeHtml(datos.mensaje)}</div>` : ""}
          ${filas ? `<div class="modal-datos">${filas}</div>` : ""}
          <div class="modal-aviso">${escapeHtml(datos.aviso || "Esta acción no se puede deshacer.")}</div>

          <div class="modal-btns">
            <button class="btn btn-contorno" type="button" data-r="no">Volver</button>
            <button class="btn btn-rojo" type="button" data-r="si">${escapeHtml(datos.accion || "Eliminar")}</button>
          </div>
        </div>
      </div>`;

    function cerrar(valor) {
      document.removeEventListener("keydown", alTeclear);
      zona.innerHTML = "";
      resolver(valor);
    }

    function alTeclear(e) {
      if (e.key === "Escape") cerrar(false);
    }

    document.addEventListener("keydown", alTeclear);
    zona.querySelectorAll("[data-r]").forEach((b) => {
      b.onclick = () => cerrar(b.dataset.r === "si");
    });
    zona.querySelector(".modal-cerrar").onclick = () => cerrar(false);
    zona.querySelector(".modal-fondo").addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-fondo")) cerrar(false);
    });

    // Enter confirma la acción y Esc vuelve sin cambios.
    zona.querySelector('[data-r="si"]').focus();
  });
}
