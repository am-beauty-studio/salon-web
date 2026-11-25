// Gestión de usuarios (solo el superadministrador).
// Equivalente a src/app/usuarios/index.tsx.

import { get } from "../api.js?v=49";
import { $, escapeHtml } from "../util.js?v=54";
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

export async function render(raiz) {
  const usuarios = await get("/usuarios");
  let textoBusqueda = "";

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${icono.personas(22)}</span>
      <div class="vista-cab-texto">
        <h1 class="vista-titulo">Usuarios</h1>
        <p class="vista-sub">Cuentas del sistema, su rol y su estado de acceso.</p>
      </div>
      <a class="chip-enlace" href="#/usuarios/nuevo">＋ Nuevo</a>
    </div>
    <div class="usuarios-toolbar">
      <div class="campo-ico usuarios-buscador">
        ${icono.lupa()}
        <input class="input" id="buscar" placeholder="Buscar por nombre, usuario o correo" />
      </div>
      <span class="contador" id="contador"></span>
    </div>
    <div class="usuario-lista-cab" id="lista-cab" aria-hidden="true">
      <span></span>
      <span>Cuenta</span>
      <span>Rol</span>
      <span></span>
    </div>
    <div id="lista"></div>`;

  $("#buscar").addEventListener("input", (e) => {
    textoBusqueda = e.target.value.trim().toLowerCase();
    pintar();
  });

  function pintar() {
    const visibles = usuarios.filter((u) => {
      if (!textoBusqueda) return true;
      return `${u.nombre} ${u.usuario || ""} ${u.email}`.toLowerCase().includes(textoBusqueda);
    });
    $("#contador").textContent =
      `${visibles.length} ${visibles.length === 1 ? "usuario" : "usuarios"}`;

    if (!visibles.length) {
      $("#lista-cab").hidden = true;
      $("#lista").innerHTML = `<div class="vacio">Sin resultados.</div>`;
      return;
    }
    $("#lista-cab").hidden = false;

    $("#lista").innerHTML = visibles.map((u) => `
      <a class="usuario-fila-card ${u.activo ? "" : "opaca"}" href="#/usuarios/${u.id}"
         title="Editar usuario" aria-label="Editar a ${escapeHtml(u.nombre)}">
        <span class="usuario-fila-avatar">
          ${u.foto
            ? `<img src="${escapeHtml(u.foto)}" alt="Foto de perfil de ${escapeHtml(u.nombre)}" />`
            : icono.usuario(19)}
        </span>
        <span class="usuario-fila-datos">
          <strong class="usuario-fila-nombre">${escapeHtml(u.nombre)}</strong>
          <span class="usuario-fila-meta">
            <span class="usuario-fila-dato">
              ${icono.usuario(13)}@${escapeHtml(u.usuario || "sin usuario")}
            </span>
            <span class="usuario-fila-dato">
              ${icono.correo(13)}${escapeHtml(u.email)}
            </span>
          </span>
        </span>
        <span class="usuario-fila-rol">
          <span class="badge ${CLASE_ROL[u.rol] || "badge-gris"}">${
            ETIQUETA_ROL[u.rol] || escapeHtml(u.rol)
          }</span>
          ${!u.activo ? `<span class="badge badge-rojo">Inactivo</span>` : ""}
        </span>
        <span class="usuario-editar" aria-hidden="true">
          ${icono.lapiz(15)}
          <span>Editar</span>
        </span>
      </a>`).join("");
  }

  pintar();
}
