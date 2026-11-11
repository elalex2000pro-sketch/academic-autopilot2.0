# Office fase 1A

Biblioteca privada de documentos y hojas. Se mantiene CKEditor y no se añaden dependencias.

- API `/api/v1/office/documents`: búsqueda y orden (`updated`, `created`, `title`), creación, lectura, actualización PUT, duplicado, borrado, historial, checkpoint y restauración.
- `content` contiene HTML en documentos y JSON de celdas en hojas. `schema_version=1`; `settings` conserva papel A4, orientación y márgenes en milímetros. Las carpetas son etiquetas opcionales por documento.
- Límite de 5 MiB sobre el payload JSON codificado en UTF-8, incluidos los recursos inline.
- La revisión aumenta en cada escritura. PUT y restauración requieren la revisión base. Una comparación atómica evita sobrescrituras entre procesos y responde 409 cuando cambió. Todas las rutas filtran por propietario.
- El historial conserva la creación, instantáneas cada dos minutos con cambios, al volver a la biblioteca, al abandonar la vista y antes/después de restaurar. No se crea una instantánea por pulsación. El cierre del navegador usa keepalive como mejor esfuerzo; un cierre abrupto o un payload grande puede impedir esa petición, por lo que se conserva el borrador local.
- Autoguardado a los 1200 ms; reintento cada 15 segundos y al recuperar conexión. Los borradores nuevos y por documento se separan por usuario. Un conflicto conserva el borrador y ofrece una copia independiente.
- La biblioteca ofrece los borradores antiguos sin borrarlos antes de obtener confirmación del servidor. La clave de importación persistente evita duplicados en los reintentos. Las hojas conservan fórmulas y documentos conservan su HTML.
- Guardar como crea un documento independiente. HTML/TXT usan `files:save` en Electron y descarga en navegador. Abrir HTML/HTM/TXT/MD usa `files:open` con `mode=pick-office`, sin alterar la apertura de adjuntos existente. Markdown sigue abriéndose como texto. PDF mantiene el flujo de impresión; DOCX se reserva para 1B.

## Despliegue

Aplicar `alembic upgrade head` en el backend antes de usar la biblioteca nueva. La migración `0025_office_documents` crea tablas nuevas y no modifica migraciones anteriores. La compilación desktop debe actualizarse para disponer del selector nativo nuevo. No se ha aplicado esta migración a una base de datos de producción desde esta tarea.

## Comprobaciones

- `npm run typecheck`, `npm run lint` y compilación del frontend.
- Suite completa del backend y `tests/test_office.py`: permisos entre usuarios, historial, restauración, conflictos, duplicado, límite e importación idempotente sin pérdida de HTML.
- `node tests/office-e2e.cjs` desde `frontend/`: Chrome contra la API SQLite aislada `tests/chat_test_server.py`, migración, edición, cierre/reapertura, duplicado, restauración, descarga/apertura HTML, borrador sin conexión, reintento, conflicto y biblioteca móvil.
- `node desktop/office-files.test.cjs`: handlers IPC con archivos temporales reales, diálogos simulados y regresión de adjuntos del chat. La interacción manual con ventanas nativas no forma parte de esta prueba automatizada.
