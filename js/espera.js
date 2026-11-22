// Pantalla de espera mientras el servidor (Render) se despierta.
// Equivalente a src/espera.ts + EsperaServidor.tsx de salon_app:
// - Si una petición tarda más de 4 s, aparece el logo con la barra de tiempo.
// - La barra avanza hasta ~92 % en un minuto y espera ahí hasta que responde.
// - Los mensajes cambian según los segundos transcurridos.

const RETARDO_MS = 4000; // una petición se considera lenta pasados 4 s
const DURACION_BARRA_MS = 60000;
const TOPE_BARRA = 0.92;
const MINIMO_VISIBLE_MS = 700; // evita un parpadeo en cargas rápidas

const MENSAJES = [
  { hasta: 7, texto: "Conectando con el servidor…" },
  { hasta: 20, texto: "El servidor estaba en reposo y se está despertando." },
  { hasta: 42, texto: "La primera vez del día puede tardar hasta 1 minuto. Por favor, espera." },
  { hasta: 58, texto: "Ya casi está. Gracias por tu paciencia." },
  { hasta: Infinity, texto: "Está tardando más de lo normal. Revisa tu conexión a internet." },
];

const $id = (id) => document.getElementById(id);

let lentas = 0;       // peticiones lentas en curso
let forzada = false;  // visible desde el arranque de la app
let visible = false;
let inicio = 0;
let raf = 0;
let ocultarTimer = 0;

function pintar(ms) {
  const barra = $id("despertar-barra");
  const reloj = $id("despertar-seg");
  const mensaje = $id("despertar-msg");
  if (!barra || !reloj || !mensaje) return;

  const segundos = Math.floor(ms / 1000);
  const avance = Math.min(ms / DURACION_BARRA_MS, 1);
  // Curva suave: avanza rápido al principio y frena cerca del 92 %.
  const progreso = TOPE_BARRA * (1 - Math.pow(1 - avance, 2));

  barra.style.width = (progreso * 100).toFixed(1) + "%";
  reloj.textContent = `${segundos} s`;
  mensaje.textContent = MENSAJES.find((m) => segundos < m.hasta).texto;
}

function mostrar() {
  const capa = $id("despertar");
  if (!capa || visible) return;

  visible = true;
  inicio = performance.now();
  clearTimeout(ocultarTimer);
  capa.classList.remove("despertar-fuera");
  capa.removeAttribute("aria-hidden");
  pintar(0);

  const cuadro = () => {
    if (!visible) return;
    pintar(performance.now() - inicio);
    raf = requestAnimationFrame(cuadro);
  };
  raf = requestAnimationFrame(cuadro);
}

function ocultar() {
  const capa = $id("despertar");
  if (!capa) return;

  visible = false;
  cancelAnimationFrame(raf);
  capa.classList.add("despertar-fuera");
  capa.setAttribute("aria-hidden", "true");
}

function evaluar() {
  if (forzada || lentas > 0) mostrar();
  else if (visible) ocultar();
}

/** Muestra la pantalla desde el arranque (mientras se verifica la sesión). */
export function iniciarDespertar() {
  forzada = true;
  mostrar();
}

/** La app ya pintó su primera vista: se retira la pantalla de bienvenida. */
export function terminarDespertar() {
  forzada = false;
  const restante = Math.max(0, MINIMO_VISIBLE_MS - (performance.now() - inicio));
  clearTimeout(ocultarTimer);
  ocultarTimer = setTimeout(evaluar, restante);
}

/** Llamar al empezar una petición; devuelve la función para llamarla al terminar. */
export function seguirEspera() {
  let marcada = false;
  const t = setTimeout(() => {
    marcada = true;
    lentas += 1;
    evaluar();
  }, RETARDO_MS);

  return () => {
    clearTimeout(t);
    if (!marcada) return;
    marcada = false;
    lentas = Math.max(0, lentas - 1);
    evaluar();
  };
}
