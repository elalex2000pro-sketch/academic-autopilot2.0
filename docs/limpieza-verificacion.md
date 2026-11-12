# Verificación de limpieza: pasos 1 a 4

Rama `limpieza/base`, punto de partida `6ebe3dc`. Sin cambios de backend, dependencias, rutas, datos, versión ni tags.

## Referencia antes de cambios

- `npm run build`: correcto, Next.js 14.2.35.
- `npm run lint`: correcto con 10 avisos existentes: imágenes en Chat/Spotify/Studio; limpieza del ref del escritor; dependencias de efectos en preferencias y recompensas.
- `python -m pytest tests -q` en backend: 89 correctos; avisos existentes de pytest-asyncio/Starlette.
- `office-home-e2e.cjs`: correcto (crear, recargar, guardar, volver, renombrar, mover, duplicar, historial y móvil).
- `office-docx-e2e.cjs`: correcto, ida y vuelta real con LibreOffice, contenido/formato/imagen, reemplazo con un deshacer y plantillas.
- Smoke: 52 comprobaciones correctas en escritorio y móvil con el frontend compilado.
- `desktop/office-files.test.cjs`: correcto con archivos reales temporales y diálogos simulados.
- `office-e2e.cjs`: el primer intento en producción falla al esperar el estado de desconexión. El diagnóstico reproduce un conflicto 409 previo a simular la desconexión, después de restaurar/recargar/importar en la secuencia del test. Bloquear el service worker no lo resuelve; se revierte ese ajuste del test. Se conserva este fallo inicial como referencia y no se cambia la lógica de guardado para hacerlo pasar.

## Comparación por bloque

| Bloque | Comparación |
|---|---|
| 1. Guía y pendientes | Solo documentación; código de aplicación idéntico a la referencia. |
| 2. Declaraciones sin uso | Build correcto; lint correcto con los mismos 10 avisos; 89 tests correctos. Solo se eliminan `textToHtml` importado sin uso, la lectura local `activeCell` y el helper privado `children`. |
| 3. Transporte de archivos | Build correcto; lint con los mismos 10 avisos; 89 tests correctos; test de transporte correcto; Dashboard Office y DOCX/LibreOffice/plantillas correctos, igual que la referencia. |
| 4. Biblioteca y escritor | Typecheck correcto en cada extracción; build correcto; lint con los mismos 10 avisos (solo cambia la línea del aviso del escritor); 89 tests correctos; biblioteca, DOCX/LibreOffice, plantillas y smoke de 52 rutas/tamaños correctos. |

## Resultado final y límites

- Antes/después: build correcto; lint correcto con los mismos 10 avisos; 89 tests backend correctos; 52 comprobaciones smoke correctas en producción con escritorio y móvil.
- Antes/después: `office-home-e2e.cjs` y `office-docx-e2e.cjs` correctos. Se prueban crear/guardar/reabrir, renombrar/mover/duplicar/restaurar, selección de plantillas, exportar/reimportar DOCX con LibreOffice real y formatos, y un único deshacer del reemplazo masivo.
- `office-e2e.cjs` conserva el mismo fallo inicial en la espera de desconexión, línea 53. No se afirma que toda la batería Office esté verde.
- Nuevo test de transporte: descarga navegador, bytes/MIME nativos, cancelación, error, apertura de texto y DOCX correctos. Test de handlers IPC existente correcto, con archivos temporales reales y diálogos simulados.
- Se abrió una instancia Electron de desarrollo con perfil temporal y cuenta de la API SQLite aislada. Se pudo leer su interfaz, pero los controles Windows no proporcionaron captura/acciones fiables (incluido «no screenshot targets found»). No se confirma como superada una prueba manual completa ni el guardado con diálogo nativo real. La app instalada y los datos de usuario no se usaron. Queda esa comprobación interactiva pendiente; no se confunde con los tests automatizados.
- Backend, migraciones, CSS, dependencias/lockfiles, versiones, rutas públicas, esquema y claves de guardado sin cambios. `writer-editor.tsx`: 1.963 → 1.457 líneas, con configuración comprobada literalmente contra la referencia y estado/efectos conservados.
- La fase se limita a los pasos 1–4: no se reorganizan otras secciones ni se inicia la fase posterior.

