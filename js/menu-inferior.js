// Barra inferior fija de acciones rápidas (equivalente a MenuInferior de salon_app).
// En PC se muestra como un dock centrado; en móvil, como barra de ancho completo.

import { del, get, put } from "./api.js?v=48";
import {
  actualizarUsuario, cerrarSesion, esAdmin, haySesion, usuario,
} from "./auth.js?v=50";
import { icono } from "./iconos.js?v=64";
import { $, aviso, escapeHtml } from "./util.js?v=52";

// Tamaño de la foto de perfil que se guarda (cuadrada) y límites de entrada.
const FOTO_LADO = 320;
const FOTO_MAX_ENTRADA = 15 * 1024 * 1024;

const NOMBRE_ROL = {
  superadmin: "Superadministradora",
  admin: "Administradora",
  usuario: "Usuaria",
  recepcion: "Recepción",
};

/** Pinta los botones del menú inferior y enlaza sus acciones. */
export function pintarMenuInferior() {
  const nav = $("#menu-inferior");
  if (!nav) return;

  // El rol `usuario` solo puede consultar las citas: no se le ofrecen acciones
  // para agendar ni archivar.
  const items = [
    ...(esAdmin()
      ? [
          { id: "nueva", texto: "Nueva cita", ico: icono.mas(20), clase: "mi-principal" },
          { id: "archivar", texto: "Archivar cita", ico: icono.archivo(19) },
        ]
      : []),
    { id: "notificaciones", texto: "Notificaciones", ico: icono.campana(19) },
    { id: "usuario", texto: "Usuario", ico: icono.usuario(19) },
  ];

  nav.innerHTML = items
    .map((it) => `
      <button class="mi-item ${it.clase || ""}" data-mi="${it.id}" type="button"
              title="${it.texto}" aria-label="${it.texto}">
        <span class="mi-icono">${it.ico}</span>
        <span class="mi-texto">${it.texto}</span>
      </button>`)
    .join("");

  nav.querySelector("[data-mi='nueva']")?.addEventListener("click", () => {
    location.hash = "#/cita/nueva";
  });
  nav.querySelector("[data-mi='archivar']")?.addEventListener("click", () => {
    location.hash = "#/cita/nueva?archivar=1";
  });
  nav.querySelector("[data-mi='notificaciones']").onclick = () => {
    location.hash = "#/notificaciones";
  };
  nav.querySelector("[data-mi='usuario']").onclick = abrirCuenta;

  escucharTeclado(nav);
  pintarChipUsuario();
  refrescarBadgeNotificaciones();
}

/** Muestra la foto (o el icono) de la cuenta conectada en la cabecera. */
function pintarChipUsuario() {
  const chip = $("#chip-usuario");
  if (!chip) return;
  const nombre = escapeHtml(usuario?.nombre || "");
  chip.innerHTML = usuario?.foto
    ? `<img class="chip-usuario-foto" src="${escapeHtml(usuario.foto)}" alt="" /><span id="usuario-nombre">${nombre}</span>`
    : `${icono.usuario(17)}<span id="usuario-nombre">${nombre}</span>`;
  chip.title = usuario?.nombre ? `${usuario.nombre} · Sesión iniciada` : "Sesión iniciada";
}

function pintarBadge(nav, total) {
  const caja = nav.querySelector("[data-mi='notificaciones'] .mi-icono");
  if (!caja) return;
  let badge = caja.querySelector(".mi-badge");
  if (!total) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "mi-badge";
    caja.appendChild(badge);
  }
  badge.textContent = total > 9 ? "9+" : String(total);
  badge.title = `${total} sin leer`;
  badge.setAttribute("aria-label", `${total} notificaciones sin leer`);
}

/** Consulta el contador de la API y actualiza el badge de la campana. */
export function refrescarBadgeNotificaciones() {
  const nav = $("#menu-inferior");
  if (!nav || !haySesion()) return;
  get("/notificaciones/contador")
    .then((c) => pintarBadge(nav, Number(c.no_leidas) || 0))
    .catch(() => { /* sin conexión: se conserva el badge anterior */ });
}

