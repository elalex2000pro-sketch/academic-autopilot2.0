@echo off
setlocal EnableDelayedExpansion
title Academic Autopilot
cd /d "%~dp0"

echo.
echo   ==========================================
echo    Academic Autopilot
echo   ==========================================
echo.

REM --- Docker presente? ---
where docker >nul 2>&1
if errorlevel 1 (
  echo   [!] No encuentro Docker.
  echo       Ejecuta primero "1 - Instalar programas.cmd".
  pause
  exit /b 1
)

REM --- Motor de Docker en marcha? ---
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

REM --- Primera vez: construir. Despues: rapido. ---
docker compose images -q 2>nul | findstr . >nul
if errorlevel 1 (
  echo   Primera ejecucion: construyendo la aplicacion ^(tarda unos minutos^)...
  docker compose up -d --build
) else (
  echo   Levantando los servicios...
  docker compose up -d
)

echo.
echo   Esperando a que el servidor este listo...
ping -n 10 127.0.0.1 >nul

REM --- Cargar el horario del ciclo (solo si el usuario no tiene clases) ---
echo   Cargando tu horario si es necesario...
set /a tries=0
:seed
docker compose exec -T -e PYTHONPATH=/app backend python seed_horario.py
if errorlevel 1 (
  set /a tries+=1
  if !tries! lss 20 (
    ping -n 6 127.0.0.1 >nul
    goto seed
  )
)

echo.
echo   Abriendo en el navegador: http://localhost:8080
start "" "http://localhost:8080"

echo.
echo   Listo. Puedes cerrar esta ventana.
echo   ^(Para apagar: "3 - Detener.cmd"^)
ping -n 4 127.0.0.1 >nul
exit /b 0
