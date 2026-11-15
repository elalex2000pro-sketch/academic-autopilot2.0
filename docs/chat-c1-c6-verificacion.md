# Chat C1–C6: verificación desde main y parada antes de C6

Fecha: 15 de noviembre de 2026. Rama: `limpieza/chat-c1-c6`.
Base: `b9b19541419e7b6578ac876f7e716d08534ce456`, merge del PR #5.

## Estado encontrado y alcance de esta tarea

Se actualizó `main` con avance rápido desde `origin/main` y se creó la rama
solicitada antes de editar archivos. Se leyeron `AGENTS.md`, `ARCHITECTURE.md`,
`docs/cleanup-plan.md`, `docs/limpieza-pendiente.md`,
`docs/limpieza-verificacion.md`, `docs/limpieza-paso5.md` y
`docs/chat-tiempo-real.md`. No existe `.codegraph/`; no se ha indexado.

El plan C1–C6 ya existe en `docs/limpieza-paso5.md`. C1–C5 están completados e
integrados mediante el PR #1; todos sus commits son antecesores de esta base.
El PR #5 añadió después la recuperación automática. Por tanto, esta tarea
verifica el estado actual y conserva la parada existente antes de C6. No se
repiten extracciones ni se crean commits vacíos para simular pasos nuevos.

El único archivo añadido en esta tarea es este informe. El código, los tests,
Office, Documentos, Biblioteca, Clases, la arquitectura, las dependencias,
migraciones, versiones y estilos conservan su contenido de `b9b1954`.
`docs/rediseno-plan.md` ya existía sin seguimiento y se conserva fuera del commit.
No se hace push, PR, merge, despliegue, versión ni tag en esta tarea.

## Extracciones existentes, un commit por pieza

Líneas físicas, incluidos blancos y comentarios, contadas de nuevo sobre los
archivos de cada commit con `git show` y `splitlines()`:

| Paso | Commit existente | Qué se extrajo | chat-view.tsx antes → después |
|---|---|---|---:|
| C1 | `89e6691` | Formatos y funciones de presentación en `lib/chat-format.ts` | 2043 → 1946 |
| C2 | `de80bb2` | MessageText, MessageTicks y Avatar en `chat/chat-message-content.tsx` | 1946 → 1811 |
| C3 perfil | `79e5a6d` | Perfil, búsqueda y formulario de @usuario en `chat/chat-profile-panel.tsx` | 1811 → 1727 |
| C3 lista | `2a550a6` | Lista de conversaciones en `chat/chat-conversation-list.tsx` | 1727 → 1629 |
| C4 | `669e8cf` | Cabecera del hilo en `chat/chat-thread-header.tsx` | 1629 → 1570 |
| C5 | `737f20b` | Presentación del compositor en `chat/chat-thread-composer.tsx` | 1570 → 1458 |

Los cinco archivos de `components/chat/` y `lib/chat-format.ts` siguen idénticos
a C5. El coordinador creció después de **1458 a 1554 líneas** con el PR #5
(114 líneas añadidas, 18 retiradas). En esta tarea: **1554 → 1554 líneas**.
La reducción histórica desde antes de C1 hasta el main actual es de 489 líneas.

La verificación tras cada extracción original está registrada en
`docs/limpieza-paso5.md`: build, typecheck, lint con siete avisos, 97 tests
backend y pruebas existentes de Chat y Clases. Ese registro es histórico;
la batería actual descrita más abajo se ejecuta sobre `b9b1954`.

## Tamaño actual de los archivos relacionados

Rutas relativas a la raíz del repositorio; líneas físicas, sin omitir blancos.

| Archivo | Líneas |
|---|---:|
| `frontend/src/components/chat-view.tsx` | 1554 |
| `frontend/src/components/chat-page-view.tsx` | 17 |
| `frontend/src/components/chat/chat-message-content.tsx` | 121 |
| `frontend/src/components/chat/chat-profile-panel.tsx` | 145 |
| `frontend/src/components/chat/chat-conversation-list.tsx` | 143 |
| `frontend/src/components/chat/chat-thread-header.tsx` | 109 |
| `frontend/src/components/chat/chat-thread-composer.tsx` | 173 |
| `frontend/src/components/chat-background-picker.tsx` | 219 |
| `frontend/src/components/chat-extras-picker.tsx` | 143 |
| `frontend/src/components/chat-forward-modal.tsx` | 206 |
| `frontend/src/components/chat-workspace.css` | 444 |
| `frontend/src/components/realtime-provider.tsx` | 177 |
| `frontend/src/lib/chat-format.ts` | 83 |
| `frontend/src/lib/api.ts` | 998 |
| `frontend/src/lib/types.ts` | 617 |
| `backend/app/api/v1/chat.py` | 809 |
| `backend/app/api/v1/realtime.py` | 123 |
| `backend/tests/test_chat_flow.py` | 299 |

El coordinador todavía mezcla responsabilidades que el plan conserva por riesgo:

