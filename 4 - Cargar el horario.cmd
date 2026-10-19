@echo off
setlocal
title Cargar horario - Academic Autopilot
cd /d "%~dp0"

echo.
echo   Cargando el horario del ciclo en tu cuenta...
echo   ^(Necesitas haber creado tu cuenta y tener la app arrancada^)
echo.

docker compose exec -T -e PYTHONPATH=/app backend python seed_horario.py
if errorlevel 1 (
  echo.
  echo   [!] No se pudo cargar. Asegurate de que la app esta arrancada
  echo       ^(ejecuta "2 - Iniciar Academic Autopilot.cmd" primero^).
)

echo.
pause
exit /b 0
