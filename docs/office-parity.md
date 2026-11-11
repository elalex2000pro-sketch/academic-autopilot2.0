# Paridad de Academic Office con Word y LibreOffice Writer

Auditoría del editor de documentos en la revisión `014fe21`, 11 de noviembre de 2026. La referencia de organización es Word de escritorio para Windows. Las pestañas opcionales y contextuales aparecen al final del inventario porque su visibilidad depende de la versión, el dispositivo, la selección o los complementos. Para LibreOffice Writer se incluyen también funciones de sus menús Tabla, Formulario, Estilos y Herramientas. [Cinta y atajos de Word](https://support.microsoft.com/en-us/accessibility/word/keyboard-shortcuts-in-word) · [Menús de Writer](https://help.libreoffice.org/latest/en-GB/text/swriter/main0100.html?DbPAR=WRITER&System=UNIX)

## Cómo leer el inventario

- **Hecho** indica que existe una ruta de uso para la función descrita en el editor activo.
- **Parcial** indica que existe una parte de la función, una implementación aproximada o un componente instalado cuya interfaz no está conectada.
- **Falta** indica que la función no se encontró en la ruta de Academic Office auditada. Los estados proceden de lectura de código y no certifican interoperabilidad con Word o Writer.

| Referencia | Archivo y responsabilidad |
| --- | --- |
| W | [writer-editor.tsx](../frontend/src/components/office/writer-editor.tsx), editor CKEditor 5 activo, comandos, menús, regla y estado de vista. |
| T | [document-editor.tsx](../frontend/src/components/office/document-editor.tsx), editor Tiptap con StarterKit, Underline y Link. No se encontraron llamadas JSX a este componente en el frontend. |
| C | [writer-editor.css](../frontend/src/components/office/writer-editor.css), superficie editable, aspecto de hoja, barras e impresión de la vista. |
| V | [academic-office-view.tsx](../frontend/src/components/academic-office-view.tsx), carga de W en cliente, borrador local, apertura y exportación. Lo usan `/office` y la vista de Documentos. |
| E | [office-doc.ts](../frontend/src/lib/office-doc.ts), conversión de texto, HTML descargable, envoltorio HTML para `.doc` e impresión. |

El inventario refleja W y su integración con V y E. T ya contiene formato básico, encabezados, listas y enlaces. Es una base para evaluar una alternativa de motor y sus funciones no se suman al editor activo.

## Lista de comprobación

### Archivo

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Nuevo documento y cambiar título | Hecho | W y V. Documento inicial y título editable. |
| Abrir HTML, HTM y TXT | Hecho | V y E. HTML se entrega al editor y TXT se convierte a párrafos. |
| Abrir Markdown | Parcial | V y E. Acepta `.md` y lo abre como texto. Falta interpretar su sintaxis. |
| Guardar y autoguardar | Hecho | V. Conserva un borrador de documento en `localStorage` del dispositivo. |
| Guardar como copia independiente, recientes y biblioteca de documentos | Parcial | W y V. «Guardar como» cambia el nombre del mismo borrador. Faltan copias, historial de archivos y gestión de varios documentos. |
| Recuperación, historial de versiones y sincronización | Parcial | V. Recupera el último borrador local. Faltan versiones, recuperación tras fallos de guardado y sincronización. |
| Plantillas y portadas reutilizables | Falta | V tiene un documento inicial fijo, sin catálogo ni plantillas de usuario. |
| Propiedades y metadatos del documento | Parcial | W y V. Hay nombre e información básica. Faltan autor, asunto, palabras clave y metadatos editables persistentes. |
| Imprimir y vista previa del sistema | Hecho | W, V y E. Abre la impresión del navegador desde una ventana nueva. |
| Exportar PDF con la configuración del documento | Parcial | E. El PDF depende de «Guardar como PDF» del navegador, con A4 y 2 cm fijos. |
| Exportar HTML | Hecho | E. Descarga un documento HTML con CSS propio. |
| Exportar `.doc` heredado | Parcial | E. HTML con extensión `.doc` y MIME `application/msword`. Puede abrirse en editores compatibles con ese HTML. |
| Importar y exportar DOCX nativo | Falta | V y E son los puntos de integración. El selector no admite DOCX y el exportador actual no escribe OOXML. |
| Importar y exportar ODT | Falta | Sin lector ni escritor de OpenDocument Text. |
| Exportar TXT | Falta | E dispone de conversión de TXT a HTML, sin descarga en sentido inverso. |
| Compartir, coeditar y controlar permisos de documentos Office | Falta | El flujo de V guarda localmente. Las funciones de otras secciones de la app quedan fuera de esta auditoría. |

### Inicio

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Negrita, cursiva, subrayado, tachado, subíndice y superíndice | Hecho | W. Comandos y controles de formato. |
| Fuente, tamaño, color de letra, resaltado y limpiar formato | Hecho | W. Selectores y comandos. |
| Alineación, sangría e interlineado | Hecho | W. Cuatro alineaciones, sangría y cuatro interlineados predefinidos. |
| Espacio anterior/posterior, tabuladores, bordes y sombreado de párrafo | Falta | Sin controles específicos de párrafo. La regla actual modifica márgenes horizontales. |
| Listas con viñetas, numeradas y de tareas | Hecho | W. Plugins List, ListProperties y TodoList. |
| Listas multinivel y numeración de títulos | Parcial | W. Hay anidación y propiedades de numeración. Faltan esquemas por nivel, vínculos con estilos de título y control de reinicios entre secciones. |
| Estilos de párrafo y carácter editables | Parcial | W. Párrafo, títulos 1–4 y estilos predefinidos para interlineado. Faltan estilos nombrados por el usuario, herencia y actualización global. |
| Cortar, copiar, pegar y pegar como texto | Parcial | W. Los comandos dependen de permisos del navegador. PasteFromOffice está cargado y la fidelidad del pegado aún necesita pruebas. |
| Deshacer, rehacer y seleccionar todo | Hecho | W. Comandos del editor y menú Editar. |
| Buscar y reemplazar | Parcial | W. La barra busca con `window.find` hacia delante y atrás. El menú anuncia reemplazo y se carga el plugin, pero la barra no ejecuta reemplazos. |
| Copiar formato, ordenar párrafos y mostrar marcas de formato | Falta | El plugin ShowBlocks de W no equivale a mostrar espacios, tabuladores y marcas de párrafo. |

### Insertar

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Insertar y editar tablas | Hecho | W. Filas, columnas, combinación y división de celdas, propiedades y redimensionado de columnas. |
| Tablas avanzadas | Parcial | W. Falta completar encabezados repetidos al paginar, controles de autofit, ordenar, fórmulas y conversión entre texto y tabla. |
| Imágenes desde archivo o URL, tamaño, texto alternativo y pie | Hecho | W. Inserción, estilos en línea/bloque/lateral y barra contextual. |
| Recorte, giro, ajuste de texto avanzado, posición y capas de imagen | Parcial | W. La colocación actual se limita a estilos de imagen. Faltan anclajes, recorte, giro y capas. |
| Formas, cuadros de texto, diagramas, gráficos, iconos y objetos incrustados | Falta | Sin herramientas de dibujo o edición de objetos de documento. |
| Hipervínculos y marcadores | Parcial | W. Hay inserción de enlaces y plugin Bookmark cargado. El menú y barra propios no exponen gestión de marcadores. |
| Caracteres especiales, línea horizontal, cita en bloque y código | Hecho | W. Menús y selector de caracteres. |
| Encabezados y pies de página | Falta | Incluye variantes de primera página, pares/impares y vínculo a sección anterior. |
| Números de página, fecha y campos de documento | Falta | Falta insertar campos actualizables como PAGE y NUMPAGES. El contador de la barra de estado es informativo. |
| Salto manual de página | Parcial | W y C. Inserta un marcador con PageBreak. Falta hacer que la edición y la salida impresa respeten el mismo salto. |
| Portada y página en blanco | Parcial | W. Un salto manual permite iniciar contenido nuevo. Faltan galería de portadas y una acción de página en blanco con paginación efectiva. |
| Ecuaciones editables y numeración de ecuaciones | Falta | Los caracteres especiales y bloques de código no representan fórmulas estructuradas. |
| Multimedia e inserción HTML | Parcial | W. MediaEmbed y HtmlEmbed están cargados. La interfaz propia expone inserción de HTML de formulario, sin un flujo completo de edición multimedia. |

### Diseño

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Temas, conjuntos de estilos, paletas y fuentes del documento | Parcial | W. Hay selectores de formato y estilos fijos. Falta aplicar y guardar un tema de documento con estilos coordinados. |
| Espaciado global del documento | Parcial | W. Interlineado por párrafo. Faltan conjuntos globales y excepciones por estilo. |
| Marca de agua, color de página y bordes de página | Falta | Los colores de C son parte de la interfaz. Falta configuración del documento y su salida. |

### Disposición

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Tamaño de papel y orientación | Parcial | W y C. A4 fijo con retrato y horizontal en la vista. V no guarda esos valores y E imprime con un A4 fijo. |
| Márgenes y regla | Parcial | W y C. Cuatro márgenes editables y regla horizontal arrastrable. Falta persistencia y aplicar los valores al imprimir y exportar. |
| Saltos de sección y cambios de configuración por sección | Falta | Incluye continuos, página siguiente y par/impar. El marcador de salto de página de W es una operación distinta. |
| Columnas y saltos de columna | Falta | Sin modelo de columnas de texto. Las columnas de tabla son independientes. |
| Numeración de líneas y separación silábica | Falta | Sin configuración de documento para estas funciones. |
| Mantener con el siguiente, evitar viudas y huérfanas, y control de cortes en tablas | Falta | Sin controles del editor ni un motor de composición que los aplique. |
| Organizar objetos, alinear, agrupar y ordenar capas | Falta | W coloca imágenes mediante estilos básicos. Falta un modelo de objetos posicionados. |

### Referencias

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Tabla de contenido actualizable | Parcial | W. El navegador extrae títulos y salta a ellos. Falta insertar la tabla en el documento con enlaces y, cuando corresponda, páginas. |
| Notas al pie y notas finales | Falta | Faltan anclas, numeración, edición y su posición en la salida. |
| Índice alfabético y entradas de índice | Falta | Sin marcas ni generación del índice. |
| Citas bibliográficas y bibliografía | Falta | Sin registro de fuentes, estilos de citación ni actualización. |
| Títulos numerados, referencias cruzadas e índices de tablas/figuras | Parcial | W. La barra contextual permite pies de imagen. TableCaption está cargado para tablas, sin botón propio. Faltan numeración, campos vinculados y listas generadas. |
| Tabla de autoridades | Falta | Sin marcado ni generación. |

### Revisar

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Contar palabras y caracteres | Hecho | W. Barra de estado y comando de recuento. |
| Ortografía e idioma de corrección | Parcial | W. Ajusta `lang` y habilita `spellcheck` del navegador. Faltan corrector propio, idioma por fragmento, diccionarios y gramática. |
| Sinónimos, traducción y lectura en voz alta | Falta | Sin controles dedicados en el editor de Office. |
| Comentarios anclados, respuestas y resolución | Falta | Sin almacenamiento de hilos ni anclas persistentes. |
| Control de cambios con autor, aceptar y rechazar | Falta | Deshacer y rehacer de W son historial de edición local. |
| Comparar y combinar documentos | Falta | Sin comparación estructural ni combinación de revisiones. |
| Restringir edición y proteger documento | Falta | Sin bloqueo por sección ni protección documental. |
| Comprobar accesibilidad | Parcial | W admite texto alternativo y encabezados. Falta un comprobador con diagnóstico y correcciones. |

### Vista

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Edición continua, zoom y pantalla completa | Hecho | W y C. Zoom, pantalla completa nativa o modo enfocado y superficie continua. |
| Vista de impresión con páginas reales | Parcial | W y C. Una sola superficie con un fondo repetido a la altura de la hoja y un contador aproximado calculado desde `scrollHeight`. No hay fragmentación efectiva en edición. |
| Regla y panel de navegación | Parcial | W. Regla horizontal de márgenes y navegación por títulos 1–4. Faltan regla vertical, miniaturas y búsqueda de navegación integrada. |
| Vista de lectura, esquema editable, borrador y varias páginas | Parcial | W. El modo enfocado y el navegador cubren parte de la experiencia. Faltan modos dedicados, edición de jerarquía, dos páginas y ajuste a página. |
| Código fuente HTML y paneles de propiedades, estilos y galería | Hecho | W. Son herramientas presentes que también acercan el flujo a Writer. |
| Ventanas, dividir y comparar en paralelo | Parcial | W abre otra ventana de la app. Falta dividir una vista y gestionar documentos lado a lado con desplazamiento coordinado. |
| Atajos de teclado y navegación de cinta | Parcial | W maneja guardar, guardar como, abrir, imprimir, nuevo y buscar con Ctrl/Cmd dentro del editor. Faltan secuencias de cinta, personalización y pruebas de accesibilidad por teclado. |

### Correspondencia

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Combinación de correspondencia, campos, destinatarios, reglas y vista previa | Falta | La hoja de cálculo de Office no está conectada a un motor de combinación documental. |
| Sobres, etiquetas y salida por lotes | Falta | Sin plantillas de sobres, etiquetas ni ejecución por destinatario. |

### Dibujar

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Lápices, resaltador de tinta, borrador, lazo y conversión de tinta | Falta | El resaltado textual de W modifica formato de texto. Word ofrece herramientas de tinta según dispositivo y versión. [Dibujar con tinta en Office](https://support.microsoft.com/en-gb/office/draw-and-write-with-ink-in-office) |

### Programador y formularios

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Controles de formulario | Parcial | W inserta HTML para texto, casillas, áreas, listas y botones. Faltan controles de contenido OOXML/ODF, propiedades, validación, modo diseño y protección. |
| Macros, automatización y XML personalizado | Falta | Sin motor de macros, controles ActiveX ni editor de XML vinculado. |
| Complementos y extensibilidad de usuario | Falta | Los plugins instalados en W son parte del desarrollo de la app. Falta una interfaz de administración de complementos. [Pestaña Programador de Word](https://support.microsoft.com/en-us/word/show-the-developer-tab-in-word) |

### Ayuda

| Función | Estado | Evidencia o alcance pendiente |
| --- | --- | --- |
| Acerca de, guía de atajos y documentación | Hecho | W. Menú Ayuda con las tres entradas. |
| Búsqueda de comandos, formación integrada y comentarios al producto | Falta | Sin buscador de comandos ni centro de ayuda equivalente en Office. |

### Pestañas contextuales y personalización

| Grupo | Estado | Dónde se evalúa |
| --- | --- | --- |
| Diseño y disposición de tabla | Parcial | Insertar → tablas. W tiene barra contextual de tablas. |
| Formato de imagen | Parcial | Insertar → imágenes. W tiene barra contextual de imágenes. |
| Formato de forma, WordArt, SmartArt, gráficos y sus pestañas de diseño | Falta | Insertar → objetos. |
| Encabezado y pie de página | Falta | Insertar → encabezados y pies. |
| Herramientas de ecuación | Falta | Insertar → ecuaciones. |
| Accesibilidad contextual | Parcial | Revisar → accesibilidad. |
| Cinta y barra de acceso rápido personalizables | Falta | La estructura de menús en W es fija. Los grupos opcionales de Microsoft 365 y las pestañas de terceros varían por instalación y se consideran ampliaciones del inventario, sin equivalencia directa en Office. [Personalizar la cinta](https://support.microsoft.com/en-us/word/customize-the-ribbon-in-word) · [Pestañas contextuales de tabla](https://support.microsoft.com/en-us/word/sort-the-contents-of-a-table) · [Cinta de encabezado y pie](https://support.microsoft.com/en-us/accessibility/word/use-a-screen-reader-to-create-headers-or-footers-in-word) |

**Comprobación de cobertura.** Archivo, Inicio, Insertar, Diseño, Disposición, Referencias, Correspondencia, Revisar, Vista y Ayuda están representadas. También se revisaron Dibujar, Programador, Complementos y las pestañas contextuales. Los nombres de Word pueden variar por localización. [Cinta de Word](https://support.microsoft.com/en-us/accessibility/word/keyboard-shortcuts-in-word) · [Guía de inicio de Word](https://support.microsoft.com/en-us/word/word-for-new-users)

## Decisiones técnicas

### A. Paginación real y licencia

La meta debe distinguir **vista previa paginada** de **edición directa sobre páginas**. La primera compone una instantánea del documento en hojas reales. La segunda debe recomponer el flujo al escribir y mantener selección, cursor, historial, composición IME y navegación al cruzar páginas.

| Alternativa | Pros | Contras |
| --- | --- | --- |
| CKEditor actual, CSS de impresión y vista previa con Paged.js (MIT) | Reutiliza la edición, aplica tamaño y márgenes, produce hojas visibles y permite ensayar cabeceras, pies y numeración. Puede ejecutarse localmente. | La edición sigue siendo continua. Hay que verificar CSS de fragmentación, tipografías, tablas largas, notas y concordancia entre vista previa y PDF. [Paged.js](https://github.com/pagedjs/pagedjs) |
| Paginación propia sobre el modelo de CKEditor o un motor ProseMirror/Tiptap | Permite controlar la experiencia de edición y el formato persistido. Mantener un único árbol de contenido evita dividir el historial y la selección entre editores. | Es la ruta de mayor esfuerzo. Hay que medir bloques y líneas, dividir párrafos y tablas, recomponer tras cambios de fuente e imagen, virtualizar documentos largos y probar teclado, IME, pegado y accesibilidad. Migrar al Tiptap del repositorio exige recuperar las funciones de W. |
| CKEditor Pagination con licencia comercial que incluya el complemento | Aprovecha PageBreak y ofrece detección de cortes y navegación por páginas. Puede reducir el trabajo para previsualizar cortes del exportador. | El complemento muestra cortes de exportación. Hay que probar si su interacción cumple la edición tipo Word solicitada y revisar compatibilidad web, términos, coste y configuración del exportador. El render de exportación usa su propio servicio y puede diferir del navegador. [Guía de Pagination](https://ckeditor.com/docs/ckeditor5/latest/features/pagination/pagination.html) |

**Licencia.** W carga CKEditor 5 por npm con `licenseKey: "GPL"`. CKSource ofrece el núcleo bajo GPL 2+ y permite el plugin de salto manual en proyectos que cumplan sus condiciones GPL. La clave GPL no incluye su complemento premium Pagination. La paginación propia y una vista con Paged.js son soluciones independientes del complemento. Si se mantiene CKEditor, hay que comprobar la compatibilidad de la distribución web y Electron con las obligaciones de la GPL o conseguir términos comerciales apropiados. En la revisión auditada no figura un archivo de licencia del proyecto en Git. La visibilidad pública del repositorio y el valor de configuración no establecen por sí solos la licencia aplicable al conjunto. [Licencia de CKEditor](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-and-legal.html) · [Activación y opciones de distribución](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-key-and-activation.html)

**Recomendación.** Tras resolver la licencia del motor, empezar por un modelo versionado que guarde contenido, ajustes de papel, secciones y recursos. Migrar el borrador HTML existente sin perder texto ni formato admitido. Usar la misma instantánea para la vista previa paginada y la impresión, esperando fuentes e imágenes antes de componer. Probar A4 y Carta, secciones verticales y horizontales, tablas que atraviesen una página, viudas y huérfanas y numeración reiniciada. Para edición directa, decidir con una prueba sobre documentos de 20–50 páginas que mida recomposición, cursor y fluidez. Evitar un editor independiente por página.

### B. DOCX nativo con bibliotecas permisivas

Un DOCX es un paquete ZIP OOXML con tipos de contenido, relaciones y partes WordprocessingML. El contrato de importación y exportación debe definir qué atributos, estilos y elementos se conservan al hacer el viaje de ida y vuelta. Un archivo puede ser DOCX válido y perder semántica o maquetación durante ese viaje. [Estructura de WordprocessingML](https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document)

| Alternativa | Pros | Contras |
| --- | --- | --- |
| Mammoth.js (BSD-2-Clause) para importar y `docx` (MIT) para exportar en cliente | Conversión semántica a HTML con mapas de estilos para la entrada. Generación DOCX nativa desde secciones, párrafos, estilos, listas y tablas para la salida. Funciona en navegador y Electron con carga diferida. | Mammoth prioriza estructura sobre apariencia. Sus avisos y elementos omitidos deben llegar al usuario. Requiere sanitizar su HTML antes de editar o imprimir. `docx` necesita un mapeo explícito desde el modelo y no aporta un importador general. [Mammoth.js](https://github.com/mwilliamson/mammoth.js) · [docx](https://github.com/dolanmiu/docx) · [Modelo de documento de docx](https://github.com/dolanmiu/docx/blob/master/docs/usage/document.md) |
| `python-docx` (MIT) en el backend | Ya está fijado en [requirements.txt](../backend/requirements.txt#L33). Permite leer y escribir párrafos, tablas, estilos y secciones. Puede encajar con exportaciones en servidor que requieran uniformidad. | Implica enviar los archivos al servidor, autenticación, límites y manejo temporal. Las partes avanzadas fuera de la API de alto nivel requieren trabajo OOXML. No es un motor de composición de páginas. [python-docx](https://github.com/python-openxml/python-docx) |
| Mapeo explícito de partes OOXML sobre un lector ZIP/XML permisivo | Permite conservar identificadores, estilos, secciones y relaciones con más control. Es la mejor base si se exige fidelidad avanzada y diagnóstico por elemento. | Mayor coste y mantenimiento. Hay que resolver relaciones, definiciones de listas, estilos heredados, imágenes, campos, notas y diferencias entre Word y Writer. Requiere un corpus amplio de archivos reales. |

**Recomendación.** Entregar primero Mammoth.js y `docx` como adaptadores locales del documento versionado. Definir compatibilidad inicial para texto, títulos, énfasis, listas, tablas, enlaces e imágenes. Cargar el importador al abrir un DOCX, validar el paquete, limitar tamaños comprimidos y expandidos, bloquear relaciones externas y filtrar el HTML con una lista de elementos y atributos permitidos. Informar de lo que no se conserva antes de sustituir el borrador. Exportar con extensión `.docx` y MIME OOXML y comprobar que Word y Writer abran el resultado sin reparación. Conservar HTML y texto como formatos explícitos. Cuando se añadan secciones, campos, notas o revisiones, ampliar el mapeo por partes y su contrato de fidelidad. Verificar los casos con ida y vuelta Word → app → Writer y Writer → app → Word. Las bibliotecas citadas resuelven DOCX. ODT necesita su propio adaptador y matriz de pruebas.

## Plan por fases

Estimaciones de ingeniería para una persona, en días laborables, incluyendo pruebas y revisión. Los rangos dependen de la licencia, la fidelidad acordada y la complejidad del corpus. Cada fase se entrega con criterios propios antes de pasar a la siguiente.

| Fase | Tamaño | Entrega y comprobación |
| --- | --- | --- |
| 0. Base y decisiones | S · 2–4 días | Resolver licencia y ruta técnica, fijar corpus de trabajos de estudiantes y esquema versionado. Recuperar borradores existentes y comprobar el ciclo guardar/cerrar/abrir con documentos antiguos. |
| 1. Entregar y editar trabajos | M · 7–12 días | DOCX local en ambos sentidos, HTML y TXT explícitos, copias y recuperación, buscar/reemplazar real, plantillas de informe y práctica, atajos esenciales. Word y Writer abren el DOCX sin reparación y se conservan los elementos del contrato inicial. |
| 2. Preparar la impresión | M–L · 10–18 días | Vista previa en hojas reales, A4/Carta, márgenes persistentes, orientación, saltos, cabeceras, pies, numeración y PDF. Vista previa y PDF coinciden en cortes en el corpus de impresión. Las opciones avanzadas por sección se completan en la fase 4. |
| 3. Redactar trabajos académicos | L · 15–25 días | Estilos editables, listas multinivel, tabla de contenido, notas al pie y finales, ecuaciones, citas y bibliografía. Comprobar renumeración, vínculos y exportación de cada elemento acordado. |
| 4. Maquetación e intercambio avanzado | XL · 20–35 días | Secciones y columnas, tablas largas con encabezados repetidos, imágenes ancladas, formas, referencias cruzadas, índices y ODT. Si se aprueba edición directa paginada, estimar **15–30 días adicionales** tras la prueba de fase 2. |
| 5. Revisar y compartir | XL · 20–35 días | Comentarios, control de cambios, comparación, versiones, accesibilidad y corrección avanzada. Probar conservar autoría y anclas, aceptar/rechazar cambios y abrir documentos revisados en ambos editores. |
| 6. Paridad de uso especializado | XL · 20–40 días según selección | Correspondencia, formularios avanzados, tinta, automatización, personalización de cinta y opciones específicas de impresión. Priorizar por demanda y validar cada función con un ejemplo real. |

## Cinco decisiones para aprobar

1. **Licencia y motor.** Elegir una distribución compatible con GPL, contratar CKEditor con las funciones necesarias o sustituir el motor por una alternativa permisiva. Recomendación: resolverlo antes de ampliar W.
2. **Experiencia de página.** Elegir vista previa paginada con edición continua como primera entrega o exigir edición directa sobre hojas desde el inicio. Recomendación: vista previa primero y decisión de edición directa tras la prueba.
3. **Fidelidad del DOCX.** Aprobar un contrato inicial semántico con avisos de pérdidas o exigir conservar secciones, campos, notas y revisiones desde la primera versión. Recomendación: contrato semántico y ampliar con el corpus.
4. **Dónde se procesan los archivos.** Elegir importación y exportación local o autorizar un backend de conversión para casos que lo requieran. Recomendación: local con Mammoth.js y `docx`, con backend sujeto a una decisión posterior.
5. **Primer objetivo de entrega.** Aprobar DOCX, plantillas y preparación para imprimir como prioridad, o adelantar ODT, referencias académicas o revisión colaborativa por necesidad de tus estudiantes. Recomendación: ejecutar las fases 0–2 y revisar prioridades antes de la fase 3.
