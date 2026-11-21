// Formulario de usuario (nuevo / editar, solo superadministrador).
// Equivalente a src/app/usuarios/* y components/UsuarioForm.tsx.

import { get, post, patch, del } from "../api.js?v=48";
import { actualizarUsuario, usuario as usuarioActual } from "../auth.js?v=50";
import { $, $$, aviso, confirmar, escapeHtml } from "../util.js?v=52";
import { icono } from "../iconos.js?v=64";

const ETIQUETA_ROL = {
  superadmin: "Superadmin",
  admin: "Administrador",
  usuario: "Usuario",
};
const CLASE_ROL = {
  superadmin: "badge-dorado",
  admin: "badge-azul",
  usuario: "badge-gris",
};

export async function render(raiz, params) {
  const nuevo = params.modo === "nuevo";
  const usuario = nuevo ? null : await get(`/usuarios/${params.id}`);
  const esSuper = usuario?.rol === "superadmin";
  let rol = usuario?.rol === "admin" ? "admin" : "usuario";

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${nuevo ? icono.personas(20) : icono.lapiz(19)}</span>
      <div class="vista-cab-texto">
        <h1 class="vista-titulo">${nuevo ? "Nuevo usuario" : "Editar usuario"}</h1>
        <p class="vista-sub">${nuevo
          ? "Crea una cuenta y define su nivel de acceso al sistema."
          : "Actualiza los datos, el rol y el estado de la cuenta."}</p>
      </div>
    </div>

    ${!nuevo ? `
      <div class="usuario-resumen ${usuario.activo ? "" : "inactivo"}">
        <span class="usuario-avatar">${icono.usuario(24)}</span>
        <div class="usuario-resumen-datos">
          <strong>${escapeHtml(usuario.nombre)}</strong>
          <span>@${escapeHtml(usuario.usuario || "")}</span>
          <span>${escapeHtml(usuario.email)}</span>
        </div>
        <div class="usuario-resumen-badges">
          <span class="badge ${CLASE_ROL[usuario.rol] || "badge-gris"}">
            ${ETIQUETA_ROL[usuario.rol] || escapeHtml(usuario.rol)}
          </span>
          <span class="badge ${usuario.activo ? "badge-completada" : "badge-rojo"}">
            ${usuario.activo ? "Activo" : "Inactivo"}
          </span>
        </div>
      </div>` : ""}

    <section class="tarjeta usuario-tarjeta">
      <div class="usuario-tarjeta-cab">
        <span class="usuario-tarjeta-ico">${icono.candado(17)}</span>
        <div class="usuario-tarjeta-texto">
          <h2 class="usuario-tarjeta-titulo">Datos de acceso</h2>
          <p class="usuario-tarjeta-sub">Nombre, usuario, correo y contraseña de la cuenta.</p>
        </div>
      </div>

      <div class="campo">
        <label class="etiqueta" for="us-nombre">Nombre *</label>
        <div class="campo-ico">
          ${icono.usuario()}
          <input class="input" id="us-nombre" autocomplete="name"
                 value="${escapeHtml(usuario?.nombre || "")}" />
        </div>
      </div>
      <div class="campo">
        <label class="etiqueta" for="us-usuario">Usuario *</label>
        <div class="campo-ico">
          ${icono.usuario()}
          <input class="input" id="us-usuario" autocapitalize="none"
                 autocomplete="username" maxlength="50"
                 value="${escapeHtml(usuario?.usuario || "")}" />
        </div>
        <p class="nota">Es el nombre con el que inicia sesión. Sin espacios.</p>
      </div>
      <div class="campo">
        <label class="etiqueta" for="us-email">Correo *</label>
        <div class="campo-ico">
          ${icono.correo()}
          <input class="input" id="us-email" type="email" autocapitalize="none"
                 autocomplete="email"
                 value="${escapeHtml(usuario?.email || "")}" ${esSuper ? "readonly" : ""} />
        </div>
        ${esSuper ? `<p class="nota">El correo de la cuenta superadministradora no se puede cambiar.</p>` : ""}
      </div>
      <div class="campo" style="margin-bottom:0">
        <label class="etiqueta" for="us-password">${nuevo ? "Contraseña *" : "Nueva contraseña"}</label>
        <div class="campo-ico">
          ${icono.candado()}
          <input class="input" id="us-password" type="password" autocomplete="new-password"
                 placeholder="${nuevo ? "Mínimo 8 caracteres" : "Dejar en blanco para no cambiarla"}" />
          <button class="btn-ojo" id="us-ojo" type="button" title="Mostrar u ocultar la contraseña">${icono.ojo()}</button>
        </div>
        <p class="nota">${nuevo
          ? "Debe tener al menos 8 caracteres."
          : "Déjala en blanco si no quieres modificarla."}</p>
      </div>
    </section>

    <section class="tarjeta usuario-tarjeta">
      <div class="usuario-tarjeta-cab">
        <span class="usuario-tarjeta-ico">${icono.escudo(17)}</span>
        <div class="usuario-tarjeta-texto">
          <h2 class="usuario-tarjeta-titulo">Rol y permisos</h2>
          <p class="usuario-tarjeta-sub">Define a qué secciones puede acceder esta cuenta.</p>
        </div>
      </div>

      ${esSuper ? `
        <div class="usuario-super">
          <span class="badge badge-dorado">Superadmin</span>
          <p class="nota" style="margin:0">
            Esta cuenta tiene el control total y su rol no se puede cambiar.
          </p>
        </div>` : `
        <div class="rol-opciones" id="us-roles">
          <button class="rol-opcion ${rol === "admin" ? "activo" : ""}" data-rol="admin"
                  type="button" aria-pressed="${rol === "admin"}">
            <span class="rol-opcion-marca">${icono.check(13)}</span>
            <span class="rol-opcion-txt">
              <strong>Administrador</strong>
              <small>Servicios, empleadas, ganancias y estadísticas.</small>
            </span>
          </button>
          <button class="rol-opcion ${rol === "usuario" ? "activo" : ""}" data-rol="usuario"
                  type="button" aria-pressed="${rol === "usuario"}">
            <span class="rol-opcion-marca">${icono.check(13)}</span>
            <span class="rol-opcion-txt">
              <strong>Usuario</strong>
              <small>Agenda y clientas.</small>
            </span>
          </button>
        </div>`}

      ${!nuevo && !esSuper ? `
        <label class="usuario-estado" for="us-activo">
          <span class="usuario-estado-txt">
            <strong>Usuario activo</strong>
            <small id="us-activo-nota">${usuario.activo
              ? "Puede iniciar sesión y usar el sistema."
              : "No puede iniciar sesión hasta que lo actives."}</small>
          </span>
          <input type="checkbox" class="usuario-switch" id="us-activo" ${usuario.activo ? "checked" : ""} />
        </label>` : ""}
    </section>

    <p class="error-txt oculto" id="us-error"></p>
    <div class="fila-btns">
      <a class="btn btn-contorno" href="#/usuarios">Volver</a>
      <button class="btn btn-dorado" id="us-guardar" type="button">
        ${nuevo ? "Crear usuario" : "Guardar cambios"}
      </button>
    </div>

    ${!nuevo && !esSuper ? `
      <div class="zona-peligro usuario-peligro">
        <div class="usuario-tarjeta-cab">
          <span class="usuario-tarjeta-ico peligro">${icono.papelera(17)}</span>
          <div class="usuario-tarjeta-texto">
            <h3>Eliminar usuario</h3>
            <p>Se borrará definitivamente y ya no podrá entrar. Sus citas se conservan
               en el historial.</p>
          </div>
        </div>
        <button class="btn btn-rojo-contorno" id="us-eliminar" type="button">Eliminar usuario</button>
      </div>` : ""}`;

  $("#us-ojo").onclick = () => {
    const campo = $("#us-password");
    const ver = campo.type === "password";
    campo.type = ver ? "text" : "password";
    $("#us-ojo").innerHTML = ver ? icono.ojoTachado() : icono.ojo();
  };

  $$("#us-roles .rol-opcion").forEach((opcion) => {
    opcion.onclick = () => {
      rol = opcion.dataset.rol;
      $$("#us-roles .rol-opcion").forEach((o) => {
        const activo = o === opcion;
        o.classList.toggle("activo", activo);
        o.setAttribute("aria-pressed", String(activo));
      });
    };
  });

  const $activo = $("#us-activo");
  if ($activo) {
    $activo.onchange = () => {
      const nota = $("#us-activo-nota");
      if (nota) {
        nota.textContent = $activo.checked
          ? "Puede iniciar sesión y usar el sistema."
          : "No puede iniciar sesión hasta que lo actives.";
      }
    };
  }

  $("#us-guardar").onclick = async () => {
    const error = $("#us-error");
    error.classList.add("oculto");

    const nombre = $("#us-nombre").value.trim();
    const usuario = $("#us-usuario").value.trim().toLowerCase();
    const email = $("#us-email").value.trim();
    const password = $("#us-password").value;

    if (nombre.length < 2) {
      error.textContent = "Escribe el nombre del usuario (mínimo 2 letras).";
      error.classList.remove("oculto");
      return;
    }
    if (!/^[a-z0-9._-]{3,50}$/.test(usuario)) {
      error.textContent = "El usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.";
      error.classList.remove("oculto");
      return;
    }
    if (!esSuper && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      error.textContent = "Escribe un correo válido.";
      error.classList.remove("oculto");
      return;
    }
    if (nuevo && password.length < 8) {
      error.textContent = "La contraseña debe tener al menos 8 caracteres.";
      error.classList.remove("oculto");
      return;
    }
    if (password && password.length < 8) {
      error.textContent = "La contraseña debe tener al menos 8 caracteres.";
      error.classList.remove("oculto");
      return;
    }

    const datos = { nombre, usuario };
    if (!esSuper) {
      datos.email = email;
      datos.rol = rol;
    }
    if (password) datos.password = password;
    if (!nuevo && !esSuper) datos.activo = $("#us-activo").checked;

    const boton = $("#us-guardar");
    boton.disabled = true;
    try {
      let guardado;
      if (nuevo) {
        guardado = await post("/usuarios", datos);
        aviso("Usuario creado", "ok");
      } else {
        guardado = await patch(`/usuarios/${usuario.id}`, datos);
        aviso("Cambios guardados", "ok");
      }
      // Si se editó la cuenta conectada, el perfil («Mi cuenta») se actualiza
      // al instante con el nuevo usuario, sin tener que volver a iniciar sesión.
      if (guardado && usuarioActual?.id === guardado.id) {
        actualizarUsuario(guardado);
        const chip = $("#usuario-nombre");
        if (chip) chip.textContent = guardado.nombre;
      }
      location.hash = "#/usuarios";
    } catch (e) {
      error.textContent = e.message;
      error.classList.remove("oculto");
      boton.disabled = false;
    }
  };

  if (!nuevo && !esSuper) {
    $("#us-eliminar").onclick = async () => {
      if (!(await confirmar(
        "Eliminar usuario",
        `¿Borrar definitivamente a «${usuario.nombre}»?`,
        "Sí, eliminar"
      ))) return;
      try {
        await del(`/usuarios/${usuario.id}`);
        aviso("Usuario eliminado", "ok");
        location.hash = "#/usuarios";
      } catch (e) {
        aviso(e.message, "error");
      }
    };
  }
}
