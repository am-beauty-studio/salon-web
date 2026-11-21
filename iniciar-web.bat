@echo off
title AM Luxury - Web local
cd /d "%~dp0"
echo ============================================
echo   AM Luxury Web  ^|  http://localhost:5500
echo ============================================
echo.
echo Abre http://localhost:5500http://localhost:5500 en tu navegador.
echo (Cierra esta ventana para detener el servidor)
echo.
start "" http://localhost:5500
python servidor.py
pause
