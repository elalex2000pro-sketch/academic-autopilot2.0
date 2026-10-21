@echo off
setlocal EnableDelayedExpansion
title Academic Autopilot - Instalacion de programas
cd /d "%~dp0"

echo.
echo   ==========================================================
echo    ACADEMIC AUTOPILOT - PASO 1: INSTALAR PROGRAMAS
echo   ==========================================================
echo.
echo   Este asistente instalara automaticamente lo necesario:
echo.
echo     1. Docker Desktop   (OBLIGATORIO - ejecuta la aplicacion)
echo     2. Ollama           (OPCIONAL  - IA local, sin coste)
echo.
echo   Usa "winget" (viene con Windows 10/11). Si te pide
echo   permisos o aceptar terminos, pulsa "S" o "Si".
echo.
pause

REM --- Comprobar winget ---
where winget >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [!] No encuentro "winget" en este Windows.
  echo       Instala "App Installer" desde la Microsoft Store,
  echo       o instala los programas a mano siguiendo el MANUAL.
  echo.
  pause
  exit /b 1
)

REM --- Docker Desktop (obligatorio) ---
echo.
echo   --- Instalando Docker Desktop (obligatorio) ---
where docker >nul 2>&1
if errorlevel 1 (
  winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
) else (
  echo   Docker ya esta instalado. Se omite.
)

REM --- Ollama (opcional, IA local) ---
echo.
echo   --- Instalando Ollama (opcional, IA local) ---
where ollama >nul 2>&1
if errorlevel 1 (
  winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements
) else (
  echo   Ollama ya esta instalado. Se omite.
)

echo.
echo   ==========================================================
echo    INSTALACION TERMINADA
echo   ==========================================================
echo.
echo   MUY IMPORTANTE:
echo     - Reinicia el ordenador o cierra la sesion y vuelve a
echo       entrar para que Docker funcione.
echo     - La primera vez, abre "Docker Desktop" y acepta las
echo       condiciones para que arranque el motor.
echo     - Despues, ejecuta "2 - Iniciar Academic Autopilot.cmd".
echo.
pause
exit /b 0
