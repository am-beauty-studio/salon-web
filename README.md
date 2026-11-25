# AM Luxury · Web (salon_web)

Versión web (navegador) del sistema del salón, con la misma información y
funcionalidad de `salon_app` (app Android), conectada a `salon_api`.

## Pantallas

| Ruta | Descripción | Rol |
|---|---|---|
| `#/login` | Entrar con usuario y contraseña | Todos |
| `#/agenda` | Agenda diaria con filtro por especialista, resumen y acciones | Todos |
| `#/notificaciones` | Alertas de stock mínimo y avisos de citas (nuevas, reprogramadas, canceladas y archivadas), con preferencias por usuaria | Todos |
| `#/cita/nueva` | Nueva cita (clienta → servicio → adicionales → especialista → día/hora) | Todos |
| `#/cita/{id}` | Detalle de cita: editar servicio/adicionales, reprogramar, completar, cancelar | Todos |
| `#/clientes` | Listado y búsqueda de clientas | Todos |
| `#/clientes/nueva` | Nueva clienta | Todos |
| `#/clientes/{id}` | Ficha de clienta + historial de citas | Todos |
| `#/servicios` · `#/servicios/nuevo` · `#/servicios/{id}` | Catálogo de servicios | Solo admin |
| `#/productos` · `#/productos/nuevo` · `#/productos/{id}` | Inventario, consumo y stock mínimo | Solo admin |
| `#/empleadas` · `#/empleadas/nueva` · `#/empleadas/{id}` | Empleadas, servicios que realizan y horario semanal | Solo admin |
| `#/ganancias` | Ganancias por día/semana/mes con reparto | Solo admin |

## Cómo arrancar (desarrollo local)

### 1. Arrancar la API (`salon_api`)

```bash
cd salon_api
# la primera vez: crear venv e instalar dependencias
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload
```

La API queda en **http://127.0.0.1:8000** (docs en `/docs`).
La API ya tiene CORS habilitado para la web (orígenes localhost configurados en
`app/core/config.py`, ajustable con la variable `CORS_ORIGINS` en `.env`).

### 2. Arrancar la web (`salon_web`)

Doble clic en `iniciar-web.bat`, o manualmente:

```bash
cd salon_web
python -m http.server 5500
```

Abrir **http://localhost:5500** en el navegador.

### Con la app Android al mismo tiempo

La app Android usa la API desplegada en Render
(`https://salon-api-u08l.onrender.com`). **La web también usa Render por
defecto**, aunque se abra desde este PC, así que no hace falta tener la API
local encendida para trabajar.

Para cambiar el servidor de la web: en la pantalla de login, toca el enlace
**"Servidor: …"**. Ahí puedes apuntar la web a la API local (`http://127.0.0.1:8000`)
o volver a la de Render. La elección se guarda en el navegador (`localStorage`)
y tiene prioridad sobre el valor por defecto.

En el login, junto al servidor, aparece la versión de la web (p. ej. `web v52`).
Si no coincide con la última, recarga con **Ctrl+F5**.

> Nota: la primera petición a Render puede tardar si el servidor estaba dormido.
> El cliente reintenta solo las lecturas (GET); si el login falla, espera unos
> segundos y vuelve a intentarlo.

## Estructura

```
salon_web/
├── index.html
├── css/estilos.css          Tema lino rosado + rosa pastel (igual que la app)
├── img/logo.png             Logo de la app
├── iniciar-web.bat          Servidor estático en el puerto 5500
└── js/
    ├── config.js            URL de la API (local o Render)
    ├── api.js               Cliente HTTP con Bearer + reintentos (502/503)
    ├── auth.js              Sesión: login, /auth/me, cierre por 401
    ├── util.js              Fechas en español, dinero, reglas, avisos y modales
    ├── menu-inferior.js     Dock/barra inferior: nueva cita, archivar,
    │                        notificaciones y cuenta de usuario
    ├── app.js               Enrutador por hash + cabecera con chips por rol
    └── vistas/              Una vista por pantalla (login, agenda, citas,
                             clientas, servicios, empleadas, ganancias,
                             notificaciones)
```

## Detalles replicados de la app

- Login OAuth2 (`POST /auth/login` con `application/x-www-form-urlencoded`).
- Agenda: navegador de fecha, filtro por especialista, resumen del día,
  completar/cancelar con confirmación.
- Nueva cita en 5 pasos con las mismas reglas: adicionales solo si comparten
  categoría con el servicio principal, especialistas aptas según sus servicios,
  slots de 15 min de `GET /empleados/{id}/disponibilidad`.
- Detalle de cita: cambio de servicio, subtipo y adicionales con recálculo de
  precio/duración; mantiene la hora actual y permite reprogramar excluyendo la
  propia cita.
- Notificaciones: avisos compartidos de citas y alertas de stock; cada usuaria
  elige en Ajustes qué tipos quiere ver y la campana respeta su elección.
- Clientas: búsqueda con debounce, ficha con historial.
- Servicios y empleadas: CRUD completo, editor de horario semanal con
  validaciones (formato 24 h, fin > inicio, sin cruces), zonas de peligro con
  "desactivar" cuando la API responde 409.
- Ganancias: reparto trabajadoras / reinversión / libre, pendientes y
  desgloses por trabajadora, categoría y día.
- Rol `recepcion`: ve Agenda y Clientas; Servicios, Empleadas y Ganancias
  quedan bloqueadas.
- Sesión: token en localStorage; si la API responde 401 se cierra sesión y
  manda al login.
