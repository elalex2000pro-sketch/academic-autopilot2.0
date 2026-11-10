# Pestañas de clase (1.3.41)

La clase sigue siendo un grupo entre alumnos. La vista conserva la carga de datos,
los handlers y la suscripción en tiempo real; se han extraído las secciones a
`frontend/src/components/class/`:

- `class-news-tab.tsx`: publicaciones, fijadas primero, respuestas y próximas entregas de siete días.
- `class-calendar-tab.tsx`: calendario, exámenes, edición y compartir fechas existentes.
- `class-people-tab.tsx`: compañeros, @usuario, administrador y abandono.
- `class-resources-tab.tsx`, `class-notebooks-tab.tsx`, `class-files-tab.tsx`: cuadernos compartidos y archivos existentes.
- `classwork-board.tsx`: Trabajo de clase conserva temas, estados, progreso, trabajos y comentarios.

`class-detail-view.tsx` conecta estas secciones y mantiene los diálogos y acciones
compartidos. El indicador utiliza `layoutId`; las transiciones laterales incluyen
`exit` y respetan la preferencia de movimiento reducido. Las pestañas permiten
desplazamiento horizontal en móvil y nunca se cierran al volver a pulsarlas.

La migración nueva `0023_class_message_replies` añade `parent_id` nullable con
clave foránea y borrado en cascada; conserva los mensajes existentes. El backend
valida pertenencia y que la publicación respondida sea de la misma clase.
Si el administrador abandona un grupo con compañeros, la administración pasa al
miembro más antiguo. El último miembro utiliza la confirmación de eliminación.
El arranque del backend ejecuta `alembic upgrade head`.

## Verificación

- `npm run typecheck`, `npm run lint` y `npm run build` en frontend: correctos;
  lint mantiene advertencias previas de otros módulos.
- `python -m pytest -q` en backend: 81 tests correctos.
- Alembic `upgrade 0022_peer_classwork:head --sql`: SQL PostgreSQL generado correctamente sin conexión a producción.
- `node tests/class-tabs-e2e.cjs`: dos sesiones Chrome contra la API aislada;
  publicaciones y respuestas en tiempo real, respuestas al recargar, fijadas
  primero, próximas tareas/exámenes y cinco pestañas con contenido en escritorio
  y móvil. No usa cuentas ni datos de producción.
- `node tests/classwork-e2e.cjs`: creación por un compañero, estados, privacidad,
  compartir trabajo, comentarios en directo y progreso correctos.

Los E2E requieren la API aislada `tests/chat_test_server.py` en el puerto 8000 y
la aplicación compilada en localhost:3000. Las pruebas de navegador usan SQLite
temporal; no sustituyen la comprobación de la migración en PostgreSQL desplegado.
