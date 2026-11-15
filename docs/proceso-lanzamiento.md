# Lanzamientos: propuesta implementada, sin publicar una versión

1. Tras autorización, preparar un PR con las cinco versiones iguales:
   frontend/desktop package.json y package-lock.json (incluida packages[""]),
   frontend/public/version.json. No sobrescribir NEXT_PUBLIC_APP_VERSION con
   otra versión. En el candidato poner enabled:false en version.json: la web
   no debe anunciarlo antes de la aprobación. La puerta del tag también lo exige.
   Copiar docs/releases/PLANTILLA.md a docs/releases/X.Y.Z.md:
   de 1 a 8 viñetas en español sencillo, sin nombres de archivos ni detalles
   internos. Conservar los tres apartados; quitar viñetas que no apliquen.
2. Ejecutar validación de versiones, tests de lanzamiento/actualizador,
   typecheck, lint, build, backend, smoke y recorridos afectados. Fusionar solo
   con CI y ambos Vercel verdes. No etiquetar un commit de la rama de trabajo.
3. Con autorización para preparar el borrador, crear vX.Y.Z sobre main actual.
   Solo las etiquetas activan Release Desktop. El workflow vuelve a comprobar
   versiones/etiqueta, último CI push de ese SHA en main y los dos contextos
   Vercel exactos. Un estado ausente, pendiente o fallido detiene el proceso.
   Si el CI aún no terminó, esperar y reejecutar el workflow, sin mover el tag.
4. Actions construye Windows x64/macOS x64 y crea exclusivamente una release
   BORRADOR. No hay paso de publicación automática ni disparador release/**.
   No sustituir assets de una release publicada. El EXE, blockmap y latest.yml
   deben corresponder al mismo build; igual con ZIP/DMG/latest-mac.yml.
5. Revisar el borrador y probar instalar sobre una copia de 1.3.46: versión
   igual, instalada superior y nueva disponible; descarga interrumpida,
   reinicio, documentos con cambios, sesión y PDF locales conservados.
   El borrador no llega al actualizador estable; para probar el transporte
   hace falta un canal/servidor local aislado o equipo de pruebas dedicado.
   No publicar temporalmente para probar. No cambiar appId, GUID ni almacén.
6. Solo después de aprobación final explícita del propietario, un operador
   autorizado publica el borrador estable como Latest. GitHub no impone aquí
   una revisión humana: se garantiza que el workflow solo crea borradores;
   publicar requiere esa acción separada. Comprobar de nuevo CI/Vercel/SHA.
   Mantener permisos de escritura limitados a los responsables.
7. El cuerpo Markdown sirve a GitHub Releases y a la app de escritorio. El
   workflow genera además version.json adjunto con las mismas viñetas y el
   tamaño REAL del EXE (stat), sin fecha de publicación inventada. Tras publicar,
   reutilizar ese manifiesto en la web mediante un PR/despliegue autorizado y
   poner publishedAt con la fecha real y activar el aviso (enabled:true o
   ausencia de ese campo). No anunciar un borrador en la web.
   Hasta tener artefacto real, sizeBytes=null: no mostrar un tamaño ficticio.
   latest*.yml lo genera electron-builder con los tamaños y hashes reales.

## Reversión

Restaurar el despliegue web anterior y el manifiesto correspondiente; retirar
la release defectuosa de las publicaciones públicas para frenar descargas.
Marcar una versión antigua Latest no basta para todos los clientes. No mover
ni reutilizar la etiqueta retirada, no borrar datos locales ni desinstalar
como solución. Electron impide bajar versión automáticamente; un instalador
ya descargado podría aplicarse al cerrar. Publicar un parche superior con la
corrección (o código anterior compatible), tras repetir las comprobaciones.

## Alcance y costes

Sin servicios ni dependencias nuevas. Usa Actions existente, sujeto a cuotas;
los runners de Windows/macOS solo empiezan tras superar la puerta de control.
Firma Windows y firma/notarización macOS siguen sin estar configuradas aquí:
validar avisos del sistema antes de distribuir; no se certifica su ausencia.
No se han creado tags/releases ni cambiado la versión 1.3.46 en esta tarea.

En este Windows se pueden ejecutar tests, generar/inspeccionar el instalador
y preparar un ensayo aislado. No se debe reemplazar tu instalación personal
ni reiniciarla sin autorización adicional. La prueba completa desde 1.3.46
necesita un candidato con versión superior (no creado ahora) y un canal de
pruebas aislado; puedo automatizarla con esa autorización y un entorno seguro.
Tu parte imprescindible: aprobación final y valoración de los avisos/experiencia
en tu equipo. macOS/Gatekeeper requiere un Mac de pruebas, no este Windows.

## Verificación de esta tarea

14 tests de lanzamiento/actualizador correctos; build y typecheck correctos;
lint con los siete avisos anteriores; smoke de escritorio/móvil: 56 comprobaciones
correctas. YAML, disparadores, permisos y condición draft-only verificados.
La puerta CI/Vercel acepta también los resultados reales de main consultados
en solo lectura. El generador coincide con el EXE local: 112.774.269 bytes.
Versiones: 1.3.46 sin cambios. No se ejecutó Release Desktop ni se creó ninguna
etiqueta/release. La ejecución real del workflow y la actualización nativa desde
1.3.46 quedan pendientes del futuro candidato y autorización; no se simulan
como verificadas. Artefactos locales del smoke: %TEMP%/release-process-7ypk_c1f.
