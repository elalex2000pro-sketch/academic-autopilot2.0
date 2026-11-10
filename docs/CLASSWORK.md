# Trabajo de clase entre compañeros

La sección se conecta a `ClassworkBoard` desde la vista existente. Los componentes de tareas, trabajo personal y temas están en `frontend/src/components/class/`. No hay roles docentes, calificaciones de compañeros ni vista de profesor: la nota de Mi trabajo es texto personal.

El router `backend/app/api/v1/classwork.py` comprueba membresía en todas las operaciones. Solo autor o dueño editan tareas/temas; cada usuario escribe exclusivamente su propia fila de trabajo. Los archivos personales tienen almacenamiento separado de los documentos públicos de la clase y solo se descargan con acceso al trabajo. Compartir permite leerlo a los miembros, y desactivar el interruptor revoca ese acceso. Los avisos WebSocket no contienen notas ni archivos privados. Las respuestas de tareas no se almacenan en la caché de fallback del cliente.

La migración nueva 0022 conserva las filas y fechas de completions anteriores y las convierte en `done` al añadir la columna; después establece `pending` como valor por defecto para trabajos nuevos. No se modifican migraciones aplicadas. Se validó el SQL generado para PostgreSQL, sin ejecutar la migración sobre una base de producción.

Pruebas: `python -m pytest -q` desde backend. Los tests de permisos incluyen un dueño, un compañero y un tercero no miembro; verifican privacidad, compartir/descompartir, descargas, estados y comentarios. La prueba de navegador `node tests/classwork-e2e.cjs` desde frontend usa el servidor aislado `backend/tests/chat_test_server.py` en puerto 8000 y el frontend compilado en puerto 3000; requiere Chrome. Rechaza servidores cuyo health no indique el entorno aislado. Comprueba creación entre compañeros, estados, privacidad respecto al dueño, compartir, comentarios en directo y progreso.

Los adjuntos generales se seleccionan entre los archivos ya subidos a la clase. Los personales se suben desde Mi trabajo, hasta 25 MB. Como el resto de archivos del proyecto, requieren un FILES_DIR persistente para sobrevivir a redespliegues.
