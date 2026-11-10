# Academic Autopilot: guía para agentes

## Stack

El proyecto es un monorepo con tres partes:

- `frontend/`: Next.js 14 con App Router, TypeScript, Tailwind CSS y Framer Motion. El lector usa pdfjs/react-pdf; los editores usan Tiptap y CKEditor.
- `backend/`: FastAPI, SQLAlchemy 2 asíncrono, PostgreSQL y Alembic.
- `desktop/`: Electron, que carga la aplicación web desplegada en Vercel. La URL se puede configurar mediante `AUTOPILOT_APP_URL`.

## Ubicación del código

- Rutas y layout: `frontend/src/app/`.
- Componentes y vistas: `frontend/src/components/`.
- Endpoints: `backend/app/api/v1/`.
- Modelos: `backend/app/models/`.
- Migraciones: `backend/alembic/versions/`.

## Diseño

- Mantén el estilo **Liquid Glass**: superficies translúcidas, `backdrop-blur` y bordes sutiles. Reutiliza los componentes y estilos existentes.
- Mantén la interfaz y los mensajes para el usuario en español.
- Con Framer Motion, define siempre `exit` en los elementos que salen de `AnimatePresence` y usa `layoutId` para indicadores compartidos.

## Reglas de trabajo

- Lee el código relacionado, sus llamadas y sus pruebas antes de cambiar nada.
- Haz cambios mínimos y localizados. No borres ni reescribas componentes enteros.
- No modifiques migraciones ya aplicadas. Crea nuevas migraciones con Alembic.

## Cierre

- Ejecuta `npm run typecheck` y `npm run lint` en `frontend/`; informa de cualquier fallo o comprobación que no pueda ejecutarse. Ejecuta también las pruebas pertinentes al cambio.
- Resume los archivos tocados y el resultado de las verificaciones.
- Para desplegar cambios funcionales, actualiza la versión y las notas, crea el commit y el tag y haz push. Sincroniza `frontend/package.json`, `frontend/package-lock.json`, `desktop/package.json`, `desktop/package-lock.json` y `frontend/public/version.json`. Comprueba el resultado del workflow de release. Respeta cualquier instrucción explícita del usuario sobre el despliegue y el alcance de la tarea.
