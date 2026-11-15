# Office 409: coordinación de guardados

Rama `fix/office-conflicto-guardado`, desde main `046f60d` (PR #7).

## Causa confirmada antes de modificar la aplicación

Se amplió `frontend/tests/office-e2e.cjs` conservando sus aserciones originales.
La traza identifica peticiones, revisiones, respuestas, ruta y documento de
navegador; no registra cabeceras ni credenciales. Contra la API SQLite aislada
y el build de main se reprodujo la espera fallida de «Sin conexión».

Secuencia del documento importado, sin otro cliente:

1. POST crea el documento con revisión 1.
2. Al cambiar la ruta, la limpieza del editor saliente envía un PUT revisión 1.
3. El editor entrante hace GET y recibe todavía revisión 1.
4. El PUT saliente termina correctamente y devuelve revisión 2.
5. El editor entrante envía PUT revisión 1: el servidor devuelve 409.

Esto ocurre antes de simular la desconexión. El hook marca el conflicto como
bloqueado y deja de enviar guardados, incluidos los reintentos de `online`;
por eso el recorrido no llega a «Sin conexión». El servidor aplica
correctamente su comparación de revisiones. No es un fallo de su endpoint.

Traza inicial privada, con contenido exclusivamente de prueba:
`C:\Users\elale\AppData\Local\Temp\office-5a-14pt059p\trace\revisions.json`.
El commit de instrumentación es `bad53b3`; el primer recorrido falla, como
se esperaba, antes de cambiar el hook. La traza se conserva separada de los
intentos posteriores.

## Corrección limitada

Solo cambia la lógica de `frontend/src/components/office/use-office-storage.ts`.
Un registro transitorio de promesas por ID de documento permite a la nueva
instancia esperar los guardados salientes antes de leer su revisión. Espera
también los guardados encadenados. Las promesas se retiran al terminar.

Un error de red sigue mostrando «Sin conexión» y conserva el borrador. Si una
respuesta se perdió después de confirmar un PUT, el siguiente intento puede
recibir 409. Se consulta el documento y solo se adopta la revisión si todos sus
datos coinciden exactamente con el envío actual. Si el usuario siguió editando,
solo se reintenta su contenido más reciente cuando la revisión remota es
exactamente la siguiente y coincide con aquel envío sin confirmar. Ese nuevo
PUT vuelve a usar la protección optimista del servidor.

Si los datos remotos difieren, se mantiene «Conflicto de versión», el borrador
local y «Guardar como copia». Reconectar no sobrescribe cambios ajenos.
La respuesta de una consulta fallida no se interpreta como confirmación.

No cambian `academic-office-view.tsx`, `office.py`, importadores, reemplazar,
plantillas, formatos, textos, aspecto, dependencias ni migraciones. No se
modifican Repaso, Planificador, Chat ni el rediseño. No hay release ni tag.

## Pruebas

El recorrido ampliado comprueba guardado/importación/historial originales,
ausencia de 409 al abrir el importado, desconexión y recuperación reales de
transporte, conflicto de otro cliente con conservación del servidor y copia,
respuesta perdida con y sin edición posterior, importación mientras un PUT
está retenido, conservación del borrador y del contenido anterior, navegación
rápida con una lectura antigua retenida y biblioteca Office móvil.

Las respuestas retenidas proceden de `route.fetch()` contra la API real de
pruebas: no se inventan confirmaciones. Las interrupciones se fuerzan en el
navegador; no se altera la API ni se usan cuentas o datos de producción.
`OFFICE_TRACE_OUTPUT` selecciona la carpeta de trazas. El test cierra Chrome y
conserva el registro también cuando falla.

## Resultado final

| Comprobación | Resultado |
|---|---|
| Build de producción | Correcto |
| Typecheck | Correcto |
| Lint | Correcto; los mismos 7 avisos anteriores |
| Backend `python -m pytest tests -q` | 99 correctos; advertencias anteriores de pytest-asyncio/Starlette |
| Office ampliado | Correcto; repetición final con las aserciones reforzadas también correcta |
| Office Home | Correcto; crear, guardar, recargar, carpetas, duplicar, historial, móvil y entrada Documentos |
| Office DOCX | Correcto; ida/vuelta real con LibreOffice, contenido/imagen/formato, reemplazar/deshacer y plantillas |
| Smoke | 56 comprobaciones correctas, escritorio y móvil; incluye Documentos, Biblioteca e importación/apertura de PDF local |

La traza final contiene cero 409 en la importación original y cero en la
importación con PUT pendiente. Los tres 409 restantes son deliberados: uno
por el segundo cliente y dos por respuestas perdidas. El conflicto real no
se desbloquea por reconectar; los otros dos se recuperan conservando contenido.

Al desarrollar los nuevos controles se corrigieron únicamente sus propias
precondiciones: origen local de la API para interceptar peticiones, nombre
accesible completo de las tarjetas y espera de entrega de una respuesta antes
de retirar la interceptación. La retirada prematura reenviaba la petición en
el instrumento; la repetición final exige que eso no ocurra y rechaza cualquier
409 en ambas importaciones. No se relajan las aserciones originales.

Evidencia persistente fuera del repositorio:
`C:\Users\elale\Downloads\academic_autopilot\verification\office-409\`.
Incluye `before-revisions.json`, `after-revisions.json`, resultados y logs de
pruebas seleccionados. No incluye bases de datos ni logs de API con sesiones.
Los registros completos de intentos permanecen en
`%TEMP%\office-5a-14pt059p`. Todos los servidores propios de pruebas se detienen.

Tamaños: hook 117 → 149 líneas; test 76 → 199 líneas. El registro de promesas
es transitorio dentro del cliente; la coordinación entre pestañas/clientes
continúa protegida por las revisiones del servidor, sin sobrescritura automática
de contenido distinto. Las pruebas son web local con API aislada, no una
verificación de Electron nativo ni de datos de producción. La importación DOCX
mantiene los avisos previos de estilos `ListLabel28` de LibreOffice.

Fallo nuevo pendiente: ninguno observado. Pendiente: revisión del PR y CI
remoto. No fusionar como parte de esta tarea.
