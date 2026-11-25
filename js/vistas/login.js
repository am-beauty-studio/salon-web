// Pantalla de login. Equivalente a src/app/login.tsx.
// Los datos de acceso se pueden recordar en el dispositivo si la usuaria lo pide.

import { entrar } from "../auth.js?v=52";
import {
  apiUrl, fijarApiUrl, API_URL_LOCAL, API_URL_RENDER,
} from "../config.js?v=50";
import { calentarServidor } from "../api.js?v=49";
import { $, aviso } from "../util.js?v=53";
import { icono } from "../iconos.js?v=64";

const CLAVE_GUARDAR = "salon_recordar_login";
const CLAVE_USUARIO = "salon_login_usuario";
const CLAVE_CORREO_ANTIGUO = "salon_login_correo";
const CLAVE_CLAVE = "salon_login_clave";
// Versión de los archivos cargados ("?v=51"), para comprobar de un vistazo
// que el navegador no está usando una copia antigua en caché.
const VERSION_WEB = new URL(import.meta.url).searchParams.get("v") || "";

// Permite detener el bucle de animación del logo al salir de la vista.
let detenerEfectos = null;

export async function render(raiz) {
  // Si ya había una animación en marcha (por ejemplo al cambiar de servidor),
  // se detiene antes de volver a pintar la pantalla.
  if (detenerEfectos) { detenerEfectos(); detenerEfectos = null; }

  // Despertamos el servidor mientras se escribe la clave (útil con Render dormido).
  calentarServidor();

  // Datos recordados en este dispositivo (si la usuaria lo pidió antes).
  let guardadoUsuario = "";
  let guardadoClave = "";
  let guardado = false;
  try {
    guardado = localStorage.getItem(CLAVE_GUARDAR) === "si";
    // Al principio se guardaba el correo: se reutiliza como usuario para que
    // quien ya lo tenía recordado no tenga que escribirlo otra vez.
    guardadoUsuario = localStorage.getItem(CLAVE_USUARIO)
      || localStorage.getItem(CLAVE_CORREO_ANTIGUO) || "";
    guardadoClave = localStorage.getItem(CLAVE_CLAVE) || "";
  } catch { /* almacenamiento no disponible */ }

  raiz.innerHTML = `
    <div class="login-wrap">
      <div class="login-luz" aria-hidden="true"></div>
      <canvas class="login-fx" id="login-fx" aria-hidden="true"></canvas>
      <div class="login-caja">
        <div class="am-marca" id="marca-am" role="img" aria-label="Ana Maryann Beauty Studio">
          <div class="am-halo" aria-hidden="true"></div>
          <div class="am-layer am-ring"><img src="img/login-anim/ring.png" alt="" aria-hidden="true" /><i class="am-glint am-ringlight"></i></div>
          <div class="am-layer am-am"><img src="img/login-anim/am.png" alt="" aria-hidden="true" /><i class="am-glint am-sweep"></i></div>
          <div class="am-layer am-script"><img src="img/login-anim/script.png" alt="" aria-hidden="true" /><i class="am-glint am-sweep"></i></div>
          <div class="am-layer am-sub"><img src="img/login-anim/sub.png" alt="" aria-hidden="true" /><i class="am-glint am-sweep"></i></div>
        </div>
        <div class="am-textos">
          <div class="am-titulo">AM Luxury</div>
          <div class="am-subtitulo">Beauty Studio</div>
        </div>
        <div class="login-divisor" aria-hidden="true"></div>
        <form id="form-login">
          <div class="login-campo">
            <label class="etiqueta" for="usuario">Usuario</label>
            <div class="campo-ico">
              ${icono.usuario()}
              <input class="input" id="usuario" type="text" autocomplete="username"
                     placeholder="tu usuario" autocapitalize="none" value="${guardadoUsuario.replace(/"/g, "&quot;")}" />
            </div>
          </div>
          <div class="login-campo">
            <label class="etiqueta" for="clave">Contraseña</label>
            <div class="campo-ico">
              ${icono.candado()}
              <input class="input" id="clave" type="password" autocomplete="current-password"
                     placeholder="••••••••" value="${guardadoClave.replace(/"/g, "&quot;")}" />
              <button class="btn-ojo" id="btn-ojo" type="button" title="Mostrar u ocultar la contraseña">${icono.ojo()}</button>
            </div>
          </div>
          <label class="swicha" id="fila-recordar">
            <input type="checkbox" id="recordar" ${guardado ? "checked" : ""} />
            <span>Recordar mi usuario y contraseña en este dispositivo</span>
          </label>
          <p class="error-txt oculto" id="error-login"></p>
          <button class="btn btn-dorado btn-bloque" id="btn-entrar" type="submit">Entrar</button>
        </form>
        <div class="login-api">
          Servidor: <a href="#" id="cambiar-api" title="Cambiar servidor">${apiUrl().replace(/^https?:\/\//, "")}</a>${VERSION_WEB ? `<span class="login-version"> · web v${VERSION_WEB}</span>` : ""}
        </div>
      </div>
    </div>`;

  // Logo animado: aro que se dibuja, firma que se escribe, destellos y
  // partículas de corazón que siguen al cursor. Se detiene solo al salir.
  detenerEfectos = animarMarcaLogin();

  // El ojo muestra u oculta lo que se escribe en la contraseña.
  $("#btn-ojo").onclick = () => {
    const clave = $("#clave");
    const ver = clave.type === "password";
    clave.type = ver ? "text" : "password";
    $("#btn-ojo").innerHTML = ver ? icono.ojoTachado() : icono.ojo();
  };

  $("#cambiar-api").onclick = (e) => {
    e.preventDefault();
    const actual = apiUrl();
    const nueva = prompt(
      "Dirección del servidor API.\n\n" +
      `Local (uvicorn):\n${API_URL_LOCAL}\n\n` +
      `Render (la de la app Android):\n${API_URL_RENDER}`,
      actual
    );
    if (nueva === null) return;
    const limpia = nueva.trim().replace(/\/+$/, "");
    if (limpia && limpia !== actual) {
      fijarApiUrl(limpia);
      aviso("Servidor actualizado: " + limpia, "ok");
      render(raiz);
    }
  };

  $("#form-login").onsubmit = async (e) => {
    e.preventDefault();
    const usuario = $("#usuario").value.trim();
    const clave = $("#clave").value;
    const error = $("#error-login");
    const boton = $("#btn-entrar");

    if (!usuario || !clave) {
      error.textContent = "Escribe tu usuario y contraseña.";
      error.classList.remove("oculto");
      return;
    }

    // Guarda (o borra) las credenciales según la casilla "Recordar".
    try {
      localStorage.removeItem(CLAVE_CORREO_ANTIGUO);
      if ($("#recordar").checked) {
        localStorage.setItem(CLAVE_GUARDAR, "si");
        localStorage.setItem(CLAVE_USUARIO, usuario);
        localStorage.setItem(CLAVE_CLAVE, clave);
      } else {
        localStorage.removeItem(CLAVE_GUARDAR);
        localStorage.removeItem(CLAVE_USUARIO);
        localStorage.removeItem(CLAVE_CLAVE);
      }
    } catch { /* almacenamiento no disponible */ }

    error.classList.add("oculto");
    boton.disabled = true;
    boton.textContent = "Entrando…";
    try {
      await entrar(usuario, clave);
      location.hash = "#/agenda";
    } catch (err) {
      error.textContent = err.message || "Usuario o contraseña incorrectos";
      error.classList.remove("oculto");
      boton.disabled = false;
      boton.textContent = "Entrar";
    }
  };
}

