// Muestra un botón flotante cuando el botón original deja de verse al bajar.
// Se limpia solo al cambiar de vista (hashchange) o si el DOM se reemplaza.
export function activarFabAlDesplazar(boton, fab, cabecera) {
  if (!boton || !fab) return () => {};
  let cuadro = 0;

  function ajustar() {
    cuadro = 0;
    if (!boton.isConnected || !fab.isConnected) {
      limpiar();
      return;
    }
    const alto = cabecera ? cabecera.getBoundingClientRect().height : 56;
    fab.classList.toggle("visible", boton.getBoundingClientRect().bottom <= alto);
  }

  function alDesplazar() {
    if (!cuadro) cuadro = requestAnimationFrame(ajustar);
  }

  function limpiar() {
    window.removeEventListener("scroll", alDesplazar);
    window.removeEventListener("resize", alDesplazar);
    window.removeEventListener("hashchange", limpiar);
    if (cuadro) cancelAnimationFrame(cuadro);
  }

  window.addEventListener("scroll", alDesplazar, { passive: true });
  window.addEventListener("resize", alDesplazar);
  window.addEventListener("hashchange", limpiar);
  ajustar();
  return limpiar;
}
