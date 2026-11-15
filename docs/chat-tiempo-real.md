# Tarea 2A — pasos 1 y 2, parada antes del paso 3

Fecha: 15 de noviembre de 2026. Rama: `feat/chat-tiempo-real`, creada desde
`main` actualizado, `cea6daf` (PR #3 y #4 fusionados). Sin PR, push, versión,
tag ni despliegue de estos cambios. `docs/rediseno-plan.md` ya existía sin
seguimiento y queda fuera de los commits.

## 1. Diagnóstico del despliegue

- La web pública `https://academicautopilot.vercel.app/chat` responde 200.
- Se examinó su JavaScript público y se ejecutó su función real de resolución
  de URL en un Chrome temporal, sin sesión. Resultado:
  `wss://academicautopilot.vercel.app/api/v1/ws?token=`.
  El token vacío corresponde a la comprobación sin sesión, no a un token de alumno.
- La API `https://academic-autopilot-api.onrender.com/health` responde 200,
  con entorno `production`. El listado de conversaciones sin credenciales
  responde 401. Un handshake WebSocket directo a esa API con un token de
  diagnóstico inválido responde 403, como exige el código de autenticación.
  Esto acredita accesibilidad y rechazo de credenciales inválidas, no una
  conexión autenticada de producción ni el intercambio entre dos alumnos allí.
- `frontend/next.config.mjs` envía REST a Render incluso sin variable, mediante
  su destino predeterminado. `realtimeUrl()` usa el origen de Vercel si no recibe
  `NEXT_PUBLIC_API_URL`. La web publicada coincide con este segundo camino.
- **Causa probable fuerte:** la variable faltaba o estaba vacía al construir
  el despliegue publicado. No se puede asegurar si hoy está guardada en el panel:
  el conector Vercel devuelve 403 por falta de acceso al ámbito configurado.
  También puede haberse guardado después del último build o en otro entorno.
- El backend usa FastAPI/Uvicorn en Render y un proceso por defecto;
  `REALTIME_ENABLED=true` está declarado en `render.yaml`. Sus valores efectivos
  y el número real de procesos en el panel de Render no se han podido inspeccionar.
  El gestor de eventos vive en memoria: varios procesos necesitarían coordinación
  compartida. No se modifica ese transporte en estos pasos.
- Render gratuito suspende tras 15 minutos sin tráfico entrante, incluso si
  existe una conexión sin tráfico entrante. La siguiente petición/conexión lo
  despierta en aproximadamente un minuto. El ping saliente de la API no debe
  darse por garantía de mantenerlo activo. Puede haber demora y reconexión;
  no implica pérdida de mensajes guardados en PostgreSQL.

### Comprobación manual en Vercel

1. Abrir el proyecto que sirve `academicautopilot.vercel.app`.
2. Ir a **Settings → Environment Variables** y buscar `NEXT_PUBLIC_API_URL`.
3. Añadirla o corregirla con el valor exacto
   `https://academic-autopilot-api.onrender.com`, sin `/api/v1`, comillas ni
   espacios. Si se utiliza otro backend, confirmar primero su dominio real.
4. Aplicarla a **Production** y **Preview**, comprobando que no esté limitada
   a una rama distinta. Es una URL pública; no introducir claves ni tokens.
5. Guardar y, en **Deployments**, volver a desplegar el `main` actual para
   reconstruir el frontend. Guardar la variable no cambia el JavaScript ya publicado.
6. Al estar listo, abrir de nuevo la app y comprobar en las herramientas del
   navegador, **Network → WS**, que conecta a
   `wss://academic-autopilot-api.onrender.com/api/v1/ws?...` y obtiene **101**
   con una sesión válida. No compartir ni registrar la query con el token.
7. Probar recepción entre dos cuentas sin recargar. Si persiste, revisar
   `REALTIME_ENABLED` y un solo proceso en Render y el error concreto del handshake.

La documentación antigua de `docs/DEPLOYMENT.md` que niega soporte WebSocket
en Vercel está desactualizada: Vercel lo permite con Fluid Compute, sujeto a
duración máxima y reconexión. No se migra la API a Vercel.

Fuentes oficiales consultadas:
[variables Vercel](https://vercel.com/docs/environment-variables),
[variables públicas Next.js 14](https://nextjs.org/docs/14/app/building-your-application/configuring/environment-variables),
[Render gratuito](https://render.com/docs/free),
[WebSockets Vercel](https://vercel.com/docs/functions/websockets).

## 2. Contrato de lectura incremental

`GET /api/v1/chat/conversations/{id}/messages?after=<UUID>&limit=200`
devuelve una página de mensajes posteriores al mensaje de referencia, en orden
ascendente por `(created_at, id)`. El UUID desempata fechas iguales y el cursor
es exclusivo. Cada página continúa desde el último ID recibido. Máximo 200;
se mantiene el valor predeterminado 50. No descarga mensajes anteriores al cursor.

Se exige pertenecer a la conversación antes de resolver el cursor. Un cursor
inexistente o de otro hilo devuelve el mismo 404; un no miembro recibe 403,
una petición sin credenciales 401 y parámetros inválidos 422. `before` y `after`
son incompatibles. El historial sin cursor y `before` conservan su contrato;
se hace determinista el orden de mensajes que comparten fecha mediante su UUID.
Estas lecturas no confirman entrega ni lectura y no escriben mensajes.

`chatApi.messagesSince(conversationId, afterId, signal?)` solicita páginas de
200 hasta agotar los pendientes. Excluye el mensaje de referencia, elimina
IDs repetidos y falla si el cursor deja de avanzar. Propaga errores sin
devolver un resultado parcial. Admite cancelación antes, durante y entre
peticiones para su futura integración al cambiar de hilo. No inicia timers
ni se conecta aún con ChatView o el proveedor.

No se cambian modelos, datos de producción, migraciones ni dependencias.
Las pruebas crean exclusivamente cuentas y mensajes en bases SQLite temporales.
No se afirma ejecución contra PostgreSQL de producción ni una instantánea
transaccional entre varias peticiones: las escrituras posteriores se recuperan
en la siguiente consulta desde el último cursor confirmado.

## Verificación

- Backend: **99 tests correctos**, incluidos dos nuevos (127 pendientes con
  fechas iguales, paginación de 17, historial antiguo, escritura posterior,
  resultado vacío, límites y permisos). Los 97 casos anteriores se conservan.
- Cliente: prueba nueva `node tests/chat-incremental.test.cjs`; 451 pendientes
  en tres páginas, límite exacto de 200, vacío, cursor sin avance, cancelación,
  error de permisos durante paginación y compatibilidad de `messages()`.
- `npm run typecheck`: correcto, antes del cambio y después del build final.
- `npm run lint`: correcto, con los mismos siete avisos antes/después. Build
  correcto con `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`, exclusivo de pruebas.
- Cliente contra API real aislada:
  `node tests/chat-incremental.test.cjs --live`, correcto. Crea 206 mensajes de
  prueba y recupera los 205 posteriores al primero en dos peticiones; comprueba
  orden/IDs exactos, ausencia de duplicados, vacío y compatibilidad del historial.
- Smoke general existente, sin modificar:
  `node tests/smoke.cjs --no-start` con `SMOKE_WEB_MODE=start` y servidores propios;
  **56 comprobaciones correctas** en escritorio/móvil y recorridos de Studio.
- `node tests/chat-e2e.cjs`: correcto; @usuario, recibos y recepción por WS,
  presencia/desconexión, adjuntos, borrador offline y móvil/escritorio.
- `node tests/class-tabs-e2e.cjs`: correcto, sin modificar Clases ni su prueba;
  publicaciones/respuestas en tiempo real con dos alumnos, fijados y pestañas.
- Artefactos de integración y smoke:
  `C:/Users/elale/AppData/Local/Temp/academic-chat-2a-J1roEj`;
  Chat: `C:/Users/elale/AppData/Local/Temp/autopilot-chat-browser-UV7R5M`;
  Clases: `C:/Users/elale/AppData/Local/Temp/class-tabs-jynqpi`.
  Los cuatro comandos de integración terminan con código 0. Los servidores de
  prueba propios se cierran al terminar.
- Fallos/avisos preexistentes: siete avisos lint; advertencias de obsolescencia
  de pytest-asyncio/Starlette y del runner `next start` con `output: standalone`.
  Se conserva la falta de destino Render en la URL WebSocket de la web publicada.
- Fallo nuevo al cierre: ninguno detectado. Pendiente: comprobar/corregir el
  panel de Vercel y validar una conexión autenticada en producción; migraciones
  y concurrencia sobre PostgreSQL real no se han ejecutado ni se afirman validadas.
- Las primeras ejecuciones aisladas de pytest y build se bloquearon en Windows;
  se detuvieron únicamente los procesos propios y se repitieron fuera del aislamiento.
  Un primer intento de pytest desde la raíz falló por directorio de ejecución;
  se corrigió ejecutándolo desde `backend/`. No se cambió la configuración.

## Parada obligatoria

El paso 3 requerirá autorización expresa antes de tocar `realtime-provider.tsx`
o los efectos de `chat-view.tsx`: destino/conexión WebSocket, detección de fallos,
respaldo adaptativo, suspensión al ocultar/offline, recuperación al volver,
cancelación y reconciliación con mensajes optimistas/recibos. El proveedor es
compartido y Clases requiere regresión sin modificarla.

Office, Documentos, Biblioteca, extracciones C1–C6 y rediseño quedan fuera.