- `ChatView` (892 líneas): estados, refs, selección, búsqueda, presencia/lectura,
  peticiones, envío optimista, suscripción WS, respaldo adaptativo, cancelación,
  historial/scroll, fondos, reenvío y composición de paneles. Incluye aún el
  log y el JSX de las burbujas, pendiente de C6.
- Reconciliación: `mergeIncomingMessage`, `reconcileSentMessage`,
  `mergeMessages`, ordenaciones y avance monotónico de recibos.
- `AttachmentCard` (161 líneas): presentación, descarga, blob/preview, limpieza
  de URL y apertura/guardado de archivos.
- `InviteButton` (72 líneas) y `NewConversationDialog` (309): estados, búsquedas
  asíncronas, invitaciones/creación, cancelación, foco y bloqueo de scroll.

No se introduce un hook de sincronización ni se mueve esa lógica: el plan
existente exige mantenerla en el coordinador. `realtime-provider.tsx` conserva
el WebSocket compartido, watchdog, reconexión, eventos y confirmaciones.

## Verificación actual

Build de producción con `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` y telemetría
desactivada. Typecheck se ejecutó después del build, sin competir sobre `.next`.
Backend con `.venv311`, desde `backend/`. Integración con Chrome sin interfaz,
servidores propios en 8000/3000, SQLite aislada y cuentas/archivos temporales;
sin datos ni credenciales de producción. Los scripts existentes no se alteran.

| Comprobación | Resultado actual |
|---|---|
| `npm run build` | Correcto |
| `npm run typecheck` | Correcto |
| `npm run lint` | Correcto; los mismos siete avisos |
| `../.venv311/Scripts/python.exe -m pytest tests -q` | 99 correctos |
| `node tests/chat-incremental.test.cjs --live` | Correcto; 451 pendientes simulados y 205 reales en dos páginas, sin duplicados |
| `node tests/chat-e2e.cjs` | Correcto; @usuario, WS/recibos, presencia, imagen/PDF, borrador offline y escritorio/móvil |
| `node tests/chat-realtime-e2e.cjs` | 13 casos correctos |
| `node tests/class-tabs-e2e.cjs` | Correcto; dos alumnos, publicaciones/respuestas WS, fijados y pestañas en escritorio/móvil |
| `SMOKE_WEB_MODE=start node tests/smoke.cjs --no-start` | Correcto; 56 comprobaciones de ruta/tamaño y recorridos de Studio |

Los 13 casos del PR #5 cubren frecuencias 30/5 s, retroceso por errores,
recepción sin recarga, reconciliación optimista, pausa offline/oculta y vuelta,
61 pendientes, hilo vacío con 205, cambio rápido de conversación con respuesta
retenida, reconexión con evento WS adelantado, socket mudo, limpieza al salir y
rechazo de un alumno ajeno. Se simulan reloj, visibilidad y fallos de red/socket
en el navegador; la API y persistencia son reales y temporales.

Artefactos de esta ejecución:

- Integración y logs: `C:/Users/elale/AppData/Local/Temp/chat-c1-c5-main-d1oay8m_`.
- Chat: `C:/Users/elale/AppData/Local/Temp/autopilot-chat-browser-8YwS9k`.
- Tiempo real: `C:/Users/elale/AppData/Local/Temp/chat-realtime-G4iGAs`.
- Clases: `C:/Users/elale/AppData/Local/Temp/class-tabs-SgQGaJ`.

Los cinco comandos de integración terminaron con código 0; `results.json`
conserva sus resultados. Los servidores propios se cerraron al terminar.
No se detectaron fallos nuevos en esta batería.

Avisos conocidos: cuatro de imágenes y tres de hooks en lint; obsolescencia
de pytest-asyncio/Starlette; aviso del runner `next start` con `output: standalone`.
No se corrigen ni se silencian en esta limpieza. No se verifican despliegue de
producción, PostgreSQL real ni suspensión de un móvil físico.

## C6: pendiente de autorización expresa

Se extraería únicamente la presentación de cada mensaje a
`frontend/src/components/chat/chat-message-bubble.tsx`: remitente de grupo,
contenido, fecha/hora, ticks y acción de reenvío, con el mismo DOM, clases,
condiciones y textos. El separador de día recibiría el valor calculado por el
coordinador. `AttachmentCard` seguiría definido donde está y se pasaría como
contenido `ReactNode`, conservando su efecto y limpieza.

`messages.map`, orden, claves por ID, cálculo de cambio de día, contenedor del
log, `threadRef`/`bottomRef`, scroll, `loadOlder`, lectura, peticiones, respaldo,
WebSocket y reconciliación permanecerían en `chat-view.tsx`. El botón de
reenvío recibiría el callback del coordinador. No se movería lógica del PR #5.

Antes de cerrar ese único commit se repetirían build, typecheck, lint, backend,
smoke y las pruebas de Chat/Clases; se comprobarían también carga de anteriores
y apertura/guardado de adjuntos. **C6 no está iniciado.**
