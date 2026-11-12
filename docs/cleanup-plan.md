# Plan de limpieza segura

Inventario del 12 de noviembre de 2026, base `19f6baa`, rama `limpieza/base`. Esta entrega prepara documentación, CI y smoke. No borra código, no modifica el comportamiento de la app y no autoriza eliminar los candidatos.

## Método y límites de la evidencia

Se revisaron todos los `frontend/src/app/**/page.tsx`, imports estáticos, reexports `from`, `import()` literales, `require()` literales y resolución relativa/alias `@/` con `.ts`, `.tsx`, `.css` e índices. Se contrastaron nombres de símbolos y rutas. No existe `.codegraph/`, por lo que no se ha indexado ni utilizado CodeGraph. No se asume que la ausencia en el grafo pruebe que un archivo es eliminable: quedan posibles imports construidos, consumo fuera del repositorio y decisiones de producto. El análisis de dependencias incluye código, configuración y tests; los tipos, CLI, plugins y drivers no requieren un import de la aplicación para ser necesarios.

Comandos reproducibles desde la raíz (PowerShell admite los patrones de rg como argumentos, sin expandir rutas con comodines):

```text
rg -n 'pdf-canvas-viewer|PdfCanvasViewer|schedule-planner|SchedulePlanner|document-editor|DocumentEditor' frontend/src frontend/tests
rg -n '@tiptap|@radix-ui/react-tabs|ui/checkbox|Checkbox' frontend/src frontend/tests
rg -n 'local-library|book-reader-view|planner-page-view|writer-editor' frontend/src
rg --files frontend/src/app -g page.tsx
```

## Candidatos a código sin uso (sin borrar)

| Archivo | Imports directos entrantes | Dinámicos entrantes | Evidencia de ruta y alternativa activa | Próximo paso y riesgo |
|---|---|---|---|---|
| `frontend/src/components/pdf-canvas-viewer.tsx` (`PdfCanvasViewer`) | 0 | 0 | Solo definiciones propias del símbolo. `/library/[id]/page.tsx` importa dinámicamente `book-reader-view.tsx`; `lib/local-library.ts` gestiona el PDF local | Comparar zoom, render, selección y búsqueda con el lector activo; confirmar que no es una reserva de implementación. Medio |
| `frontend/src/components/schedule-planner.tsx` (`SchedulePlanner`) | 0 | 0 | Solo exportación propia. `/planner`, `/calendar` y `/schedule` usan `PlannerPageView` → `lazy()` de `planner-view.tsx`; `/schedule` abre herramientas | Verificar que el antiguo visualizador de `OptimizedPlan` no contiene un caso pendiente. Medio |
| `frontend/src/components/office/document-editor.tsx` (`DocumentEditor`, Tiptap) | 0 | 0 | Solo definiciones propias. `/office/[id]` y Documentos usan `academic-office-view.tsx` → import dinámico de `office/writer-editor.tsx` (CKEditor) | Inventariar diferencias y confirmar decisión de motor antes de plantear eliminación. Medio/alto |
| `frontend/src/components/ui/checkbox.tsx` (`Checkbox`) | 0 | 0 | Componente exportado, sin consumidores de ruta ni barra de reexports encontrada. Existen casillas HTML nativas en otros componentes | Revisar consistencia/accesibilidad del kit. Bajo, pero puede ser una primitiva reservada |

No se consideran candidatos `book-reader-view.tsx`, `class-detail-view.tsx`, `planner-view.tsx`, `academics-view.tsx`, `settings-view.tsx`, `canvas/canvas-view.tsx` ni `office/writer-editor.tsx`: tienen entradas diferidas (`dynamic`, `lazy` o import dinámico) desde rutas o vistas activas. Tampoco son código muerto `/subjects`, `/exams`, `/assistant` y `/transcribe`: son redirecciones conservadas. Documentos integra una página de cuadernos y Office además de tener rutas propias; compartir entradas no demuestra duplicación eliminable.

## Dependencias candidatas (sin desinstalar)