// Efectos del logo del login. Devuelve una función para detener el bucle y
// quitar los escuchas cuando se navega a otra vista.
function animarMarcaLogin() {
  const marca = document.getElementById("marca-am");
  const lienzo = document.getElementById("login-fx");
  const raiz = document.documentElement;
  if (!marca || !lienzo) return () => {};

  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducir) {
    raiz.style.setProperty("--login-px", "0");
    raiz.style.setProperty("--login-py", "0");
    return () => {};
  }

  const ctx = lienzo.getContext("2d");
  if (!ctx) return () => {};

  const anillo = marca.querySelector(".am-ring");
  const COLORES = ["229,123,150", "152,50,90", "255,150,185", "240,95,140"];
  const CORAZON = Array.from({ length: 28 }, (_, i) => {
    const t = i / 28 * 6.2832;
    return [
      Math.pow(Math.sin(t), 3),
      -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16,
    ];
  });

  let ancho = 0;
  let alto = 0;
  let particulas = [];
  let vivo = true;
  let raf = 0;
  let estallido = false;
  const inicio = performance.now();
  const raton = { x: -999, y: -999 };
  const objetivo = { x: innerWidth / 2, y: innerHeight * .42 };
  const cursor = { ...objetivo };
  const suavizar = (p) => (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const color = () => COLORES[Math.random() * 4 | 0];

  // El aro empieza vacío y el JS lo va dibujando en el primer segundo.
  anillo?.style.setProperty("--a", "0deg");

  function redimensionar() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    ancho = lienzo.clientWidth;
    alto = lienzo.clientHeight;
    lienzo.width = ancho * dpr;
    lienzo.height = alto * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Caja del logo relativa al lienzo (que ocupa toda la ventana).
  function caja() {
    const r = marca.getBoundingClientRect();
    const c = lienzo.getBoundingClientRect();
    return {
      x: r.left - c.left,
      y: r.top - c.top,
      w: r.width,
      cx: r.left - c.left + r.width / 2,
      cy: r.top - c.top + r.height / 2,
      R: r.width / 2,
    };
  }

  const agregar = (p) => particulas.push(Object.assign({ vida: 0, vx: 0, vy: 0, fase: Math.random() * 6.28 }, p));

  function ambiente() {
    const b = caja();
    const a = Math.random() * 6.283;
    if (Math.random() < .35) {
      // Destello sobre el aro.
      agregar({ t: "d", x: b.cx + Math.cos(a) * b.R, y: b.cy + Math.sin(a) * b.R,
        s: 2 + Math.random() * 3, max: 60 + Math.random() * 40, col: color() });
    } else {
      // Brillo que sube alrededor del logo.
      const R = b.R * (1.05 + Math.random() * .45);
      agregar({ t: "f", x: b.cx + Math.cos(a) * R, y: b.cy + Math.sin(a) * R * .9,
        vx: (Math.random() - .5) * .3, vy: -(.25 + Math.random() * .5),
        s: 1.5 + Math.random() * 2.5, max: 150 + Math.random() * 120, col: color(),
        fase: Math.random() * 6.28 });
    }
  }

  function corazon(x, y, s, giro) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(giro);
    ctx.scale(s, s);
    ctx.beginPath();
    CORAZON.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function cuadro(ahora) {
    if (!vivo) return;
    // Si la vista ya no está en el documento, se detiene y limpia sola.
    if (!document.contains(marca)) { detener(); return; }

    const t = (ahora - inicio) / 1000;
    const b = caja();

    // Aro: se dibuja girando, con chispa en la punta.
    if (t < 2.0) {
      const p = suavizar(Math.min(t / 1.9, 1));
      const ang = p * 366;
      anillo?.style.setProperty("--a", ang + "deg");
      const th = ang * Math.PI / 180;
      for (let i = 0; i < 2; i++) {
        agregar({ t: "s", x: b.cx + Math.sin(th) * b.R * .995,
          y: b.cy - Math.cos(th) * b.R * .995,
          vx: (Math.random() - .5) * .8, vy: (Math.random() - .5) * .8,
          s: 1 + Math.random() * 2.2, max: 22 + Math.random() * 14, col: color() });
      }
    } else if (t < 2.1) {
      anillo?.style.setProperty("--a", "366deg");
    }

    // Chispas siguiendo el frente de la firma mientras se escribe.
    if (t > 1.8 && t < 3.7) {
      const f = suavizar((t - 1.8) / 1.9) * 1.14 - .07;
      if (f > 0 && f < 1 && Math.random() < .6) {
        agregar({ t: "s", x: b.x + f * b.w, y: b.y + b.w * (.40 + Math.random() * .24),
          vx: (Math.random() - .5) * .6, vy: -Math.random() * .6,
          s: 1.5 + Math.random() * 2.5, max: 28 + Math.random() * 16, col: color() });
      }
    }

    // Estallido de luz cuando aparece "Beauty Studio".
    if (!estallido && t > 4.0) {
      estallido = true;
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * 6.283;
        const d = b.R * (.3 + Math.random() * .7);
        agregar({ t: "d", x: b.cx + Math.cos(a) * d, y: b.cy + Math.sin(a) * d,
          s: 2 + Math.random() * 3.5, max: 50 + Math.random() * 30, col: color() });
      }
    }

    // Ambiente: pocas partículas para no recargar.
    const maxAmb = ancho < 600 ? 7 : 12;
    if (t > 2.4 && particulas.filter((p) => p.t === "f" || p.t === "d").length < maxAmb && Math.random() < .06) {
      ambiente();
    }

    ctx.clearRect(0, 0, ancho, alto);
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida++;
      const k = p.vida / p.max;
      if (k >= 1) { particulas.splice(i, 1); continue; }
      const al = Math.sin(k * Math.PI);
      p.x += p.vx;
      p.y += p.vy;
      if (p.t === "f") {
        p.x += Math.sin(p.vida * .03 + p.fase) * .3;
        const dx = p.x - raton.x;
        const dy = p.y - raton.y;
        const d = Math.hypot(dx, dy);
        if (d < 90 && d > 0) { p.x += dx / d * (90 - d) * .06; p.y += dy / d * (90 - d) * .06; }
      }
      ctx.fillStyle = `rgba(${p.col},${al * .9})`;
      ctx.shadowColor = `rgba(${p.col},${al})`;
      ctx.shadowBlur = 8;
      corazon(p.x, p.y, p.s * (p.t === "s" ? 1.6 : 2.2) * (.55 + al * .45),
        Math.sin(p.vida * .05 + p.fase) * .4);
    }
    ctx.shadowBlur = 0;

    // Luz y paralaje suaves hacia el cursor.
    cursor.x += (objetivo.x - cursor.x) * .06;
    cursor.y += (objetivo.y - cursor.y) * .06;
    raiz.style.setProperty("--login-mx", cursor.x + "px");
    raiz.style.setProperty("--login-my", cursor.y + "px");
    raiz.style.setProperty("--login-px", ((cursor.x / innerWidth) - .5) * 2);
    raiz.style.setProperty("--login-py", ((cursor.y / innerHeight) - .5) * 2);

    raf = requestAnimationFrame(cuadro);
  }

  function moverRaton(e) {
    objetivo.x = e.clientX;
    objetivo.y = e.clientY;
    const r = lienzo.getBoundingClientRect();
    raton.x = e.clientX - r.left;
    raton.y = e.clientY - r.top;
  }

  function detener() {
    vivo = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", moverRaton);
    window.removeEventListener("resize", redimensionar);
  }

  window.addEventListener("pointermove", moverRaton);
  window.addEventListener("resize", redimensionar);
  redimensionar();
  raf = requestAnimationFrame(cuadro);

  return detener;
}
