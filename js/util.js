// Utilidades compartidas: fechas en español, dinero, reglas de negocio,
// y helpers de interfaz (avisos, confirmaciones, espera).

// ---------- Fechas (igual que src/fechas.ts de salon_app) ----------
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const dos = (n) => String(n).padStart(2, "0");

/** Fecha local como YYYY-MM-DD (formato que espera la API). */
export function aISO(d) {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function sumarDias(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Nombre corto para chips: nombre de pila + inicial del apellido. */
export function nombreCorto(nombre) {
  const partes = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || "";
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

export function etiqueta(d) {
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function esHoy(d) {
  return aISO(d) === aISO(new Date());
}

/** "2026-11-09T10:00:00-05:00" -> "10:00" (hora local del salón, tal como la envía la API). */
export function hora(iso) {
  return iso.slice(11, 16);
}

/** "2026-11-09T10:00:00-05:00" -> Date (solo el día local del salón). */
export function desdeISO(iso) {
  return new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

/** "2026-11-09T..." -> "09/11/2026" */
export function fechaCorta(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function duracionTxt(min) {
  min = Number(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function lunesDe(d) {
  return sumarDias(d, -((d.getDay() + 6) % 7));
}

export function sumarMeses(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function tituloMes(d) {
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "octubre – diciembre 2026" (trimestre que contiene la fecha). */
export function tituloTrimestre(d) {
  const ini = Math.floor(d.getMonth() / 3) * 3;
  return `${MESES[ini]} – ${MESES[ini + 2]} ${d.getFullYear()}`;
}

/** "julio – diciembre 2026" (semestre que contiene la fecha). */
export function tituloSemestre(d) {
  const ini = d.getMonth() < 6 ? 0 : 6;
  return `${MESES[ini]} – ${MESES[ini + 5]} ${d.getFullYear()}`;
}

export function tituloAnio(d) {
  return `${d.getFullYear()}`;
}

/** "2026-10" -> "oct 2026" */
export function mesCorto(clave) {
  const [anio, mes] = clave.split("-").map(Number);
  return `${MESES[mes - 1].slice(0, 3)} ${anio}`;
}

function corto(d) {
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}

/** "9 nov – 15 nov" (semana de lunes a domingo que contiene la fecha). */
export function etiquetaSemana(d) {
  const lunes = lunesDe(d);
  return `${corto(lunes)} – ${corto(sumarDias(lunes, 6))}`;
}

/** "2026-11-09" -> "lun 9" */
export function diaCorto(iso) {
  const d = desdeISO(iso);
  return `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()}`;
}

export const usd = (valor) => `$${Number(valor).toFixed(2)}`;

// ---------- Reglas de negocio (igual que src/reglas.ts) ----------
/** Categoría principal + categorías extra de un servicio. */
export function categoriasDe(servicio) {
  const lista = [servicio.categoria, ...(servicio.categorias || servicio.categorias_extra || [])];
  return [...new Set(lista.filter(Boolean))];
}

/** Texto visible de una categoría: "Paquete" se muestra como "Full Service". */
export function mostrarCategoria(cat) {
  const t = (cat || "").trim();
  return t.toLowerCase().startsWith("paquete") ? "Full Service" : t;
}

// ---------- Orden y colores de categorías ----------
/**
 * Posición de una categoría en el orden fijo del salón:
 * 1 Manicura · 2 Spa Manicura · 3 Pedicura · 4 Spa Pedicura ·
 * 5 Cejas · 6 Pestañas · 7 Full Service.
 * Se detecta por palabras (en la BD se guardan como "Manicura SPA"
 * y "Pedicura SPA"), y lo desconocido va al final, alfabético.
 */
export function ordenCategoria(cat) {
  const clave = normalizarClave(cat);
  if (clave.startsWith("paquete") || clave.includes("full")) return 7;
  if (clave.includes("manicura")) return clave.includes("spa") ? 2 : 1;
  if (clave.includes("pedicura")) return clave.includes("spa") ? 4 : 3;
  if (clave.includes("ceja")) return 5;
  if (clave.includes("pestana")) return 6;
  return 8; // Desconocidas: al final (luego alfabético)
}

/** Comparador para ordenar categorías con el orden fijo del salón. */
export const compararCategorias = (a, b) =>
  ordenCategoria(a) - ordenCategoria(b) ||
  mostrarCategoria(a).localeCompare(mostrarCategoria(b), "es");

/** Tono único de las tarjetas de categoría: cuerpo blanco y cabecera clara
    teñida (el mismo rosa suave de Ganancias), iguales para todas las
    categorías. */
const FONDO_CATEGORIA = "#FFFFFF";
const CABECERA_CATEGORIA = "#FBEDF2";

/** Fondo claro de la tarjeta de la categoría. */
export function colorCategoria(cat) {
  return FONDO_CATEGORIA;
}

/** Cabecera teñida (rosa claro) de la tarjeta de la categoría. */
export function colorCategoriaCabecera(cat) {
  return CABECERA_CATEGORIA;
}

// ---------- Validaciones compartidas (la API vuelve a comprobarlas) ----------
export const MENSAJE_TELEFONO =
  "El teléfono debe tener formato de Cuba: +53 seguido de 8 dígitos " +
  "(por ejemplo, +53 55512345).";

/** Clave para comparar textos sin mayúsculas, acentos ni espacios de más. */
export function normalizarClave(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Devuelve un mensaje de error si el teléfono no es cubano, o null si es válido/vacío. */
export function errorTelefonoCuba(valor) {
  const texto = (valor || "").trim();
  if (!texto) return null;

  const limpio = texto.replace(/[\s\-.()]/g, "");
  let digitos = limpio;
  if (limpio.startsWith("+")) {
    if (!limpio.startsWith("+53")) return MENSAJE_TELEFONO;
    digitos = limpio.slice(3);
  } else if (limpio.startsWith("0053")) {
    digitos = limpio.slice(4);
  } else if (limpio.startsWith("53") && limpio.length > 8) {
    digitos = limpio.slice(2);
  }

  if (!/^\d{8}$/.test(digitos) || !"234567".includes(digitos[0])) {
    return MENSAJE_TELEFONO;
  }
  return null;
}

/** Reutiliza la grafía ya existente de una categoría (sin distinguir acentos). */
export function categoriaCanonica(categoria, categorias) {
  const clave = normalizarClave(categoria);
  return categorias.find((c) => normalizarClave(c) === clave) ?? categoria.trim();
}

/** Un adicional es compatible si comparte categoría con el servicio principal. */
export function compatible(principal, adicional) {
  const delPrincipal = new Set(categoriasDe(principal).map((c) => c.toLowerCase()));
  return categoriasDe(adicional).some((c) => delPrincipal.has(c.toLowerCase()));
}

/**
 * Única combinación que puede ir A LA MISMA HORA dentro de una reserva
 * (en paralelo, cada una con su especialista): Pestañas + Pedicura.
 * Cejas + Pedicura y el resto deben ir sin cruzarse: se prefiere la hora
 * seguida, pero se permite un hueco si esa hora ya está ocupada (igual que la API).
 */
const COMBINADOS = [
  ["Pestañas", "Pedicura"],
];

export function combinables(catA, catB) {
  return COMBINADOS.some(
    ([x, y]) => (catA === x && catB === y) || (catA === y && catB === x)
  );
}

/** Texto del subtipo para mostrar: 1 letra -> "Tipo C", sino el texto tal cual. */
export function textoSubtipo(subtipo) {
  if (!subtipo) return "";
  return subtipo.length === 1 ? `Tipo ${subtipo}` : subtipo;
}

// ---------- DOM helpers ----------
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : String(texto);
  return div.innerHTML;
}

// ---------- Overlays ----------
export function esperar(mensaje) {
  const zona = $("#espera");
  $("#espera-msg").textContent = mensaje || "Cargando…";
  zona.classList.remove("oculto");
}

export function soltar() {
  $("#espera").classList.add("oculto");
}

export function aviso(mensaje, tipo = "") {
  const zona = $("#aviso-zona");
  const caja = document.createElement("div");
  caja.className = `aviso ${tipo}`;
  caja.textContent = mensaje;
  zona.appendChild(caja);
  setTimeout(() => caja.remove(), 4200);
}

/** Modal de confirmación. Devuelve true si la persona acepta. */
export function confirmar(titulo, mensaje, textoAccion = "Sí") {
  return new Promise((resolver) => {
    const zona = $("#modal-zona");
    zona.innerHTML = `
      <div class="modal-fondo">
        <div class="modal-caja">
          <div class="modal-titulo">${escapeHtml(titulo)}</div>
          <div class="modal-msg">${escapeHtml(mensaje)}</div>
          <div class="modal-btns">
            <button class="btn btn-contorno" data-r="no">Volver</button>
            <button class="btn btn-dorado" data-r="si">${escapeHtml(textoAccion)}</button>
          </div>
        </div>
      </div>`;
    zona.querySelectorAll("[data-r]").forEach((b) => {
      b.onclick = () => {
        zona.innerHTML = "";
        resolver(b.dataset.r === "si");
      };
    });
  });
}

/** Cerrar cualquier modal abierto. */
export function cerrarModal() {
  $("#modal-zona").innerHTML = "";
}

/** Estado de cita -> clase de badge.
 *  Si la cita fue reprogramada (lo marca la API, o lo recuerda este navegador
 *  para las antiguas), la etiqueta dice "Reprogramada" en lugar de "Programada". */
export function badgeEstado(estado, citaId = null, marcada = false) {
  const mapa = { programada: "programada", completada: "completada", cancelada: "cancelada" };
  const reprog = estado === "programada" && (marcada || (citaId != null && esReprogramada(citaId)));
  const clase = mapa[estado] || "cancelada";
  const texto = { programada: reprog ? "Reprogramada" : "Programada", completada: "Completada", cancelada: "Cancelada" }[estado] || estado;
  return `<span class="badge badge-${clase}">${texto}</span>`;
}

/** Badge de una cita completa (usa `reprogramada` de la API). */
export function badgeCita(cita) {
  return badgeEstado(cita.estado, cita.id, Boolean(cita.reprogramada));
}

// ---------- Citas reprogramadas (recuerdo local del navegador) ----------
// La API no marca si una cita fue reprogramada, así que cada frontend
// guarda los ids de las citas que reprogramó y pinta su etiqueta distinta.
const CLAVE_REPROG = "salon_reprogramadas";
const MAX_REPROG = 300;

function leerReprog() {
  try { return JSON.parse(localStorage.getItem(CLAVE_REPROG) || "[]"); }
  catch { return []; }
}

/** Guarda los ids de citas que acaban de reprogramarse. */
export function marcarReprogramadas(ids) {
  if (!ids?.length) return;
  const conjunto = new Set(leerReprog().concat(ids.map(Number)));
  const lista = [...conjunto].slice(-MAX_REPROG); // acotar para no crecer sin fin
  localStorage.setItem(CLAVE_REPROG, JSON.stringify(lista));
}

/** ¿Esta cita fue reprogramada desde este navegador? */
export function esReprogramada(id) {
  return leerReprog().includes(Number(id));
}

/** Días de la semana que cubren los horarios de una empleada -> "Lun a Vie" o "Lun, Mié…". */
export function diasTxt(horarios = []) {
  const dias = [...new Set(horarios.map((h) => h.dia_semana))].sort((a, b) => a - b);
  if (!dias.length) return "Sin horario";
  const siglas = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const consecutivos =
    dias.length > 1 && dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
  if (consecutivos) return `${siglas[dias[0]]} a ${siglas[dias[dias.length - 1]]}`;
  return dias.map((d) => siglas[d]).join(", ");
}
