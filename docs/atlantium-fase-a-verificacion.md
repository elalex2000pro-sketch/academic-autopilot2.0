# Atlantium: nombre visible y estudio del perfil de escritorio

Base: main `5647501` (PR #14). Rama `feat/nombre-atlantium-visible`.
Versión 1.4.0 sin cambios. No se generan instaladores, etiquetas ni releases.

## Fase A

Nombre actualizado en navegación, login, instalación, onboarding, ajustes y
aviso de prueba, títulos del layout/Chat/Office, texto accesible del splash,
error global, página web offline y nombre/nombre corto/descripción del manifiesto.
Academic Office (incluida su grafía existente Academic-Office) sigue igual.
Los iconos, estilos y estructura de la interfaz no cambian.

El smoke exige Atlantium en los títulos web; el smoke de Electron admite tanto
la web anterior como la nueva, conservando su identificación técnica y origen.
Ese predicado es el único cambio en desktop; no cambia el funcionamiento normal.

Se conserva Academic Autopilot a propósito en:

- Producto, ventana inicial y aviso nativo de reserva de Electron, pantalla
  offline incluida en el ejecutable, instalador, accesos directos, copyright y
  metadatos de desktop: son la fase B, no implementada aquí.
- Archivos `Academic-Autopilot-Setup.exe` y `Academic-Autopilot-*-mac.*`, feed,
  workflow de lanzamiento, generador de metadatos, URLs y releases publicadas.
- User agent `AcademicAutopilotDesktop`, appId/AUMID, GUID NSIS, nombre interno
  `academic-autopilot-desktop`, partición, IndexedDB, claves y eventos internos.
- Campo `app` del formato JSON de exportación de IA Studio: metadato del formato,
  no texto de interfaz; no se altera el contrato de exportación en esta fase.
- Notas de versiones, README e informes anteriores (la documentación vigente
  general se revisará en fase C), comentarios históricos y fixture PDF de Chat.
- Repositorio, dominios Vercel e identidad PWA (`id`, `start_url`, `scope`, origen).

## Fase B: resultado confirmado en Windows

Se inspeccionaron los paquetes internos de los instaladores de 1.3.46 y 1.4.0.
El 1.4.0 procede del EXE publicado, de 112.773.372 bytes, extraído sin instalar.
En ambos `resources/app.asar/package.json` figura:

    name: academic-autopilot-desktop
    productName: ausente

Se arrancó cada ejecutable con el depurador detenido antes de ejecutar su main,
se consultaron `app.getName()` y los paths y se cerró el proceso sin ejecutar
la aplicación ni abrir sus sesiones. Los dos devolvieron:

    app.getName(): academic-autopilot-desktop
    userData: %APPDATA%\academic-autopilot-desktop
    sessionData: %APPDATA%\academic-autopilot-desktop
    PARTITION en el main distribuido: persist:academic-autopilot

En este equipo, la raíz resuelta fue
`C:\Users\elale\AppData\Roaming\academic-autopilot-desktop`.
No se inspeccionó contenido de sesión, borradores o PDF personales.
La carpeta de la partición persistente deriva de sessionData y su nombre;
el valor lógico de la partición se confirmó en ambos main distribuidos.

### Por qué el README da dos rutas

Ambas afirmaciones ya aparecen en el mismo commit `1f3d800`, que introdujo esa
documentación. La ruta con `academic-autopilot-desktop` corresponde al nombre
interno real; la ruta con `Academic Autopilot` confunde el producto mostrado con
el nombre efectivo de Electron. No hay evidencia de una migración entre esas
dos rutas en los binarios examinados. El README no se corrige todavía en fase A.

### Qué implica cambiar productName

Hay que distinguir `build.productName` (configuración de electron-builder) de
`productName` en el package interno o `app.setName()` en ejecución. Los paquetes
actuales tienen el primero al construir y no el segundo al ejecutarse.
Cambiar solo el nombre comercial de build, manteniendo el mismo package interno,
no implica por sí solo otra ruta. Si el nuevo empaquetado cambia el nombre
efectivo a Atlantium y no fija paths, Electron podría usar otra carpeta: parecería
una instalación vacía, aunque los datos antiguos seguirían en su sitio.
Debe comprobarse el candidato real, no deducirse del nombre del instalador.

Propuesta para fase B, NO implementada: antes de cargar el actualizador, pedir
el bloqueo de instancia, abrir ventanas o crear sesiones, calcular la ruta
legada como `path.join(app.getPath('appData'), 'academic-autopilot-desktop')`
y fijarla explícitamente con `app.setPath('userData', ...)` y
`app.setPath('sessionData', ...)`. Conservar `persist:academic-autopilot`, name,
appId/AUMID, GUID, user agent, origen y nombres de bases/claves. No trasladar,
fusionar ni borrar perfiles automáticamente. La variante de pruebas debe
inyectar una raíz temporal en vez de apuntar al perfil personal.

### Ensayo propuesto desde 1.4.0

1. Ejecutable 1.4.0 publicado, perfil temporal explícito y servidor de pruebas
   con un origen estable, compartido después por el candidato.
2. Crear una sesión autenticada aislada, borrador Office y PDF local real en
   IndexedDB; anotar hashes, identificadores y posición de lectura.
3. Cerrar, vaciar escrituras pendientes y hacer copia del perfil de prueba.
4. Abrir candidato Atlantium con la misma raíz y partición; comprobar paths,
   sesión sin volver a entrar, borrador, render del PDF, hash y posición.
5. Reiniciar y repetir; comprobar actualización, acceso directo, ausencia de
   segundo perfil y convivencia del feed/nombres antiguos.
6. El ensayo completo del instalador NSIS y macOS necesita verificación propia;
   no se ejecuta una instalación ni migración en esta fase.

No se ha construido ni probado un candidato con productName cambiado. En macOS
no se han ejecutado los paquetes; las rutas confirmadas arriba son de Windows.

## Verificación de fase A (16 de noviembre de 2026)

- Typecheck y build correctos; lint con los siete avisos anteriores.
- 26 tests de PWA/actualizador/lanzamiento correctos; 101 backend correctos.
- Smoke de Electron con el código actual y web local Atlantium: correcto;
  userData/sessionData fijados a un perfil temporal antes del arranque.
- Smoke: 56 comprobaciones correctas a 1440/390, incluyendo los títulos Atlantium.
  Auditoría PWA, notificaciones, PDF offline y actualización del worker correctas.
- Evidencia local: `%TEMP%/atlantium-smoke-yqiyx1gi/smoke/` y
  `%TEMP%/atlantium-identidad-20b930cc54ba4bd8a3499615e78a4eb0/`
  (`identity-results.json`, `electron-smoke.json`).

Sin cambios de iconos, versión, dependencias, datos, rediseño, dominio o repo.
