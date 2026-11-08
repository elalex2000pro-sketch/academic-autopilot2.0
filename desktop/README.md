# Academic Autopilot para Windows y macOS

App de escritorio que abre Academic Autopilot en una ventana propia, con sesión persistente y sin
depender del navegador. Carga la web de producción y conserva la copia local de datos que ya usa la
PWA.

## Desarrollo

```powershell
cd desktop
npm install
npm start
```

Para probar que la ventana carga la web y se cierra sola:

```powershell
$env:AUTOPILOT_SMOKE = "1"
$env:AUTOPILOT_SMOKE_FILE = "$env:TEMP\autopilot-smoke.json"
npm start
Get-Content $env:AUTOPILOT_SMOKE_FILE
```

También se puede apuntar a otro despliegue con `AUTOPILOT_APP_URL`.

## Ventana transparente y marco nativo

La interfaz está pensada para un escritorio real, no para una página con fondo propio:

- Con «Modo Marco Transparente» activo (por defecto): `transparent: true`, `backgroundColor: "#00000000"` y `frame: false` dejan ver el escritorio y eliminan la barra nativa.
- La ventana se arrastra desde la franja superior de la barra lateral (`-webkit-app-region: drag`); los semáforos y controles usan `no-drag`.
- En macOS se usa `vibrancy: "under-window"`.
- En Windows 11 se usa `backgroundMaterial: "acrylic"`. En Windows 10 la transparencia sigue funcionando, pero sin desenfoque nativo.
- Los semáforos de la barra lateral son reales: `preload.js` expone minimizar, maximizar/restaurar y cerrar por IPC.

En **Ajustes → Apariencia** se puede desactivar «Modo Marco Transparente (Estilo macOS / Sin barra de Windows)»:

- Se guarda en `localStorage` (`useCustomTitlebar`) y en `%APPDATA%\academic-autopilot-desktop\window-preferences.json`.
- Al cambiarlo, Electron crea una ventana nueva con `frame: true` o `frame: false` y conserva tamaño, posición y estado maximizado. La ventana anterior se cierra cuando la nueva está lista.
- Con el marco nativo activo, los semáforos personalizados se ocultan y Windows dibuja su barra de título habitual.
- En el navegador el ajuste solo oculta o muestra los semáforos decorativos; no puede cambiar el marco del navegador.

El HTML no pinta ningún fondo. Si algún día se añade un fondo opaco en CSS, la transparencia del sistema dejará de verse.

## Generar el instalador

```powershell
cd desktop
npm run dist
```

El resultado es `desktop/dist/Academic-Autopilot-Setup.exe` (NSIS, Windows x64). El nombre del
archivo es fijo para que funcione la URL estable de descarga:

```text
https://github.com/elalex2000pro-sketch/academic-autopilot2.0/releases/latest/download/Academic-Autopilot-Setup.exe
```

En macOS (x64):

```bash
cd desktop
npm run dist:mac
```

El resultado es `desktop/dist/Academic-Autopilot-<versión>-mac.dmg` y el `.zip` que usa el
actualizador.

`desktop/dist/` no se sube al repositorio. El instalador se adjunta a una release de GitHub.

## Publicar una versión

1. Actualiza `version` en `frontend/package.json`, `desktop/package.json` y
   `frontend/public/version.json` con la misma versión y las notas.
2. Publica desde una rama de release:

   ```bash
   git switch -c release/v1.1.1
   git push origin release/v1.1.1
   ```

   El workflow `.github/workflows/release-desktop.yml` compila Windows y macOS en GitHub Actions,
   crea el tag `v1.1.1` y publica la release con `Academic-Autopilot-Setup.exe`, el `.dmg`,
   `latest.yml` y `latest-mac.yml`. También se puede seguir publicando con un tag `v*` manual.
3. Comprueba la URL `releases/latest/download/Academic-Autopilot-Setup.exe` y la release.

El instalador no está firmado digitalmente. Windows puede mostrar SmartScreen con "Editor
desconocido"; es necesario indicar al usuario que pulse **Más información → Ejecutar de todas
formas**. Para eliminar ese aviso habría que comprar un certificado de firma de código.

## Actualizaciones desde la web

El frontend detecta el canal por el user agent `AcademicAutopilotDesktop/<version>`:

- **Escritorio:** consulta la última release de GitHub que tenga adjunto
  `Academic-Autopilot-Setup.exe`. Si la versión es mayor, muestra el modal y el botón abre la
  descarga del instalador en el navegador del sistema.
- **Web / PWA:** lee `frontend/public/version.json`. Para publicar una versión web, cambia
  `version` en `frontend/package.json`, actualiza `version.json` con la misma versión y las
  novedades, y despliega. Mantén ambos valores iguales: `version.json` solo debe anunciar una
  versión superior cuando exista una release web nueva.

El modal guarda un snooze de 24 h por canal y la versión instalada simulada en `localStorage`.
También se puede lanzar una comprobación manual desde **Ajustes → App de escritorio → Buscar
actualizaciones**.

## Datos y comportamiento

- La app usa la partición persistente `persist:academic-autopilot`; la sesión y el almacenamiento
  local quedan en `%APPDATA%\Academic Autopilot`.
- Los enlaces a otras webs se abren en el navegador del sistema. Las rutas internas se quedan en la
  app.
- Las descargas se guardan en la carpeta Descargas del usuario.
- Si la web no carga, se muestra una pantalla local con un botón para reintentar.
- Necesita internet para cargar y sincronizar. La copia local de la PWA sigue disponible para los
  datos que ya se hayan guardado.
