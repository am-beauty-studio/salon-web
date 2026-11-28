// Confirmación visual al agendar o archivar una cita.
// Equivalente a src/components/ModalExitoCita.tsx de salon_app: mismo resumen,
// mismos colores y misma jerarquía, pero en HTML.
//
// Uso:
//   await mostrarExitoCita({ titulo, cliente, fecha, items, duracion, total, archivada });
// El Promise se resuelve cuando la persona pulsa OK, la X, fuera de la tarjeta
// o la tecla Esc.

import { $, escapeHtml, importe, etiquetaMoneda } from "./util.js?v=57";
import { icono } from "./iconos.js?v=65";

export function mostrarExitoCita(datos) {
  return new Promise((resolver) => {
    const zona = $("#modal-zona");
    const archivada = Boolean(datos.archivada);
    const moneda = datos.moneda || "USD";
    const total = datos.totalMoneda ?? datos.total;

    const filas = datos.items
      .map(
        (it) => `
        <div class="exito-item">
          <span class="exito-hora">${escapeHtml(it.hora)}</span>
          <span class="exito-item-txt">
            <b>${escapeHtml(it.servicio)}</b>
            ${it.detalle ? `<small>${escapeHtml(it.detalle)}</small>` : ""}
          </span>
        </div>`
      )
      .join("");

    zona.innerHTML = `
      <div class="exito-fondo">
        <div class="exito-caja" role="dialog" aria-modal="true" aria-labelledby="exito-titulo">
          <button class="exito-cerrar" type="button" aria-label="Cerrar">
            ${icono.equis(20)}
          </button>

          <div class="exito-icono ${archivada ? "archivada" : ""}">
            ${archivada ? icono.archivo(34) : icono.check(34)}
          </div>

          <h2 class="exito-titulo" id="exito-titulo">${escapeHtml(datos.titulo)}</h2>
          <p class="exito-sub">
            ${archivada ? "Quedó guardada como archivada" : "Todo quedó registrado correctamente"}
          </p>
          ${archivada ? `<span class="badge badge-dorado">Archivada</span>` : ""}

          <div class="exito-datos">
            <div class="exito-fila">
              ${icono.usuario(16)}
              <span>${escapeHtml(datos.cliente)}</span>
            </div>
            <div class="exito-fila">
              ${icono.calendario(16)}
              <span>${escapeHtml(datos.fecha)}</span>
            </div>
          </div>

          <div class="exito-lista">${filas}</div>

          <div class="exito-pie">
            <span class="exito-fila">
              ${icono.reloj(16)}
              <span>${escapeHtml(datos.duracion)}</span>
            </span>
            <strong>${importe(total, moneda)} ${etiquetaMoneda(moneda)}</strong>
          </div>

          <button class="btn btn-dorado btn-bloque" type="button" data-ok>OK</button>
        </div>
      </div>`;

    function cerrar() {
      document.removeEventListener("keydown", alTeclear);
      zona.innerHTML = "";
      resolver();
    }

    function alTeclear(e) {
      if (e.key === "Escape") cerrar();
    }

    document.addEventListener("keydown", alTeclear);
    zona.querySelector("[data-ok]").onclick = cerrar;
    zona.querySelector(".exito-cerrar").onclick = cerrar;
    zona.querySelector(".exito-fondo").addEventListener("click", (e) => {
      if (e.target.classList.contains("exito-fondo")) cerrar();
    });

    // El botón OK recibe el foco para poder confirmar con Enter.
    zona.querySelector("[data-ok]").focus();
  });
}

/**
 * Ventana de aviso al reprogramar una cita: compara el horario anterior con el
 * nuevo para que el cambio se lea de un vistazo.
 *
 * Uso: await mostrarExitoReprogramar({ cliente, servicio, antes, ahora })
 * donde antes/ahora = { fecha, hora, empleada }.
 */
export function mostrarExitoReprogramar(datos) {
  return new Promise((resolver) => {
    const zona = $("#modal-zona");

    const bloque = (cuando, clase) => `
      <div class="reprog-bloque ${clase}">
        <span class="reprog-etq">${clase === "antes" ? "Antes" : "Ahora"}</span>
        <span class="reprog-fecha">${escapeHtml(cuando.fecha)}</span>
        <span class="reprog-detalle">
          ${escapeHtml(cuando.hora)} · ${escapeHtml(cuando.empleada)}
        </span>
      </div>`;

    zona.innerHTML = `
      <div class="exito-fondo">
        <div class="exito-caja" role="dialog" aria-modal="true" aria-labelledby="exito-titulo">
          <button class="exito-cerrar" type="button" aria-label="Cerrar">
            ${icono.equis(20)}
          </button>

          <div class="exito-icono cambio">${icono.repetir(32)}</div>

          <h2 class="exito-titulo" id="exito-titulo">Cita reprogramada</h2>
          <p class="exito-sub">Quedó guardada con el nuevo horario</p>
          <span class="exito-badge">Reprogramada</span>

          <div class="exito-datos">
            <div class="exito-fila">
              ${icono.usuario(16)}
              <span>${escapeHtml(datos.cliente)}</span>
            </div>
            <div class="exito-fila">
              ${icono.etiqueta(16)}
              <span>${escapeHtml(datos.servicio)}</span>
            </div>          </div>

          <div class="reprog-comp">
            ${bloque(datos.antes, "antes")}
            <span class="reprog-sep" aria-hidden="true">${icono.repetir(15)}</span>
            ${bloque(datos.ahora, "ahora")}
          </div>

          <button class="btn btn-dorado btn-bloque" type="button" data-ok>OK</button>
        </div>
      </div>`;

    function cerrar() {
      document.removeEventListener("keydown", alTeclear);
      zona.innerHTML = "";
      resolver();
    }

    function alTeclear(e) {
      if (e.key === "Escape") cerrar();
    }

    document.addEventListener("keydown", alTeclear);
    zona.querySelector("[data-ok]").onclick = cerrar;
    zona.querySelector(".exito-cerrar").onclick = cerrar;
    zona.querySelector(".exito-fondo").addEventListener("click", (e) => {
      if (e.target.classList.contains("exito-fondo")) cerrar();
    });
    zona.querySelector("[data-ok]").focus();
  });
}
