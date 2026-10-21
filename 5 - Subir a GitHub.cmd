@echo off
chcp 65001 >nul
title Subir Academic Autopilot a GitHub
cd /d "%~dp0"

set "GIT=git"
where git >nul 2>nul
if errorlevel 1 set "GIT=%USERPROFILE%\PortableGit\cmd\git.exe"
if /i not "%GIT%"=="git" if not exist "%GIT%" (
  echo.
  echo [ERROR] No encuentro Git en este equipo.
  echo Instala Git o deja la carpeta PortableGit en %USERPROFILE%\PortableGit
  echo.
  pause
  exit /b 1
)

"%GIT%" rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo Preparando el repositorio...
  "%GIT%" init -b main >nul
  "%GIT%" config user.name "elalex2000pro-sketch"
  "%GIT%" config user.email "elalex2000pro-sketch@users.noreply.github.com"
  "%GIT%" config credential.helper manager
  "%GIT%" add --all
  "%GIT%" commit -q -m "Academic Autopilot"
)

echo.
echo ============================================================
echo  Antes de continuar, crea el repositorio en GitHub:
echo   1. Entra en https://github.com/new
echo   2. Ponle un nombre (por ejemplo academic-autopilot)
echo   3. NO marques "Add a README file" ni licencia ni .gitignore
echo   4. Pulsa "Create repository"
echo   5. Copia la URL que termina en .git
echo ============================================================
echo.
set "REPO="
set /p "REPO=Pega la URL del repositorio (o pulsa Enter para salir): "
if "%REPO%"=="" (
  echo.
  echo Cancelado. No se ha cambiado nada.
  pause
  exit /b 0
)

"%GIT%" remote remove origin >nul 2>nul
"%GIT%" remote add origin "%REPO%"
"%GIT%" branch -M main
echo.
echo Subiendo... Si es la primera vez, se abrira el navegador
echo para que inicies sesion en GitHub y autorices el acceso.
echo.
"%GIT%" push -u origin main
if errorlevel 1 (
  echo.
  echo [AVISO] No se pudo subir.
  echo  - Si el repositorio ya tenia archivos (README, licencia...),
  echo    vuelve a crearlo vacio o ejecuta a mano:
  echo      "%GIT%" push -f -u origin main
  echo  - Si fallo el inicio de sesion, repite y completa el navegador.
  echo.
  pause
  exit /b 1
)

echo.
echo Listo. Tu proyecto ya esta en GitHub:
echo   %REPO%
echo.
pause