| Dependencia | Evidencia | Clasificación y acción propuesta |
|---|---|---|
| `@radix-ui/react-tabs` | Declarada en package.json; sin import directo/dinámico ni uso literal en src, tests o configuración revisados | Candidata más clara. Revisar peerDependencies y consumidores antes de desinstalar, en una futura tarea aislada |
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-underline` | Todos los imports de aplicación encontrados están en `office/document-editor.tsx`, que no tiene entradas activas | Solo candidatas condicionadas a la decisión sobre el editor legado; no retirar ahora |
| `@tiptap/pm` | No tiene import directo; es soporte/peer del conjunto Tiptap | No asumir que sobra por ausencia de import. Evaluar solo con el grupo completo y `npm explain @tiptap/pm` |
| `@radix-ui/react-checkbox` | Único import de app en `ui/checkbox.tsx`, sin entradas a esa primitiva | Candidata condicionada al destino de la primitiva; comprobar transitivas y peerDependencies |
| `date-fns` (referencia de configuración) | `next.config.mjs` lo nombra en `optimizePackageImports`, pero no figura como dependencia directa ni import de app | Configuración posiblemente residual; no es un paquete directo que desinstalar |

No se han demostrado dependencias directas prescindibles del backend ni desktop con esta revisión. `asyncpg` y `psycopg2-binary` se cargan como drivers mediante URLs SQLAlchemy; `email-validator`, bcrypt y paquetes de seguridad también pueden activarse indirectamente. `pytest`, `ruff`, `typescript`, `eslint-config-next`, PostCSS, `@types/*` y `tailwindcss-animate` intervienen en CLI, tipado o configuración; `playwright-core` tiene usos reales en tests. Electron y electron-builder son herramientas de ejecución/distribución, y electron-updater está conectado en main.js. Que un paquete no tenga un import literal no lo convierte en inútil.

## Archivos grandes y propuesta de división

Recuento de líneas físicas con UTF-8, incluidos comentarios y blancos, sobre fuentes TS/TSX/CSS y Python de la base indicada. Es una medida de tamaño, no de complejidad ni de defectos. Se listan los doce mayores de cada lado; el orden es una propuesta relativa por riesgo/dependencias, no un permiso para reescribirlos.

### Frontend

| Archivo | Líneas | Responsabilidades que separar gradualmente | Riesgo | Orden |
|---|---:|---|---|---:|
| `frontend/src/components/planner-view.tsx` | 2493 | Carga/datos y operaciones; edición de eventos; importación/edición de horario; herramientas y vistas de calendario | Alto | 6 |
| `frontend/src/components/chat-view.tsx` | 2043 | Sincronización y acciones; lista de conversaciones; lienzo/mensajes; adjuntos/compositor; búsqueda y menús | Muy alto | 9 |
| `frontend/src/components/office/writer-editor.tsx` | 1963 | Adaptador del motor; menús/comandos; formato y selección; regla/papel; paneles laterales | Muy alto | 10 |
| `frontend/src/components/ia-studio.tsx` | 1889 | Sesión e historial; adjuntos; modos audio/documento; confirmaciones; composición y presentación | Alto | 7 |
| `frontend/src/components/settings-view.tsx` | 1864 | Pestañas y navegación; cuenta; integraciones; apariencia; perfiles IA; datos/exportación | Medio/alto | 4 |
| `frontend/src/components/book-reader-view.tsx` | 1781 | Persistencia/guardado serial; ciclo PDF; navegación/zoom; búsqueda; anotaciones y paneles | Muy alto | 11 |
| `frontend/src/app/globals.css` | 1730 | Tokens/tema; estructura; componentes; utilidades; estilos por sección conservando orden y especificidad | Alto | 12 |
| `frontend/src/components/class-detail-view.tsx` | 1426 | Carga/realtime de clase; composición de pestañas; acciones de miembros; publicaciones y recursos restantes | Alto | 8 |
| `frontend/src/components/academics-view.tsx` | 1410 | Carga y selección de asignaturas; notas/exámenes; modales; métricas y presentación | Medio/alto | 5 |
| `frontend/src/app/review/page.tsx` | 1259 | Selector y navegación; sesión de tarjetas; cuestionarios; catálogo de material; estadísticas | Medio/alto | 3 |
| `frontend/src/app/notebooks/page.tsx` | 1205 | Lista y selección; editor de notas; fuentes; compartición; flujos de importación | Alto | 5 |

### Backend

| Archivo | Líneas | Responsabilidades que separar gradualmente | Riesgo | Orden |
|---|---:|---|---|---:|
| `backend/app/services/ai_service.py` | 1053 | Configuración/proveedores; ensamblado del contexto; transporte/reintentos; parseo y validación de respuestas | Alto | 7 |
| `backend/app/services/ai_tools.py` | 961 | Registro y esquemas; ejecutores por dominio; bucle; confirmación, límites y resultados auditables | Muy alto | 9 |
| `backend/app/services/book_service.py` | 940 | Lectores por formato; extracción/fragmentación; procesamiento/persistencia; preguntas/resúmenes | Alto | 6 |
| `backend/app/api/v1/chat.py` | 783 | Políticas de pertenencia; serializadores; conversaciones/miembros; mensajes; archivos; entregas/presencia | Muy alto | 10 |
| `backend/app/api/v1/classes.py` | 764 | Permisos/serialización compartidos; grupos/miembros; mensajes/respuestas; eventos; compatibilidad classwork | Muy alto | 10 |
| `backend/app/api/v1/classwork.py` | 530 | Políticas de autor/miembro; temas/tareas; trabajo privado; adjuntos; comentarios y progreso | Muy alto | 11 |
| `backend/app/api/v1/learning.py` | 462 | Tarjetas/repetición; generación de tarjetas; quizzes/corrección; contratos de resultados | Alto | 8 |
| `backend/app/api/v1/assistant.py` | 451 | Perfil; historial; chat/adjuntos; confirmaciones; importación/exportación | Alto | 8 |
| `backend/app/api/v1/books.py` | 444 | Políticas de acceso y serialización; importación/procesamiento; progreso; preguntas y mensajes | Alto | 7 |
| `backend/app/api/v1/notebooks.py` | 444 | CRUD/compartición; fuentes; chat/historial; guardado de notas; permisos comunes | Muy alto | 9 |
| `backend/app/services/sync_service.py` | 357 | Orquestación; adaptadores por proveedor; reconciliación de tareas/cursos/notas; registros de sincronización | Alto | 8 |
| `backend/app/api/v1/auth.py` | 323 | Registro/login; perfil/usuario; recuperación y revocación; validación/seguridad comunes | Muy alto | 12 |

## Orden de trabajo recomendado

1. Esta rama: CI, mapa, smoke y línea base. No cambiar versiones, migraciones, comportamiento ni dependencias.
2. Consolidar pruebas de interacción de los módulos a extraer, incluyendo datos de usuario existentes, permisos, privacidad y cierre/reapertura; el smoke de rutas es la primera alarma, no cubre esos contratos.
3. Extraer presentaciones puras de Repaso/Ajustes/Académico, una responsabilidad y un commit cada vez. Mantener props, identifiers de layouts y callbacks.
4. Separar carga y presentación sin cambiar orden de efectos en Planificador, cuadernos y libro servidor. Comprobar persistencia de tareas, fechas y sincronización.
5. Tratar Clases, Chat y herramientas IA con pruebas de dos usuarios y fallos reales. Mantener eventos, confirmaciones y límites transaccionales.
6. Dejar motor de Office, lectura PDF, autenticación y CSS global para pasos con pruebas específicas de selección, deshacer, formatos, workers, móvil y privacidad.
7. Solo en una tarea autorizada posterior decidir el destino de los candidatos sin uso y sus dependencias; comparar comportamiento y revisar el diff. Esta tarea conserva todos ellos.

## Verificación de esta rama

El workflow nuevo ejecuta typecheck/lint, tests Python y smoke en push/PR. No modifica `release-desktop.yml`. El smoke registra una cuenta efímera en la API SQLite aislada, crea una clase/documento/cuaderno, visita rutas y aliases con escritorio y móvil e importa un PDF real en IndexedDB para abrir el lector. Captura `console.error`, `pageerror`, HTTP de navegación, redirecciones y contenido de la sección; rechaza pantallas vacías y errores de render. No silencia errores con listas de excepciones. Guarda resultados y capturas de fallo en un directorio temporal. No se llama a servicios IA reales ni se verifican sus credenciales.

Comandos: `npm run typecheck`, `npm run lint`, `npm run test:smoke` desde frontend; `python -m pytest tests -q` desde backend. Para reproducir el smoke de CI, construir primero con `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` y ejecutar con `SMOKE_WEB_MODE=start`. Las variables y los requisitos están documentados en AGENTS.md. La base SQLite prueba lógica y permisos, pero no sustituye pruebas específicas de PostgreSQL, ni aplica migraciones reales.

Resultado local en `limpieza/base`: typecheck correcto; lint correcto con los avisos existentes; 89 tests del backend correctos; build de producción correcto; smoke correcto con 52 combinaciones de ruta/tamaño (1440×960 y 390×844), sin errores de consola ni de ejecución. Se confirmó que `release-desktop.yml`, las versiones, los lockfiles y el código de la app no cambian. No se añadieron dependencias.

CI fija Ubuntu 24.04 para evitar cambios de imagen implícitos: en la primera ejecución, ubuntu-latest seleccionó 26.04 y Playwright 1.58.2 rechazó instalar Chromium. Se corrige el entorno de CI, sin actualizar dependencias ni tocar la aplicación.
