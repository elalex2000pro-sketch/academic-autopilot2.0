# Horario móvil: verificación

Rama `fix/horario-movil`, desde main `3efb5b1` (PR #8).

## Reproducción antes del cambio

`frontend/tests/timetable-mobile-e2e.cjs` registra un usuario efímero y siete
franjas en la API SQLite aislada, sin producción ni respuestas simuladas.
Comprueba cinco anchos (390, 600, 768, 1024 y 1440) en `/schedule`, `/planner`
y `/calendar`. El horario local se inicializa con las franjas devueltas por
esa API; las ediciones posteriores deben persistir tras recargar.

Antes de modificar la aplicación: 6 casos correctos (1024/1440) y 9 fallidos
(390/600/768, las tres rutas). La prueba devuelve código 1. A 390 px el horario
tenía `clientWidth=640`, `scrollWidth=640`, borde derecho en 688 y página de
390 px: no había desbordamiento interno y el marco recortaba los últimos días.
El fallo ya estaba documentado antes de P1–P8; no se atribuye a la limpieza.

## Cambio mínimo

Una clase `min-w-0` en la tarjeta de la cuadrícula, en
`frontend/src/components/planner/planner-timetable-tools.tsx:298`, permite que
su columna se contraiga. El contenedor de `WeeklyTimetable` conserva su
`overflow-x-auto` y la tabla sus 640 px mínimos.

No se modifican `weekly-timetable.tsx`, `app-shell.tsx`, estilos globales,
colores, tokens, estado, callbacks, importación o datos. Sin dependencias ni
migraciones. Office, Chat, Repaso y R2 permanecen intactos.

A 390 px, después: `clientWidth=296`, `scrollWidth=640`, borde derecho en 344
y página de 390 px. El desplazamiento horizontal queda dentro del horario.

## Comprobaciones

- Los 15 casos pasan tras el arreglo. En cada uno se desplaza el horario,
  se pulsan los lápices de jueves, viernes, sábado y domingo sin forzar clics,
  se guardan cambios y se comprueba su persistencia tras recargar. También se
  exige que el horario quepa en pantalla y que la página no se ensanche.
- El único consumidor de `WeeklyTimetable` es `PlannerTimetableTools`; los
  tres accesos a ese consumidor se incluyen en la prueba.
- Capturas del horario a 1024/1440 antes y después: seis comparaciones con
  idénticas dimensiones; cuatro PNG son idénticos por píxel y dos varían
  como máximo 1/255 por canal por rasterización de la superficie translúcida.
  No hay cambios visibles. No se usan máscaras.
- Capturas de página a 390 antes y después, además de la vista desplazada a
  los últimos días. Las imágenes de referencia se capturan antes de editar
  las franjas, para comparar el mismo contenido.
- Build y typecheck correctos; lint correcto con los siete avisos anteriores.
- Backend: 99 tests correctos, con las advertencias previas pytest-asyncio y
  Starlette. El primer intento se lanzó desde la raíz equivocada y falló al
  importar módulos; se repitió desde `backend/`, sin cambiar código.

Smoke: 56 comprobaciones correctas en escritorio y móvil, incluidas las otras
secciones sin cambios. Confirmación final a 390 px: los tres accesos pasan de
nuevo y guardan capturas desplazadas hasta el domingo. No hay fallos nuevos
observados. Quedan pendientes revisión y comprobaciones remotas del PR.

## Evidencia y reproducción

Galería persistente fuera del repositorio:
`C:\Users\elale\Downloads\academic_autopilot\verification\horario-movil\index.html`.
Las carpetas `before`/`after` contienen capturas y métricas;
`desktop-comparison.json` conserva la comparación de escritorio. No se
publican tokens de sesión ni bases de datos. Registros completos locales:
`%TEMP%\horario-5b-fc2v2b62`.

Con servidores propios y API de `backend/tests/chat_test_server.py`:
`TIMETABLE_OUTPUT=<directorio privado> node tests/timetable-mobile-e2e.cjs`.
`TIMETABLE_STAGE=before` guarda la referencia; el valor predeterminado es
`after`. `TIMETABLE_WIDTHS=[390]` permite repetir solo el ancho móvil.
Debe servirse el build actual en localhost:3000 y la API aislada en :8000.

No se consideran corregidos aquí los pendientes PLAN-02/03 de precarga RSC.
Las pruebas usan Chrome web con viewport móvil; no acreditan un móvil físico.
No fusionar el PR como parte de esta tarea.
