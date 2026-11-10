# IA con fuentes por cuaderno

## Contrato

`POST /api/v1/notebooks/{id}/chat`

```json
{"question":"Explica la respiración celular","source_ids":["UUID de NotebookSource"]}
```

Devuelve `answer`, `citations`, `actions`, `state` y `warnings`. La selección vacía
no utiliza fuentes. Se rechazan ids de fuentes ajenas al cuaderno. Las citas
incluyen número, fuente, título, página/rango (null si el formato no tiene páginas),
fragmento exacto, offset y URL autenticada para consultar el fragmento. El acceso
se valida también al abrir la cita.

`GET /api/v1/notebooks/{id}/messages` devuelve el historial del usuario actual;
los compañeros no acceden a los chats ni acciones personales de otro usuario.
El cliente TypeScript expone `api.notebookChat` y `api.notebookMessages`.
El panel «IA del cuaderno» se abre desde los cuadernos propios o compartidos,
permite elegir fuentes y expandir el fragmento citado.

## Recuperación y herramientas

Se recorren las secciones completas de todos los libros seleccionados y el texto
completo de los documentos seleccionados, sin truncar al principio de la fuente.
Los PDFs se extraen por página; otros documentos no reciben páginas inventadas.
Los fragmentos de 1200 caracteres se solapan en 200. Un ranking BM25 en Python
selecciona el contexto, cuyo tamaño total respeta `AI_STUDIO_MAX_CHARS`. No hay
embeddings, servicios externos adicionales ni dependencias nuevas. Un escaneo sin
texto necesita OCR y se indica como fuente ilegible.

Se reutilizan `resolve_profile` y `_post_chat` de `ai_service`, así como la entrada
`ai_tools.execute_tool` con un catálogo acotado al cuaderno. El límite del bucle
es `AI_MAX_TOOL_ITERATIONS`; el catálogo general del asistente no se expone a las
fuentes. El flujo `/assistant/confirm` existente se conserva: estas herramientas
solo crean material, no tienen operaciones destructivas.

- `create_flashcards`: crea Flashcard del solicitante vinculadas al cuaderno y
  compatibles con su repaso espaciado.
- `create_quiz`: guarda Quiz con preguntas, opciones, respuesta y explicación.
- `create_summary`: añade una nota con título al contenido del cuaderno; exige
  propiedad o permiso de edición. El id devuelto identifica el cuaderno modificado.

Cada acción usa un savepoint y guarda un NotebookAction con firma/resumen de
argumentos y resultado. Los lotes inválidos no guardan material parcial. Se
reutilizan acciones idénticas ya completadas. Las confirmaciones de creación se
construyen en el servidor desde los resultados reales, con ids y cantidades.
El estado inyectado incluye inventario de fuentes, cantidades y últimas acciones.

Para modelos sin herramientas se pide JSON con `actions:[{tool,arguments}]` y se
ejecuta el mismo catálogo validado. `_post_chat` conserva su reintento sin
herramientas ante un 400 del proveedor. Si la respuesta indica falta de evidencia,
no tiene referencias válidas o el modelo falla, se devuelve un mensaje explícito.
El modelo sigue siendo responsable de la fidelidad semántica de su paráfrasis:
validar ids/citas y pedir abstención no constituye una prueba automática de que
cada afirmación esté implicada por el texto citado.

## Validación

Tests del backend con SQLite temporal y proveedor simulado: citas y enlaces,
abstención, referencias inexistentes, permisos, aislamiento del historial,
creación real, lotes atómicos, deduplicación, resumen con permiso de edición,
bucle nativo y respaldo JSON sin herramientas. No prueban un proveedor en vivo.
Prueba de navegador con dos cuentas de la API aislada: selección de fuentes,
citas expandibles, creación de tarjetas, actualización del resumen en el editor,
historial tras recargar y chat del cuaderno compartido en móvil con permiso de lectura.
La migración nueva `0024_notebook_ai` tiene SQL PostgreSQL comprobado en modo
offline; su aplicación a producción depende del arranque del backend
(`alembic upgrade head`). No se modifican migraciones aplicadas.
