// Selector USD/CUP con aspecto de interruptor deslizante.
// Se usa en los filtros de Ganancias/Estadísticas y al elegir la moneda de una cita.

import { normalizarMoneda } from "./util.js?v=57";

/** HTML del interruptor. La moneda activa queda marcada con `data-valor`. */
export function selectorMoneda(moneda = "USD", opciones = {}) {
  const actual = normalizarMoneda(moneda);
  const cupDeshabilitada = Boolean(opciones.cupDeshabilitada);
  const etiqueta = opciones.etiqueta || "Moneda";
  const boton = (valor) => `
    <button class="selector-moneda-opcion ${actual === valor ? "activa" : ""}"
      type="button" data-moneda="${valor}" aria-pressed="${actual === valor}"
      ${valor === "CUP" && cupDeshabilitada ? "disabled" : ""}>
      <span class="selector-moneda-simbolo" aria-hidden="true">$</span>
      <span>${valor}</span>
    </button>`;

  return `
    <div class="selector-moneda" data-valor="${actual}" role="group" aria-label="${etiqueta}">
      <span class="selector-moneda-deslizador" aria-hidden="true"></span>
      ${boton("USD")}
      ${boton("CUP")}
    </div>`;
}

/** Marca visualmente la moneda elegida sin volver a crear el componente. */
export function actualizarSelectorMoneda(raiz, moneda) {
  const selector = raiz?.matches?.(".selector-moneda")
    ? raiz
    : raiz?.querySelector?.(".selector-moneda");
  if (!selector) return;
  const actual = normalizarMoneda(moneda);
  selector.dataset.valor = actual;
  selector.querySelectorAll("[data-moneda]").forEach((boton) => {
    const activo = boton.dataset.moneda === actual;
    boton.classList.toggle("activa", activo);
    boton.setAttribute("aria-pressed", activo ? "true" : "false");
  });
}

/** Conecta los dos lados del interruptor y avisa cuando cambia la moneda. */
export function conectarSelectorMoneda(raiz, alCambiar) {
  const selector = raiz?.matches?.(".selector-moneda")
    ? raiz
    : raiz?.querySelector?.(".selector-moneda");
  if (!selector) return;
  selector.querySelectorAll("[data-moneda]").forEach((boton) => {
    boton.onclick = () => {
      if (boton.disabled) return;
      const moneda = normalizarMoneda(boton.dataset.moneda);
      if (moneda === normalizarMoneda(selector.dataset.valor)) return;
      actualizarSelectorMoneda(selector, moneda);
      alCambiar(moneda);
    };
  });
}
