"""Servidor web local para salon_web (puerto 5500).

Además de servir los archivos estáticos, cualquier ruta que no corresponda a
un archivo (p. ej. /clientes, /agenda, /cita/5) devuelve index.html, de modo
que la app web siempre carga con su cabecera fija y sus menús, sin importar
el enlace que se abra.

Uso:  python servidor.py        (equivale a iniciar-web.bat)
"""
import http.server
import os
import sys

CARPETA = os.path.dirname(os.path.abspath(__file__))
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 5500


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=CARPETA, **kwargs)

    def send_head(self):
        # Rutas internas de la app (hash-less) -> index.html (SPA fallback)
        ruta = self.translate_path(self.path)
        es_estatico = self.path.startswith(("/css", "/js", "/img"))
        if not es_estatico and not os.path.exists(ruta):
            self.path = "/index.html"
        return super().send_head()

    def end_headers(self):
        # Nada de caché durante el desarrollo: el navegador siempre pide los
        # archivos actuales (así no se queda con una versión antigua del JS).
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, formato, *args):
        sys.stdout.write("  %s - %s\n" % (self.address_string(), formato % args))


if __name__ == "__main__":
    servidor = http.server.ThreadingHTTPServer(("0.0.0.0", PUERTO), Manejador)
    print(f"AM Luxury web en http://localhost:{PUERTO}  (Ctrl+C para detener)")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
