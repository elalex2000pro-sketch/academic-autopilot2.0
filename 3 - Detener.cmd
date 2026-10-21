@echo off
setlocal
title Detener Academic Autopilot
cd /d "%~dp0"

echo.
echo   Deteniendo Academic Autopilot...
docker compose down
echo.
echo   Listo. La aplicacion se ha detenido.
echo   Tus datos se conservan (no se borra nada).
ping -n 4 127.0.0.1 >nul
exit /b 0
