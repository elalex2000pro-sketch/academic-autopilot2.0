# Repaso con apuntes: verificación

Rama `fix/repaso-apuntes`, desde main `ce448f3`, que ya incluye PR #9 y #10.
No se retrocede al main anterior ni se cambian versiones, tags o releases.

## Referencia antes del arreglo

Se añadieron pruebas antes de cambiar la aplicación (commit `187f313`).
Backend: dos fallos nuevos reproducidos y seis pruebas anteriores correctas.
Los apuntes sin adjuntos devolvían «No encuentro esa información…» sin llamar
al modelo; sin configuración tampoco explicaban cómo activar IA.

Navegador: dos casos correctos (adjunto válido, escritorio/móvil) y seis
fallidos: apuntes, IA ausente y cuaderno vacío en ambos tamaños. Los dos
primeros tenían Chat desactivado; el último no explicaba qué material faltaba.

## Cambio mínimo y privacidad

- `notebook_ai.py` lee los apuntes del cuaderno autorizado cuando la petición
  explícita de Chat/Studio no elige adjuntos. Reutiliza fragmentación,
  recuperación, presupuesto de contexto, citas y herramientas auditadas.
  Si hay adjuntos seleccionados, su comportamiento se mantiene.
- No se crean filas de fuente nuevas: la cita identifica el cuaderno y enlaza
  a su Repaso. El fragmento se muestra en Fuentes con la respuesta. La misma
  comprobación de acceso protege el cuaderno; IDs de adjunto ajenos siguen
  devolviendo 404. No se cambia el esquema ni hay migración.
- `review-workspace.tsx` permite consultar apuntes sin adjuntos, muestra su
  origen y explica que solo se usarán al enviar/pulsar una acción. Incluye
  enlace a Ajustes y un mensaje explícito cuando no hay texto ni fuentes.
  El servidor explica también la falta de modelo/clave cuando corresponde.
- Los apuntes usados ya están guardados en el servidor. La petición no sube
  su texto ni archivos; solo pregunta, IDs elegidos y turno. No se accede a
  PDF locales ni se envía nada al proveedor al abrir la pantalla. Una consulta
  explícita sí envía al modelo configurado los fragmentos necesarios, como se
  indica en pantalla. No hay claves nuevas ni llamadas IA reales en los tests.
- `review/page.tsx`, modelos, importadores y estilos globales no se modifican.
  Se usan tokens/clases existentes, sin colores nuevos ni dependencias.
  Office, Chat entre alumnos, Planificador y rediseño permanecen intactos.

## Pruebas del resultado

- Backend completo: **101 pruebas correctas**. Las nuevas comprueban respuesta
  basada en apuntes, cita fiel, tarjetas/cuestionario/resumen persistidos,
  ausencia de adjuntos creados, permisos e IDs inválidos. Sin configuración
  se explica Ajustes, no se llama al proveedor y no se crea material.
- Navegador: **8 casos correctos**, 1440/390 px: apuntes, archivo adjunto de
  servidor, ausencia de IA y cuaderno vacío. Chat y las tres acciones Studio
  funcionan con apuntes/adjunto; se verifica persistencia por endpoints reales.
  Chat y Studio explican la IA ausente; el cuaderno vacío informa qué falta.
  Se rechaza cualquier subida implícita de archivos/fuentes desde la página.
- Solo la respuesta del proveedor IA se controla en el servidor temporal de
  navegador y en tests backend; la API, SQLite, citas y herramientas escriben
  de verdad. Esto no certifica conectividad ni credenciales Gemini/Ollama real.
- Build y typecheck correctos. Lint correcto con los siete avisos anteriores;
  backend conserva advertencias previas de pytest-asyncio/Starlette.

Smoke: **56 comprobaciones correctas**, escritorio y móvil, contra el servidor
aislado habitual sin el proveedor controlado de Repaso. Repetición final de
Repaso: los ocho casos vuelven a pasar, exigiendo que se vea la explicación de
IA también después de una acción Studio. No se observan fallos nuevos.

## Evidencia local

Registros y capturas antes/después, sin datos de producción:
`%TEMP%\review-5c-kgveagjk`. El servidor de proveedor controlado vive fuera del
repositorio; no forma parte de la aplicación ni del despliegue. Para repetir
`frontend/tests/review-notes-e2e.cjs` se requiere API SQLite aislada en :8000,
build propio en :3000 y `REVIEW_OUTPUT` con una carpeta privada; el recorrido
positivo necesita un proveedor IA controlado que responda con citas y acciones.
El test no debe ejecutarse contra producción ni usar claves personales.

Pendientes: revisión/CI remoto y prueba con proveedor real autorizado. Los
PDF locales de Biblioteca quedan expresamente fuera de esta tarea.
