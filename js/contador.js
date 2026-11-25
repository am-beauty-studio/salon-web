// Efecto count-up para las cifras de las tarjetas.
// Los elementos con [data-contar] guardan el texto final; al pintarlos se
// anima solo la parte numérica y se conservan prefijo, sufijo y decimales.
// Funciona igual para USD y para CUP, incluso con separador de miles.

const MENOS_MOVIMIENTO = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function animarCifras(raiz, duracion = 750) {
  if (!raiz) return;
  const reducir = MENOS_MOVIMIENTO();

  raiz.querySelectorAll("[data-contar]").forEach((elemento) => {
    const texto = elemento.dataset.contar || "";
    const coincidencia = texto.match(/-?\d[\d,]*(?:\.\d+)?/);
    if (!coincidencia) return;

    const destino = Number(coincidencia[0].replace(/,/g, ""));
    if (!Number.isFinite(destino)) return;

    const prefijo = texto.slice(0, coincidencia.index);
    const sufijo = texto.slice(coincidencia.index + coincidencia[0].length);
    const decimales = (coincidencia[0].split(".")[1] || "").length;
    // Los importes en CUP pueden llevar separador de miles ($7,500.00).
    const conMiles = coincidencia[0].includes(",");
    const formatear = (valor) => {
      const numero = decimales
        ? conMiles
          ? valor.toLocaleString("en-US", {
              minimumFractionDigits: decimales,
              maximumFractionDigits: decimales,
            })
          : valor.toFixed(decimales)
        : conMiles
          ? Math.round(valor).toLocaleString("en-US")
          : String(Math.round(valor));
      return `${prefijo}${numero}${sufijo}`;
    };

    if (reducir || destino === 0) {
      elemento.textContent = texto;
      return;
    }

    const inicio = performance.now();
    const paso = (ahora) => {
      const avance = Math.min((ahora - inicio) / duracion, 1);
      const suave = 1 - Math.pow(1 - avance, 3);
      if (avance < 1) {
        elemento.textContent = formatear(destino * suave);
        requestAnimationFrame(paso);
      } else {
        elemento.textContent = texto;
      }
    };
    requestAnimationFrame(paso);
  });
}
