# Pendientes de limpieza

Se conservan los siguientes candidatos y sus dependencias; esta fase no decide su eliminación.

| Candidato | Evidencia y motivo de duda |
|---|---|
| `pdf-canvas-viewer.tsx` | Sin imports entrantes encontrados. El lector activo es `book-reader-view.tsx`, pero hay que comparar selección, zoom y render antes de descartar esta alternativa. |
| `schedule-planner.tsx` | Sin imports entrantes encontrados. Las rutas actuales usan `planner-view.tsx`; falta confirmar si su presentación de `OptimizedPlan` se reserva para otro flujo. |
| `office/document-editor.tsx` | Tiptap sin entradas activas encontradas. CKEditor es el motor actual, pero conservar la alternativa y sus extensiones hasta una decisión explícita. |
| `ui/checkbox.tsx` | Sin consumidores encontrados. Puede ser una primitiva reservada del kit y requiere revisar accesibilidad/consistencia antes de retirarla. |
| Dependencias asociadas y `@radix-ui/react-tabs` | Ausencia de import directo no demuestra que sobren; comprobar peers, configuración y usos futuros. No se desinstala ninguna. |
| `.office-find-input` y `.office-find-button` en `writer-editor.css` | Solo aparecen en CSS en la búsqueda estática actual. Se conservan por posible uso en HTML persistido o generación de clases. |
| Parámetro `title` de `exportDocx` | No se lee actualmente, pero se conserva la firma pública y sus llamadas. |

No se eliminan estilos globales ni se reorganizan Dashboard, Clases, Chat o backend. El inventario amplio previo continúa en `docs/cleanup-plan.md`.

## Incidencia inicial fuera del refactor

`frontend/tests/office-e2e.cjs:53` falla antes y después de esta fase al esperar «Sin conexión». La inspección inicial mostró «Conflicto de versión» (409) tras su secuencia de restauración/recarga/importación, antes de bloquear peticiones. Ni el test ni `use-office-storage.ts` se modifican para ocultarlo. Requiere una tarea funcional de diagnóstico de concurrencia independiente; no se cambia el comportamiento en esta limpieza.

## Integración musical retirada

Se conserva el respaldo local `respaldo/spotify-antes-retirada` y las antiguas claves de conexión en localStorage; no se borran datos del usuario. No se han encontrado tablas, migraciones, endpoints, variables de entorno de ejemplo ni dependencias de paquete exclusivas de esa integración. Enfoque, audio ambiental, archivos nativos y los puentes compartidos se conservan.