/** Marca el botón que corresponde a la ruta actual. */
export function marcarMenuInferior(ruta) {
  const nav = $("#menu-inferior");
  if (!nav) return;
  const limpia = (ruta || "").split("?")[0];
  let activo = null;
  if (limpia === "/notificaciones") activo = "notificaciones";
  else if (limpia === "/cita/nueva") {
    activo = location.hash.includes("archivar=1") ? "archivar" : "nueva";
  }
  nav.querySelectorAll("[data-mi]").forEach((b) => {
    const esActivo = b.dataset.mi === activo;
    b.classList.toggle("activo", esActivo);
    if (esActivo) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

// En móvil, la barra se aparta mientras se escribe para no tapar el teclado.
let tecladoEscuchado = false;
function escucharTeclado(nav) {
  if (tecladoEscuchado) return;
  tecladoEscuchado = true;
  const enCampo = (el) =>
    el && el.closest && el.closest("input, textarea, select, [contenteditable='true']");
  document.addEventListener("focusin", (e) => {
    if (enCampo(e.target)) nav.classList.add("oculto-teclado");
  });
  document.addEventListener("focusout", () => {
    setTimeout(() => {
      if (!enCampo(document.activeElement)) nav.classList.remove("oculto-teclado");
    }, 80);
  });
}

let cerrarCuentaActual = null;

/** Cierra la hoja de cuenta si está abierta (al cambiar de ruta). */
export function cerrarCuenta() {
  if (cerrarCuentaActual) cerrarCuentaActual();
}

/** Hoja de cuenta: datos de la sesión y cierre de sesión. */
export function abrirCuenta() {
  const zona = $("#modal-zona");
  if (!zona) return;

  const boton = document.querySelector("#menu-inferior [data-mi='usuario']");
  boton?.classList.add("activo");

  const inicial = (usuario?.nombre || "?").charAt(0).toUpperCase();
  const rol = NOMBRE_ROL[usuario?.rol] || usuario?.rol || "";
  const overflowAnterior = document.body.style.overflow;

  zona.innerHTML = `
    <div class="cuenta-fondo">
      <div class="cuenta-hoja" role="dialog" aria-modal="true" aria-label="Cuenta de usuario" tabindex="-1">
        <div class="cuenta-asa"></div>
        <div class="cuenta-cab">
          <div class="cuenta-cab-texto">
            <p class="cuenta-titulo">Mi cuenta</p>
            <p class="cuenta-sub">Foto de perfil y sesión</p>
          </div>
          <button class="cuenta-cerrar" type="button" aria-label="Cerrar" data-cerrar>${icono.equis(18)}</button>
        </div>
        <div class="cuenta-hero">
          <div class="cuenta-avatar-wrap">
            <div class="cuenta-avatar" id="cuenta-avatar">
              ${usuario?.foto
                ? `<img src="${escapeHtml(usuario.foto)}" alt="Foto de perfil" />`
                : escapeHtml(inicial)}
            </div>
            <button class="cuenta-avatar-cam" id="cuenta-avatar-cam" type="button"
                    title="Cambiar foto" aria-label="Cambiar foto de perfil">
              ${icono.camara(14)}
            </button>
          </div>
          <div class="cuenta-datos">
            <p class="cuenta-nombre">${escapeHtml(usuario?.nombre || "Sin sesión")}</p>
            ${usuario?.usuario || usuario?.email ? `<p class="cuenta-email">${usuario?.usuario ? `@${escapeHtml(usuario.usuario)}` : ""}${usuario?.usuario && usuario?.email ? " · " : ""}${usuario?.email ? escapeHtml(usuario.email) : ""}</p>` : ""}
            ${rol ? `<span class="cuenta-rol">${icono.candado(11)}${escapeHtml(rol)}</span>` : ""}
          </div>
        </div>
        <div class="cuenta-seccion">
          <p class="cuenta-seccion-titulo">Foto de perfil</p>
          <div class="cuenta-foto-fila">
            <button class="cuenta-foto-btn" id="cuenta-foto-cambiar" type="button">
              ${icono.camara(15)}<span>Cambiar foto</span>
            </button>
            <button class="cuenta-foto-btn quitar" id="cuenta-foto-quitar" type="button"
                    ${usuario?.foto ? "" : "hidden"}>
              ${icono.papelera(15)}<span>Quitar</span>
            </button>
          </div>
        </div>
        <input type="file" id="cuenta-foto-input"
               accept="image/jpeg,image/png,image/webp" hidden />
        <button class="cuenta-salir" id="cuenta-salir" type="button">
          <span class="cuenta-salir-ico">${icono.salida(17)}</span>
          <span class="cuenta-salir-txt">Cerrar sesión</span>
          <span class="cuenta-salir-flecha" aria-hidden="true">›</span>
        </button>
      </div>
    </div>`;

  document.body.style.overflow = "hidden";

  let cerrada = false;
  function cerrar() {
    if (cerrada) return;
    cerrada = true;
    cerrarCuentaActual = null;
    document.removeEventListener("keydown", alTeclear);
    document.body.style.overflow = overflowAnterior;
    zona.innerHTML = "";
    boton?.classList.remove("activo");
  }
  cerrarCuentaActual = cerrar;
  function alTeclear(e) {
    if (e.key === "Escape") cerrar();
  }

  zona.querySelector(".cuenta-fondo").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) cerrar();
  });
  zona.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", cerrar));
  $("#cuenta-salir").onclick = () => {
    cerrar();
    cerrarSesion();
    location.hash = "#/login";
  };

  const $avatar = $("#cuenta-avatar");
  const $quitar = $("#cuenta-foto-quitar");
  const $input = $("#cuenta-foto-input");

  function pintarAvatar() {
    const foto = usuario?.foto;
    $avatar.innerHTML = foto
      ? `<img src="${escapeHtml(foto)}" alt="Foto de perfil" />`
      : escapeHtml((usuario?.nombre || "?").charAt(0).toUpperCase());
    $quitar.hidden = !foto;
    pintarChipUsuario();
  }

  async function subirFoto(archivo) {
    if (archivo.type && !archivo.type.startsWith("image/")) {
      aviso("Elige una imagen JPEG, PNG o WebP.", "error");
      return;
    }
    if (archivo.size > FOTO_MAX_ENTRADA) {
      aviso("La imagen es demasiado grande (máximo 15 MB).", "error");
      return;
    }
    let foto;
    try {
      foto = await reducirFoto(archivo);
    } catch {
      aviso("No se pudo leer la imagen. Prueba con otra.", "error");
      return;
    }
    try {
      const actualizado = await put("/auth/me/foto", { foto });
      actualizarUsuario(actualizado);
      pintarAvatar();
      aviso("Foto de perfil actualizada.", "ok");
    } catch (e) {
      aviso(e.message || "No se pudo guardar la foto.", "error");
    }
  }

  async function quitarFoto() {
    try {
      const actualizado = await del("/auth/me/foto");
      actualizarUsuario(actualizado);
      pintarAvatar();
      aviso("Foto de perfil eliminada.", "ok");
    } catch (e) {
      aviso(e.message || "No se pudo quitar la foto.", "error");
    }
  }

  $input.onchange = () => {
    const archivo = $input.files && $input.files[0];
    $input.value = "";
    if (archivo) subirFoto(archivo);
  };
  $("#cuenta-foto-cambiar").onclick = () => $input.click();
  $("#cuenta-avatar-cam").onclick = () => $input.click();
  $quitar.onclick = quitarFoto;

  document.addEventListener("keydown", alTeclear);
  zona.querySelector(".cuenta-hoja")?.focus();
}

/** Recorta la imagen en cuadrado y la guarda como JPEG pequeño (data URL). */
async function reducirFoto(archivo) {
  const imagen = await cargarImagen(archivo);
  const lienzo = document.createElement("canvas");
  lienzo.width = FOTO_LADO;
  lienzo.height = FOTO_LADO;
  const ctx = lienzo.getContext("2d");
  const escala = Math.max(FOTO_LADO / imagen.width, FOTO_LADO / imagen.height);
  const ancho = imagen.width * escala;
  const alto = imagen.height * escala;
  ctx.drawImage(imagen, (FOTO_LADO - ancho) / 2, (FOTO_LADO - alto) / 2, ancho, alto);
  if (typeof imagen.close === "function") imagen.close();
  return lienzo.toDataURL("image/jpeg", 0.82);
}

function cargarImagen(archivo) {
  const conObjetoUrl = () => new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error("Imagen ilegible"));
    };
    img.src = url;
  });
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(archivo).catch(conObjetoUrl);
  }
  return conObjetoUrl();
}
