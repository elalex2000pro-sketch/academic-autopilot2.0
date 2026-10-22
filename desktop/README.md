# Academic Autopilot para Windows

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

## Ventana transparente

La interfaz está pensada para un escritorio real, no para una página con fondo propio:

- `transparent: true` y `backgroundColor: "#00000000"` dejan ver el escritorio.
- `frame: false` elimina la barra nativa; la ventana se arrastra desde la franja superior de la barra lateral.
- En macOS se usa `vibrancy: "under-window"`.
- En Windows 11 se usa `backgroundMaterial: "acrylic"`. En Windows 10 la transparencia sigue funcionando, pero sin desenfoque nativo.
- Los semáforos de la barra lateral son reales: `preload.js` expone minimizar, maximizar y cerrar por IPC.

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

`desktop/dist/` no se sube al repositorio. El instalador se adjunta a una release de GitHub.

## Publicar una versión

1. Cambia `version` en `desktop/package.json`.
2. Ejecuta `npm run dist`.
3. Crea una release nueva (por ejemplo `desktop-v1.0.1`) y adjunta el `.exe` con el nombre exacto
   `Academic-Autopilot-Setup.exe`.
4. Comprueba la URL `releases/latest/download/Academic-Autopilot-Setup.exe` y la descarga desde la
   web.

El instalador no está firmado digitalmente. Windows puede mostrar SmartScreen con "Editor
desconocido"; es necesario indicar al usuario que pulse **Más información → Ejecutar de todas
formas**. Para eliminar ese aviso habría que comprar un certificado de firma de código.

## Datos y comportamiento

- La app usa la partición persistente `persist:academic-autopilot`; la sesión y el almacenamiento
  local quedan en `%APPDATA%\Academic Autopilot`.
- Los enlaces a otras webs se abren en el navegador del sistema. Las rutas internas se quedan en la
  app.
- Las descargas se guardan en la carpeta Descargas del usuario.
- Si la web no carga, se muestra una pantalla local con un botón para reintentar.
- Necesita internet para cargar y sincronizar. La copia local de la PWA sigue disponible para los
  datos que ya se hayan guardado.
