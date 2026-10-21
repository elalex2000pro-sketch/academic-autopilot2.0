@echo off
setlocal
title Academic Autopilot
cd /d "%~dp0.."

echo.
echo   ==========================================
echo    Academic Autopilot
echo   ==========================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo   [!] No encuentro Docker. Instala Docker Desktop y vuelve a intentarlo.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo   Iniciando Docker Desktop...
  start "" "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
  echo   Esperando a que Docker este listo ^(puede tardar 1-2 minutos^)...
  :wait
  ping -n 6 127.0.0.1 >nul
  docker info >nul 2>&1
  if errorlevel 1 goto wait
)

echo   Levantando los servicios...
docker compose up -d

echo   Abriendo la aplicacion en el navegador...
ping -n 4 127.0.0.1 >nul
start "" "http://localhost:8080"

echo.
echo   Listo. Puedes cerrar esta ventana.
ping -n 4 127.0.0.1 >nul
exit /b 0
