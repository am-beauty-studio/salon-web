// Panel de notificaciones: alertas de stock (calculadas por la API) y avisos
// persistentes de citas nuevas, reprogramadas y canceladas.

import { get, patch, del } from "../api.js?v=49";
import { esAdmin } from "../auth.js?v=52";
import { icono } from "../iconos.js?v=64";
import { confirmarPeligro } from "../modal-confirmar.js?v=1";
import { refrescarBadgeNotificaciones } from "../menu-inferior.js?v=57";
import { $, aviso, escapeHtml } from "../util.js?v=53";

const ICONO_TIPO = {
  cita_nueva: icono.calendario(18),
  cita_cambio: icono.repetir(18),
  cita_cancelacion: icono.equis(18),
  cita_archivada: icono.archivo(18),
  cita_adicional: icono.mas(18),
  cita_pendiente: icono.reloj(18),
};

// Tipos que cada usuaria puede activar o desactivar en su cuenta.
const AJUSTES = [
  {
    clave: "stock_bajo",
    titulo: "Stock bajo o agotado",
    detalle: "Productos en su mínimo, para reponer a tiempo.",
    soloAdmin: true,
  },
  {
    clave: "cita_nueva",
    titulo: "Citas nuevas",
    detalle: "Cuando se agenda una cita o una reserva.",
  },
  {
    clave: "cita_cambio",
    titulo: "Citas reprogramadas",
    detalle: "Cuando cambia el día, la hora o la especialista.",
  },
  {
    clave: "cita_cancelacion",
    titulo: "Citas canceladas",
    detalle: "Cuando se cancela una cita o una reserva.",
  },
  {
    clave: "cita_archivada",
    titulo: "Citas archivadas",
    detalle: "Cuando se registra una cita de un día pasado.",
  },
  {
    clave: "cita_pendiente",
    titulo: "Citas sin completar",
    detalle: "Recordatorio de citas de días pasados que siguen programadas.",
    soloAdmin: true,
  },
  {
    clave: "cita_adicional",
    titulo: "Servicios adicionales",
    detalle: "Cuando se suman extras a una cita ya agendada.",
  },
];

// El panel se vuelve a pintar tras cada cambio; recordamos si los ajustes
// estaban abiertos para no cerrarlos.
const estado = { ajustes: false };


function num(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "0";
  return String(Number(n.toFixed(3)));
}

function plural(unidad, cantidad) {
  const u = (unidad || "unidad").trim();
  if (Number(cantidad) === 1) return u;
  return /[aeiouáéíóú]$/i.test(u) ? `${u}s` : `${u}es`;
}

function fechaHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dos = (n) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

function filaStock(p) {
  return `
    <a class="notif-fila notif-stock ${p.agotado ? "agotado" : ""}" href="#/productos/${p.producto_id}">
      <span class="notif-cabecera">
        <span class="notif-ico">${icono.caja(18)}</span>
        <span class="notif-cab">
          <strong>${escapeHtml(p.nombre)}</strong>
          <span class="badge ${p.agotado ? "badge-rojo" : "badge-aviso"}">
            ${p.agotado ? "Agotado" : "Stock bajo"}
          </span>
        </span>
        <span class="notif-flecha" aria-hidden="true">›</span>
      </span>
      <span class="notif-divisor" aria-hidden="true"></span>
      <span class="notif-mensaje">
        Quedan ${num(p.cantidad)} ${escapeHtml(plural(p.unidad, p.cantidad))}
        (mínimo ${num(p.stock_minimo)}). Repón el stock.
      </span>
      <span class="notif-meta-fila">
        <span class="notif-meta">${escapeHtml(p.categoria)}</span>
      </span>
    </a>`;
}

function filaCita(n, puedeBorrar) {
  const cuerpo = `
      <span class="notif-cabecera">
        <span class="notif-ico">${ICONO_TIPO[n.tipo] || icono.campana(18)}</span>
        <span class="notif-cab">
          <strong>${escapeHtml(n.titulo)}</strong>
          ${n.leida ? "" : `<span class="notif-punto" title="Sin leer"></span>`}
        </span>
      </span>
      <span class="notif-divisor" aria-hidden="true"></span>
      <span class="notif-mensaje">${escapeHtml(n.mensaje)}</span>
      <span class="notif-meta-fila">
        <span class="notif-meta">${icono.reloj(12)} ${fechaHora(n.creada_en)}</span>
        ${n.actor_nombre ? `<span class="notif-actor">${icono.usuario(12)} Generado por ${escapeHtml(n.actor_nombre)}</span>` : ""}
      </span>`;

  // Solo las pendientes ofrecen marcarlas como leídas; admin puede borrar.
  const marcar = n.leida ? "" : `
      <button class="notif-marcar" type="button" data-marcar="${n.id}"
              title="Marcar como leída" aria-label="Marcar como leída">
        ${icono.check(15)}
      </button>`;
  const borrar = puedeBorrar ? `
      <button class="notif-borrar" type="button" data-borrar="${n.id}"
              title="Eliminar aviso" aria-label="Eliminar aviso">
        ${icono.papelera(15)}
      </button>` : "";

  return `
    <div class="notif-fila notif-cita ${n.leida ? "leida" : "sin-leer"} con-accion">
      <button class="notif-abrir" type="button"
              data-notif="${n.id}" data-cita="${n.cita_id ?? ""}">
        ${cuerpo}
      </button>${marcar}${borrar}
    </div>`;
}

