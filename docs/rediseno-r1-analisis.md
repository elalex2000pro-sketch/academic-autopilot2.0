# R1 — Paso 1: análisis y propuesta aprobados

Análisis aprobado por el usuario. El contenido siguiente conserva la fotografía
del paso 1; implementación y resultados de los pasos 2–3 en
[`rediseno-r1-verificacion.md`](rediseno-r1-verificacion.md).

15 de noviembre de 2026. Rama `feat/rediseno-r1-temas`, creada desde main
actualizado en `07cf9e93d859d198409cd92df29b365233ab40ad` (PR #6).
No existe `.codegraph/`; no se ha indexado. Se leyeron AGENTS.md,
ARCHITECTURE.md y docs/rediseno-plan.md, junto con los propietarios de estilos,
tema, preferencias y navegación. El plan R0 existe sin seguimiento: se conserva
intacto y no se incorpora a este commit. La rama solicitada por el usuario
sustituye el nombre de rama propuesto originalmente en R0.

Este paso solo añade este análisis. No implementa tokens, selector, fuentes,
estilos, pantallas, funciones ni cambios de comportamiento. Parada obligatoria
antes del paso 2. La regla de catálogo único para navegación y contenido se
aplicará a todo R1–R6.

## 1. Cómo se pinta hoy la aplicación

- `layout.tsx` importa globals.css y después v18-theme.css. El resultado mezcla
  variables HSL semánticas, reglas por clases, utilidades Tailwind, reglas de
  compatibilidad para páginas antiguas y sobrescrituras V18. Importan también
  las capas CSS, especificidad, media queries y declaraciones !important.
- globals.css define background, foreground, card, primary, secondary, muted,
  accent, destructive, border, input, ring, sidebar y separator en :root/.dark.
  V18 sustituye background por `240 20% 97%` en claro y `0 0% 4%` en oscuro;
  el lienzo real usa además #f3f3f6/#0a0a0a y gradientes ambientales. Body es
  transparente para dejar pasar el fondo personal. No equiparar background,
  card, sidebar y el material del rail: hoy tienen valores distintos.
- Tailwind mapea los colores semánticos a HSL de variables, pero conserva
  paletas hexadecimales de sistema, acentos y grises. Varios nombres heredados
  comparten escalas (slate/zinc/gray; indigo/blue/sky, etc.). Los componentes
  contienen además colores y sombras arbitrarios. Las reglas de compatibilidad
  de globals.css remapean clases bg-white, grises, bordes y textos, por modo.
- Cristal: globals.css contiene familias glass/app-glass con radios de 24px,
  fondos y sombras propios; V18 comparte `--v18-card-*` y `--v18-soft-*` entre
  familias. V18 declara filtros de 28px/150% y suaves de 22px/140%; Pure Glass
  declara 56px/190% y 36px/175%. Reglas más específicas, ahorro y !important
  pueden prevalecer: se medirán estilos calculados, no solo la última regla.
- Sombras: catálogo Tailwind sm/md/lg/xl/window/button, familias liquid/glass,
  sombras en CSS y valores arbitrarios en JSX. Hay sombras diferentes por
  elevación, hover y superficie inversa; no son intercambiables.
- Radios: Tailwind redefine 4, 6, 8, 10, 14, 20, 28 y 36px; globals.css define
  --radius=0.75rem pero esa variable no gobierna toda la escala. El cristal
  usa 24px; rail 32px, barra móvil 30px, enlaces móviles 22px, indicadores full.
  Unificar origen no significa imponer un mismo radio a todas las piezas.
- Tipografía: Inter var local con font-display swap. Body utiliza primero
  fuentes del sistema (SF Pro Text, Inter, Segoe UI...), 13px, interlineado 1.5
  y espaciado -0.006em; títulos -0.022em. Tailwind repite la familia sans,
  distingue display con SF Pro Display/Segoe UI Variable Display y mono.
  Controles heredan familia y fechas usan cifras tabulares. Preservar orden,
  métricas, fallback y las tres funciones tipográficas al introducir variables.

## 2. Tema y preferencias: contratos que no se cambian

ThemeProvider admite light/dark/system; por defecto light. Persiste en
`academic-autopilot-theme-v18`, aplica .dark, data-theme, color-scheme y el meta
theme-color. El script previo a hidratación repite esa aplicación para evitar
destellos. El meta contiene valores duplicados también en layout; no requiere
modificar el proveedor ni la persistencia para tokenizar los estilos.

PreferencesProvider y su script inicial aplican data-glass (standard/pure),
data-performance (quality/efficiency) y data-animations (reduced/standard/ultra).
Se conservan clave, valores predeterminados y compatibilidad fluid → ultra.
Aurora procede de una recompensa por usuario; GamificationThemeSync la valida.
WallpaperBackdrop aplica el fondo guardado y adapta el velo por luminancia.
No se resetean ni desbloquean esas preferencias. Modo de luminosidad, estilo
visual futuro, cristal, rendimiento y cosméticos son ejes distintos.

## 3. Duplicación medida

Recuento textual reproducible sobre globals.css + v18-theme.css, incluidos
comentarios; no deduce reglas activas, equivalencia de colores ni código muerto.

| Familia | Apariciones | Valores/nombres distintos |
|---|---:|---:|
| Colores hexadecimales | 82 | 58 |
| Expresiones rgb/rgba | 187 | 141 |
| Expresiones blur(...) | 35 | 13 |
| Declaraciones de variables CSS | 112 | 35 |

Ejemplos: #ffffff aparece 11 veces; blur(64px), 10; blur(48px), 4.
Parte de la repetición responde a modos y prefijos de navegador legítimos.
La familia de body y sans está repetida en CSS y Tailwind. Materiales de
glass-card/app-glass se repiten en globals antes del catálogo V18.

En app-shell.tsx hay 19 literales hexadecimales y 59 apariciones de utilidades
de texto/fondo/borde/anillo white/black; en mobile-navigation-bar.tsx hay 3 y 6,
respectivamente. No todas pertenecen al rail: el shell incluye header y drawer.
mobile-nav-indicator.tsx añade otro hexadecimal. Son ocurrencias, no colores
únicos ni reglas necesariamente efectivas.

## 4. Navegación: separación actual y unificación propuesta

El rail combina .v18-rail con bg-[#1b1b1f], border-white/10, radio 32px y sombra
propia. El mismo fondo se repite en v18-theme.css. Su indicador usa #e9e4f6,
sombra negra/inset blanco y texto #1d1d1f; estados inactivos/hover/foco usan
blanco con opacidades. Es deliberadamente oscuro en claro y oscuro.

La barra móvil repite fondo con alfa .95, radio 30px, sombra distinta y
desenfoque Tailwind. Su indicador estático y el animado duplican exactamente
color y sombra. El logo SVG añade tres stopColor fijos (#4F86FF, #7B8CFF,
#B57BFF). Botones compartidos también contienen materiales fijos. Por tanto,
no basta con cambiar --sidebar ni añadir otro fichero de tema solo al rail.

Propuesta: ambas barras, header, indicadores y contenido consumen el mismo
catálogo raíz. Superficie inversa, texto sobre inversa, selección suave,
resaltado, borde, foco, cristal y elevaciones serán roles reutilizables,
también para botones y superficies del contenido. Ningún tema se define en
el componente de navegación ni en un proveedor/almacén distinto. El tema
actual conserva exactamente sus superficies distintas: al alternar claro y
oscuro el rail puede seguir oscuro. Eso no equivale a un segundo tema.

Eliminar colores fijos de la barra incluye SVG, hover/foco, separadores e
indicadores estático/animado; trasladar todos a tokens del mismo catálogo.
Conservar clases estructurales, DOM, tamaños, rutas, mediciones, Framer,
persistencia y contraste actual. No introducir todavía el rail expandido R2.

## 5. Catálogo único propuesto para el paso 2

Recomiendo `frontend/src/app/design-tokens.css`: valores del estilo actual
por defecto, variantes claro/oscuro y adaptaciones actuales de cristal,
rendimiento y cosmético en un solo sitio. Los consumidores no contienen
definiciones alternativas. Conservar --background/--card y --v18-* como alias
compatibles mientras se centralizan los valores; conservar sus selectores,
precedencia y !important cuando afecten al resultado actual.

| Grupo | Variables propuestas (nombres orientativos) |
|---|---|
| Paleta | --palette-*, canales RGB/HSL compatibles con alfa de Tailwind |
| Superficies/texto | --surface-canvas, --surface-raised, --surface-inverse, --text-primary, --text-on-inverse, --selection-soft |
| Material | --glass-background, --glass-border, --glass-filter, variantes soft y estados existentes |
| Borde/foco | --border-subtle, --border-on-inverse, --focus-ring y opacidades existentes |
| Radios/sombras | --radius-* y --shadow-* compartidos por todos los consumidores |
| Tipografía | --font-body, --font-display, --font-mono; tamaño/interlineado/tracking actuales |
| Marca/movimiento | --brand-gradient-*; alias de curvas/duraciones existentes, sin alterar animaciones |

Tailwind enlaza sus paletas, tipografías, radios y sombras al catálogo,
manteniendo cada valor exacto y el soporte de opacidad. El catálogo incluye
roles legacy necesarios para conservar las excepciones actuales; no se
fusionan dos materiales diferentes solo porque sus nombres se parezcan.
El selector tipográfico futuro podrá cambiar las familias desde ese origen;
R1 no añade UI, descargas ni preferencias nuevas.

Alternativa considerada: añadir solo alias en los dos CSS actuales reduciría
el diff, pero dejaría valores repartidos y navegación fija. No satisface la
regla nueva de definir cada estilo una sola vez. Tampoco se propone reescribir
todos los componentes o sustituir todo color literal del repositorio: los
materiales de sección con reglas propias se inventariarían como pendientes, sin
prometer que toda pantalla especializada ya acepta cualquier estilo futuro.

## 6. Archivos previstos y tamaño de partida

Líneas físicas incluidos blancos. Este paso solo añade este Markdown.

| Archivo a modificar después de aprobación | Líneas actuales | Motivo |
|---|---:|---|
| frontend/src/app/globals.css | 1730 | Alias y consumo de tokens; preservar cascada y compatibilidad |
| frontend/src/app/v18-theme.css | 227 | Trasladar definiciones de valores al catálogo común |
| frontend/tailwind.config.ts | 281 | Conectar escalas, sombras y fuentes a variables |
| frontend/src/app/layout.tsx | 84 | Importar catálogo, sin cambiar scripts de preferencias |
| frontend/src/components/app-shell.tsx | 494 | Solo clases/valores visuales de navegación y shell |
| frontend/src/components/mobile-navigation-bar.tsx | 95 | Material y estados; no cambiar geometría ni lógica |
| frontend/src/components/mobile-nav-indicator.tsx | 27 | Mismo material que el indicador estático |
| frontend/src/components/logo.tsx | 49 | Stops del degradado de marca mediante tokens |
| frontend/src/components/ui/button.tsx | 54 | Consumir materiales compartidos conservando variantes |
| ARCHITECTURE.md | 51 | Documentar catálogo y consumidores al cerrar R1 |
| frontend/src/app/design-tokens.css | Nuevo, 0 | Única fuente de valores de estilo |
| frontend/tests/redesign-e2e.cjs | Nuevo, 0 | Capturas/estilos calculados y coherencia global |

Revisados sin modificación prevista: theme-provider.tsx (89),
preferences-provider.tsx (270), theme-toggle.tsx (77),
gamification-theme-sync.tsx (44), wallpaper-backdrop.tsx (91).
docs/rediseno-plan.md tiene 228 líneas y se mantiene intacto. Si aparece otro
consumidor que exija edición, se anunciará antes de ampliar este alcance.
No tocar lógica de Chat, Office, Documentos, Biblioteca ni Clases.

## 7. Pasos posteriores propuestos y puerta visual

Tras aprobación, antes de modificar estilos: guardar capturas y estilos
calculados de la base, con cuentas/datos reales de la API SQLite temporal,
sin contenido ficticio añadido a la aplicación ni datos de producción.

1. Paso 2a, commit pequeño: catálogo y alias de materiales compartidos,
   tipografía y Tailwind; conservar los dos CSS consumidores y su orden.
2. Paso 2b, commit separado: navegación/header/indicadores/logo/botón consumen
   ese catálogo, sin literales de color ni sombras independientes en la barra.
3. Paso 3: verificación y documentación en commit separado si requiere ampliar
   pruebas/informe. Typecheck, lint (siete avisos), build y smoke tras cada
   bloque; backend y regresiones del plan R0 cuando se afecten estilos globales.

Comparar capturas antes/después con el mismo navegador, viewport, datos,
fecha/reloj y fuentes cargadas; esperar estabilización de animaciones sin
cambiar preferencias de producto. Escritorio 1440×960 y móvil 390×844.
Pantallas: Dashboard, Planificador, Académico, Ajustes, Chat, Clases,
Documentos/Office y Biblioteca/lector; drawer cerrado/abierto cuando corresponda.
Matriz: claro/oscuro (y resolución de sistema), standard/pure,
quality/efficiency, Aurora equipada legítimamente y fondo personal existente.
Capturar default, activo, hover y foco, con referencia antes de cada estado.
No afirmar equivalencia basándose solo en el smoke de rutas. Diferencias
visibles nuevas requieren investigación; no actualizar referencias para ocultarlas.

Prueba de catálogo único: aplicar una variante de tokens temporal solo en el
navegador de pruebas, sin publicarla ni añadir un tema al producto. Comprobar
que superficie normal e inversa, texto, cristal, radios, sombras y familias de
barra/contenido responden conjuntamente y se restauran. No exigir que un modo
claro convierta en clara la barra inversa actual. Verificar en estático que no
quedan colores fijos en los consumidores de navegación y revisar el SVG.
Conservar clases que disparan reglas de ahorro o adaptar su selector con
equivalencia comprobada; no perder esa cobertura al renombrar utilidades.

## 8. Verificación del paso 1 y parada

Build y typecheck correctos. Lint correcto con los mismos siete avisos.
Smoke correcto: 56 comprobaciones de ruta/tamaño en escritorio/móvil y los
recorridos de Studio. Artefactos:
`C:/Users/elale/AppData/Local/Temp/academic-smoke-ciS35o`.
No se han modificado fuentes de aplicación. El informe es el único archivo
añadido en este paso (222 líneas físicas); el plan R0 previo sigue sin seguimiento.

No se han ejecutado aún comparaciones visuales antes/después ni la variante
temporal: corresponden a los pasos 2–3 y no se presentan como superadas.
No se hace push ni PR antes de completar el paso 3. **Esperar aprobación del
análisis antes de comenzar el paso 2.**
