# R2: navegación de cristal

Base: main `fe99528` (Atlantium 1.5.0). Rama `rediseno/r2-navegacion`.

La barra usa el material compartido `app-glass` y los tokens semánticos de R1,
sin otra paleta. Tiene anchos de 72/224 px, control de nombres en Ajustes,
perfil real y control de tema. Conserva destinos, alias, lado y clave
`layout_sidebar`; la navegación móvil continúa disponible.

El indicador activo se distingue del hover/foco. Los tooltips se presentan
fuera del contenedor con scroll, se cierran con Escape/scroll/resize y tienen
nombre accesible. Las transiciones nuevas respetan la preferencia de la app
y `prefers-reduced-motion`. Sin backend, dependencias ni cambios de versión.

## Capturas

| Ancho | Antes | Después |
|---|---|---|
| 390 | [Antes](capturas/r2/antes-390.png) | [Después](capturas/r2/despues-390.png) |
| 768 | [Antes](capturas/r2/antes-768.png) | [Después](capturas/r2/despues-768.png) |
| 1280 | [Antes](capturas/r2/antes-1280.png) | [Después](capturas/r2/despues-1280.png) |

[Oscuro](capturas/r2/despues-oscuro.png) · [Compacta](capturas/r2/compacta.png).
Datos de cuentas temporales en una API SQLite aislada; no datos de producción.

## Comprobaciones locales

- Typecheck, lint y build correctos; siete avisos preexistentes, ninguno nuevo.
- Backend: 125 tests correctos.
- Navegación: 390/768/1280, claro/oscuro, teclado, Escape, recarga,
  lado derecho y preferencias antiguas. Incorporado al smoke existente.
- Chat: REST/WebSocket real, presencia, adjuntos y borrador sin conexión.
- Clases: mensajes, respuestas, fijados y pestañas en escritorio/móvil.
- Planificador: 24 casos correctos.
- Office: inicio/biblioteca, guardados, recuperación, conflictos y DOCX
  exportado y reimportado con LibreOffice correctos.

## Límites

Pendientes: Android físico/PWA instalada, lector de pantalla real, interacción
nativa Electron (arrastre de ventana/diálogos), medición de rendimiento y
contraste sobre fondos personales arbitrarios. El navegador automatizado no
acredita estos casos. CI y ambos Vercel deben aprobar el commit antes de R3;
el PR no se fusiona sin aprobación.