function filaAjuste(ajuste, prefs) {
  return `
    <label class="notif-ajuste">
      <span class="notif-ajuste-txt">
        <strong>${escapeHtml(ajuste.titulo)}</strong>
        <small>${escapeHtml(ajuste.detalle)}</small>
      </span>
      <span class="notif-toggle">
        <input type="checkbox" data-pref="${ajuste.clave}" ${prefs[ajuste.clave] ? "checked" : ""} />
        <span class="notif-toggle-pista" aria-hidden="true"></span>
      </span>
    </label>`;
}

export async function render(raiz) {
  estado.ajustes = false;
  await pintar(raiz);
}

async function pintar(raiz) {
  const datos = await get("/notificaciones");
  const stock = datos.stock || [];
  const notificaciones = datos.notificaciones || [];
  const prefs = datos.preferencias || {};
  const sinLeer = notificaciones.filter((n) => !n.leida).length;
  const leidas = notificaciones.length - sinLeer;
  const ocultas = datos.ocultas || 0;

  const resumen = [
    stock.length ? `${stock.length} alerta${stock.length === 1 ? "" : "s"} de stock` : "",
    `${notificaciones.length} aviso${notificaciones.length === 1 ? "" : "s"} de citas`,
  ].filter(Boolean).join(" · ");

  const sinNada = !stock.length && !notificaciones.length;
  const ajustesVisibles = AJUSTES.filter((a) => !a.soloAdmin || esAdmin());
  // Borrar avisos es exclusivo de las administradoras.
  const puedeBorrar = esAdmin();

  const vacio = ocultas
    ? `
      <div class="notif-vacio">
        <span class="notif-circulo">${icono.campana(30)}</span>
        <p>No hay avisos con tus preferencias.</p>
        <small>
          Tienes ${ocultas} aviso${ocultas === 1 ? "" : "s"} sin leer
          oculto${ocultas === 1 ? "" : "s"}. Actívalos en Ajustes para verlos.
        </small>
        <button class="chip-enlace" type="button" data-abrir-ajustes>Abrir ajustes</button>
      </div>`
    : `
      <div class="notif-vacio">
        <span class="notif-circulo">${icono.campana(30)}</span>
        <p>No hay notificaciones por ahora.</p>
        <small>Aquí verás las alertas de stock y los avisos de citas nuevas, cambios, cancelaciones y archivadas.</small>
      </div>`;

  raiz.innerHTML = `
    <div class="vista-cab">
      <span class="vista-ico">${icono.campana(22)}</span>
      <h1 class="vista-titulo">Notificaciones</h1>
      <button class="chip-enlace notif-leer" id="btn-ajustes" type="button"
              aria-expanded="${estado.ajustes ? "true" : "false"}">
        ${icono.ajustes(14)} Ajustes
      </button>
      ${sinLeer ? `<button class="chip-enlace notif-leer" id="notif-leer" type="button">Marcar leídas</button>` : ""}
      ${leidas && puedeBorrar ? `<button class="chip-enlace notif-leer" id="notif-borrar" type="button">${icono.papelera(14)} Borrar leídas</button>` : ""}
    </div>

    ${estado.ajustes ? `
      <div class="notif-ajustes" id="notif-ajustes">
        <div class="notif-ajustes-cab">
          <strong>¿Qué avisos quieres recibir?</strong>
          <small>Se guardan en tu cuenta; las demás usuarias eligen los suyos.</small>
        </div>
        ${ajustesVisibles.map((a) => filaAjuste(a, prefs)).join("")}
      </div>` : ""}

    ${sinNada ? vacio : `
      <p class="notif-resumen">${escapeHtml(resumen)}</p>
      ${ocultas ? `
        <p class="notif-ocultas">
          ${ocultas} aviso${ocultas === 1 ? "" : "s"} sin leer
          oculto${ocultas === 1 ? "" : "s"} por tus preferencias.
        </p>` : ""}

      ${stock.length ? `
        <p class="seccion-titulo">Stock bajo</p>
        <div class="notif-lista">${stock.map(filaStock).join("")}</div>` : ""}

      ${notificaciones.length ? `
        <p class="seccion-titulo">Citas</p>
        <div class="notif-lista">${notificaciones.map((n) => filaCita(n, puedeBorrar)).join("")}</div>` : ""}
    `}`;

  const btnAjustes = $("#btn-ajustes");
  if (btnAjustes) {
    btnAjustes.onclick = () => {
      estado.ajustes = !estado.ajustes;
      pintar(raiz);
    };
  }

  raiz.querySelectorAll("[data-abrir-ajustes]").forEach((b) => {
    b.onclick = () => {
      estado.ajustes = true;
      pintar(raiz);
    };
  });

  raiz.querySelectorAll("[data-pref]").forEach((input) => {
    input.onchange = async () => {
      const clave = input.dataset.pref;
      input.disabled = true;
      try {
        await patch("/notificaciones/preferencias", { [clave]: input.checked });
        refrescarBadgeNotificaciones();
        await pintar(raiz);
      } catch (e) {
        input.checked = !input.checked;
        input.disabled = false;
        aviso(e.message || "No se pudo guardar la preferencia.", "error");
      }
    };
  });

  const marcarTodas = $("#notif-leer");
  if (marcarTodas) {
    marcarTodas.onclick = async () => {
      marcarTodas.disabled = true;
      try {
        await patch("/notificaciones/leer", {});
      } catch (e) {
        marcarTodas.disabled = false;
        return;
      }
      refrescarBadgeNotificaciones();
      await pintar(raiz);
    };
  }

  const borrarLeidas = $("#notif-borrar");
  if (borrarLeidas) {
    borrarLeidas.onclick = async () => {
      const texto = `${leidas} notificación${leidas === 1 ? "" : "es"} leída${leidas === 1 ? "" : "s"}`;
      const ok = await confirmarPeligro({
        titulo: "Borrar notificaciones leídas",
        mensaje: "Se quitarán del panel los avisos que ya leíste. Los pendientes se conservan.",
        filas: [{ icono: icono.papelera(15), texto }],
        accion: "Borrar leídas",
      });
      if (!ok) return;
      borrarLeidas.disabled = true;
      try {
        await del("/notificaciones/leidas");
      } catch (e) {
        borrarLeidas.disabled = false;
        aviso(e.message || "No se pudieron eliminar las notificaciones.", "error");
        return;
      }
      refrescarBadgeNotificaciones();
      await pintar(raiz);
    };
  }

  if (puedeBorrar) raiz.querySelectorAll("[data-borrar]").forEach((btn) => {
    btn.onclick = async () => {
      const notif = notificaciones.find((n) => String(n.id) === btn.dataset.borrar);
      const ok = await confirmarPeligro({
        titulo: "Eliminar aviso",
        mensaje: "Este aviso ya está leído y se quitará del panel.",
        filas: [
          {
            icono: ICONO_TIPO[notif?.tipo] || icono.campana(15),
            texto: notif?.titulo || "Aviso leído",
          },
          { icono: icono.reloj(15), texto: notif ? fechaHora(notif.creada_en) : "" },
        ],
        accion: "Eliminar",
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        await del(`/notificaciones/${btn.dataset.borrar}`);
      } catch (e) {
        btn.disabled = false;
        aviso(e.message || "No se pudo eliminar la notificación.", "error");
        return;
      }
      refrescarBadgeNotificaciones();
      await pintar(raiz);
    };
  });

  raiz.querySelectorAll("[data-marcar]").forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await patch(`/notificaciones/${btn.dataset.marcar}/leer`, {});
      } catch (e) {
        btn.disabled = false;
        aviso(e.message || "No se pudo marcar la notificación como leída.", "error");
        return;
      }
      refrescarBadgeNotificaciones();
      await pintar(raiz);
    };
  });

  raiz.querySelectorAll("[data-notif]").forEach((fila) => {
    fila.onclick = async () => {
      const id = fila.dataset.notif;
      const citaId = fila.dataset.cita;
      const notif = notificaciones.find((n) => String(n.id) === id);
      fila.disabled = true;
      if (notif && !notif.leida) {
        try {
          await patch(`/notificaciones/${id}/leer`, {});
        } catch { /* si falla, igual se abre la cita */ }
      }
      if (citaId) {
        location.hash = `#/cita/${citaId}`;
      } else {
        await pintar(raiz);
      }
    };
  });
}
