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
- `office-e2e.cjs`: el primer intento en producción falla al esperar el estado de desconexión. Se investiga el aislamiento del service worker del propio test antes de usarlo para comparar la limpieza. No se cambia la lógica de guardado de la app para corregir una prueba.

## Comparación por bloque

| Bloque | Comparación |
|---|---|
| 1. Guía y pendientes | Solo documentación; código de aplicación idéntico a la referencia. |

Las pruebas de interfaz automatizadas no se presentan como interacción manual con diálogos nativos. Los resultados finales y las comprobaciones manuales se registrarán al cerrar la fase.
