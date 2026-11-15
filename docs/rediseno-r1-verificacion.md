# R1 — Sistema de temas: verificación

15 de noviembre de 2026. Rama `feat/rediseno-r1-temas`, desde main
`07cf9e93d859d198409cd92df29b365233ab40ad` (PR #6). Análisis aprobado:
[`rediseno-r1-analisis.md`](rediseno-r1-analisis.md). R1 prepara el catálogo del
estilo actual; no implementa R2–R6 ni añade un estilo, selector o fuente.

## Resultado y contratos

- `design-tokens.css` contiene 482 valores exactos y es el único catálogo común
  para navegación y contenido. Conserva valores distintos aunque sean parecidos:
  `#0066ff`/`#007aff`, `#e9e4f6`/`#e9e4f8`, `#1d1d1f`/`#202730`.
- Los nombres anteriores permanecen como alias. Orden de importación:
  catálogo → globals → V18. Se conservan capas Tailwind, especificidad,
  selectores, media queries y `!important`; no se eliminan reglas antiguas.
- La auditoría expande las referencias y encuentra las 648 declaraciones
  originales de globals/V18 conservadas, en su orden y con sus valores.
  Globals: 572 → 588 declaraciones; V18: 76 → 76. La superficie inversa
  `#1b1b1f` se representa como `rgb(27 27 31)`, exactamente los mismos canales.
  Las paletas Tailwind conservan los canales de cada hexadecimal y su opacidad.
- La barra consume la superficie inversa, tinta, selección, bordes, filtros,
  radios y sombras del mismo catálogo. No queda ningún literal hexadecimal,
  RGB/HSL o sombra con color fijo en app-shell, navegación móvil, indicador,
  logo ni controles de ventana. El punto de aviso de NotificationBell también
  consume tokens; el resto del panel de notificaciones conserva sus estilos.
- El indicador móvil estático/animado usa una sola regla de material
  `selection-indicator`; sus posiciones y animaciones no se modifican.
- Las tres familias existentes (sans, display y mono) se definen una sola vez.
  Se preservan orden, alternativas, métricas y fuente local. Sin FreeSans.
- Las sombras arbitrarias usan `shadow-[shadow:var(...)]`, evitando que
  Tailwind interprete la variable como color. Las sombras coloreadas mantienen
  el color local del elemento: la geometría se comparte mediante tokens,
  pero `--tw-shadow-color` se resuelve en el consumidor. Prueba calculada
  antes/después para `shadow-lg shadow-slate-900/5`, claro/oscuro: idéntica.
- No cambian estados, efectos, eventos, scroll, textos, rutas, preferencias ni
  persistencia. No hay cambios en backend, Electron, Chat/tiempo real, Office,
  Documentos, Biblioteca o Clases. Solo reciben estilos compartidos.
  Sin dependencias, migraciones, versiones ni archivos de bloqueo modificados.

## Commits y comprobaciones por bloque

| Bloque | Commit | Typecheck | Lint | Build | Smoke escritorio/móvil |
|---|---|---|---|---|---|
| Valores y alias CSS | `3abf8d1` | correcto | 7 avisos | correcto | 56 comprobaciones |
| Tailwind | `827c988` | correcto | 7 avisos | correcto | 56 comprobaciones |
| Navegación e indicador | `1093279` | correcto | 7 avisos | correcto | 56 comprobaciones |
| Materiales y contenido compartido | `c2835b9` | correcto | 7 avisos | correcto | 56 comprobaciones |
| Material del aviso de navegación | `64277a2` | correcto | 7 avisos | correcto | 56 comprobaciones |

Comandos: `npm run typecheck`, `npm run lint`, `npm run build` y
`npm run test:smoke -- --no-start`, contra API SQLite aislada y build Next de
producción, en servidores propios. Los siete avisos son los anteriores:
Chat compositor (img), writer-editor (ref), preferences-provider (dependencia),
reward-shelf (dependencia), Studio compositor (img) y burbuja Studio (dos img).
No se desactivan reglas ni se modifican estos archivos para silenciar avisos.

Las primeras capturas detectaron una sombra interpretada como color: se
corrigió la anotación Tailwind antes del commit de navegación y se repitieron
las comprobaciones. También hubo intentos fallidos del instrumento visual por
el reloj de animación y contadores aún en transición; se corrigió únicamente
la sincronización del test. Los registros de intentos se conservan: no se
presentan esas ejecuciones como verdes. La comparación final siguiente es la
referencia de aceptación.

## Comparación visual final

Prueba añadida: `frontend/tests/redesign-e2e.cjs`, con Playwright ya instalado.
No añade dependencias. Solo acepta servidores locales y comprueba que la API
declara `isolated-chat-test`. Usa usuarios, clase y documento persistidos en la
API de pruebas; no simula respuestas ni modifica producción. El progreso local
del usuario temporal se fija a nivel 5 para que la validación real permita
equipar Aurora; no se añade contenido ficticio a la aplicación.

Referencia: worktree separado en `f8bd044`, cuyo código de aplicación es el de
main `07cf9e9`; build desde su propio directorio frontend, con el mismo lock y
dependencias. Candidato completo: `c2835b9`. Ambos utilizan los mismos datos
aislados; se bloquea el service worker y se esperan fuentes y fotogramas
estables. Solo se fija la fecha mostrada; el reloj de animaciones sigue vivo.

- 10 pantallas: Dashboard, Planificador, Académico, Ajustes, Chat, detalle de
  Clase, Documentos, documento Office, Biblioteca y Studio.
- 1440×960 y 390×844; claro/oscuro; cristal estándar/Pure Glass; recompensa
  predeterminada/Aurora: **160 pares**.
- **8 pares adicionales** activan explícitamente el selector CSS Aurora ya
  existente. Se distinguen del recorrido real de la recompensa por la
  incompatibilidad preexistente descrita más abajo.
- Tras el ajuste del punto de notificación (`64277a2`): **16 controles** de
  Dashboard con las mismas combinaciones y prueba adicional del aviso real
  en claro/oscuro. Fondo `rgb(255,59,48)` y contornos originales exactos.
- Comparación estricta de 13 propiedades calculadas en body, main, títulos,
  botones, rail, barra móvil y superficies compartidas: cero diferencias en
  los 168 pares y los 16 controles. La familia tipográfica solo normaliza
  comillas/espacios de serialización; conserva nombres y orden.
- Comparación de píxeles sin máscaras. Se conserva cada imagen de diferencia.
  Tolerancia de rasterización: ≤2/255 por canal; excepcionalmente ≤3/255 en
  ≤20 píxeles. Ocurrió el máximo de 3 en solo 3 píxeles de dos capturas móviles
  de Clases; todas las propiedades calculadas eran idénticas. Hay 96/160 y 8/8
  capturas con alguna variación de rasterización; los 16 controles varían ≤2.
  **No se afirma igualdad binaria de todas las imágenes**. Resultado: cero
  diferencias visibles o de los estilos calculados medidos.

Prueba temporal de variante: cuatro combinaciones escritorio/móvil y
claro/oscuro. Se sobrescribe un único mapa de tokens raíz y se verifica que
barra, selección, botón y tarjeta de Ajustes responden a colores, radios,
sombras, tipografía y cristal; luego se restaura y se exige igualdad exacta de
los estilos calculados iniciales. El rail sigue opaco como exige su material
original; barra móvil y tarjeta sí responden al filtro. Cuatro casos correctos.
La variante y sus scripts auxiliares están fuera del código entregado.

Evidencia persistente fuera del repositorio:

`C:\Users\elale\Downloads\academic_autopilot\verification\r1-temas-oytcv1ca\`

`index.html` muestra los 168 pares; `before/`, `after/` y `diff/` conservan
capturas y estilos; `meta/` contiene comparaciones, auditoría y pruebas de
variante/preferencias/sombras; `auxiliary/` las capturas de la variante y aviso.
`sha256.json` permite verificar integridad. ZIP hermano con el mismo nombre.
No se incluyen tokens de sesión, fixtures con credenciales, bases de datos ni
logs de API. Los 16 controles adicionales y registros completos de cada intento
permanecen además en `%TEMP%\r1-themes-oytcv1ca`.

Reproducción: iniciar la API `backend/tests/chat_test_server.py` y un build Next
propios; establecer `R1_OUTPUT` en un directorio privado persistente, capturar
la referencia con `node tests/redesign-e2e.cjs --baseline`, conservar su base de
datos de pruebas y capturar el candidato con el mismo directorio. Puertos
opcionales `R1_API`/`R1_WEB`; comparación guardada con `--compare-only`.
`--aurora-selectors` prueba exclusivamente los ocho estados CSS adicionales.
El archivo privado `fixtures.json` contiene sesión: no publicarlo.

## Regresiones y fallos preexistentes

| Comprobación final | Resultado |
|---|---|
| Backend `python -m pytest tests -q` | 99 correctos; advertencias previas de pytest-asyncio/Starlette |
| Chat `chat-e2e.cjs` | correcto |
| Chat `chat-realtime-e2e.cjs` | 13 casos correctos |
| Clases `class-tabs-e2e.cjs` | correcto |
| Office inicio `office-home-e2e.cjs` | correcto |
| Office DOCX `office-docx-e2e.cjs` | correcto, incluido recorrido real LibreOffice |
| Office `office-e2e.cjs` | fallo preexistente en línea 53 esperando «Sin conexión»; aparece 409 antes |
| Sistema/claro/oscuro, cambio del SO, recarga, Pure Glass y ahorro | correcto; cascada anterior preservada |

El fallo Office ya figura en `docs/limpieza-verificacion.md`; no se relaja el
test ni se toca guardado/sincronización. El primer instrumento temporal de
preferencias seleccionaba una pestaña equivocada y después reponía la
preferencia en cada recarga: se corrigió solo el instrumento y la ejecución
final pasa, comprobando persistencia real de `system`.

Otras dos particularidades anteriores, conservadas:

1. La recompensa equipada emite `data-cosmetic-theme="theme-aurora"`, mientras
   el CSS selecciona `aurora`. La matriz de 160 reproduce el camino real sin
   corregirlo; los otros ocho pares cubren el CSS dormido explícitamente.
2. En ahorro + Pure Glass, la tarjeta elimina su filtro, pero la cabecera
   conserva `blur(48px) saturate(1.8)` por la cascada anterior. No se cambia
   comportamiento para uniformarlo en R1.

No hay fallos nuevos pendientes tras las correcciones. Esta verificación es
web local, con API real aislada; no acredita móvil físico, Electron nativo,
Gemini remoto ni recorridos autenticados en producción.

## Tamaños finales (líneas físicas)

| Archivo | Main | R1 |
|---|---:|---:|
| `frontend/src/app/design-tokens.css` | — | 587 |
| `frontend/src/app/globals.css` | 1730 | 1671 |
| `frontend/src/app/v18-theme.css` | 227 | 205 |
| `frontend/tailwind.config.ts` | 281 | 274 |
| `frontend/src/app/layout.tsx` | 84 | 85 |
| `frontend/src/components/app-shell.tsx` | 494 | 494 |
| `frontend/src/components/mobile-navigation-bar.tsx` | 95 | 95 |
| `frontend/src/components/mobile-nav-indicator.tsx` | 27 | 27 |
| `frontend/src/components/logo.tsx` | 49 | 49 |
| `frontend/src/components/window-controls.tsx` | 139 | 139 |
| `frontend/src/components/ui/button.tsx` | 54 | 54 |
| `frontend/src/components/notification-center.tsx` | 709 | 709 |
| `frontend/tests/redesign-e2e.cjs` | — | 156 |

## Valores no migrados y límites del alcance

Ningún valor migrado requirió aproximación, redondeo o fusión de tonos. Se
conservan formas equivalentes exactas de color y serialización de fuentes.

Quedan deliberadamente fuera de esta migración de materiales compartidos:
los valores JavaScript de `meta theme-color` (contrato del proveedor actual),
el nombre/URL y descriptores de identidad de `@font-face`, colores específicos
en JSX de secciones y colores pertenecientes a documentos/datos del usuario.
No se hace una sustitución masiva de Office, Documentos, Biblioteca o Clases.
Las dimensiones de layout y constantes de lógica tampoco se convierten en
tokens de tema. El origen de los materiales de navegación sí está unificado
y no depende de colores literales propios.

El plan previo `docs/rediseno-plan.md` se conserva sin seguimiento e intacto
(SHA256 `47B136FF35D62F731F53B182AD77688A67CAF7AF973DC68252A63087CA3BCA55`).
Pendiente del cierre: revisión del PR y comprobaciones remotas. No fusionar.
