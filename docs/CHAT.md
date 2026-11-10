# Chat de Academic Autopilot — 1.3.39

El chat usa la API propia de Academic Autopilot. La referencia de interacción
es WhatsApp: lista de conversaciones y lienzo independiente, historial con
scroll, compositor fijo, burbujas alineadas por remitente y recibos discretos.
Las superficies translúcidas, tipografía y navegación pertenecen a la app.
No incluye historias, estados, llamadas ni videollamadas.

## Identidad y datos

- Cada cuenta tiene un UUID interno y un `username` público obligatorio de
  3–24 letras ASCII minúsculas, números o guiones bajos. La interfaz añade `@`.
  Las cuentas reciben un identificador automático que pueden personalizar.
- `users.username` y el índice único `lower(username)` impiden duplicados.
  La migración `0021_chat_identity_presence` conserva los nombres válidos,
  normaliza mayúsculas y asigna nombres a cuentas anteriores sin identificador.
- La búsqueda es por prefijo literal del identificador. La creación directa
  resuelve el identificador exacto y reutiliza la pareja ordenada de UUIDs;
  una restricción única evita crear dos chats al mismo tiempo.
- Las conversaciones, membresías, mensajes y metadatos viven en PostgreSQL.
  Los bytes de los adjuntos viven en `FILES_DIR`, igual que antes de esta versión.
  Ese directorio necesita almacenamiento persistente para conservar archivos
  al redesplegar; la configuración Render existente usa `/tmp/files`.

## Presencia y confirmaciones

El WebSocket autenticado `/api/v1/ws` registra conexiones por usuario. La
presencia se mantiene mientras quede algún dispositivo conectado. Se guarda
`last_seen_at` y se notifica el cambio a compañeros con conversación compartida.
El gestor actual es local al proceso de la API, coherente con el despliegue de
un solo proceso; varios procesos requerirían un transporte compartido.

Un tick indica mensaje persistido; dos grises, entrega; dos azules, lectura.
Cada miembro tiene marcas temporales independientes de entrega y lectura.
Los grupos avanzan cuando todos los destinatarios alcanzan la marca del mensaje.
Las actualizaciones toman un bloqueo de conversación para evitar carreras.

El proveedor global confirma entrega al conectar y recibir mensajes, incluso
fuera de `/chat`. La vista confirma lectura cuando el hilo está cargado,
visible, enfocado y situado al final. Envía `through=<UUID>` del último mensaje
cargado para no confirmar mensajes nuevos aún no mostrados. Los estados nunca
retroceden; una escritura sin conexión devuelve error y conserva el borrador.

## Adjuntos

El selector de archivos abre el diálogo del sistema desde navegador/Electron.
También se admite arrastrar o pegar un archivo en el compositor. El cliente y
el servidor limitan los archivos a 25 MB y a las extensiones admitidas. La imagen
tiene previsualización; los documentos muestran nombre, tamaño y acciones.
La descarga requiere pertenecer a la conversación.

`native-files.ts` usa el puente Electron existente para abrir con la aplicación
predeterminada y guardar mediante diálogo nativo. La web descarga o abre en una
pestaña. La API no implementa el protocolo ni el cifrado de WhatsApp.

## Verificación reproducible

Backend, con Python 3.11 y las dependencias de `backend/requirements.txt`:

```powershell
cd backend
python -m pytest -q
```

Prueba de navegador con la API y almacenamiento temporales, sin datos de producción:

```powershell
cd backend
python -m uvicorn chat_test_server:app --app-dir tests --host 127.0.0.1 --port 8000
```

En otro terminal:

```powershell
cd frontend
npm ci
npm run build
npm start -- --hostname 127.0.0.1 --port 3000
```

En un tercero, con Chrome instalado:

```powershell
cd frontend
npm run test:chat:browser
```

La prueba rechaza una API cuyo `/health` no declare `isolated-chat-test`.
Crea dos cuentas temporales y verifica búsqueda, conversación directa, recibos
reales por WebSocket, entrega fuera de la ruta de chat, presencia y desconexión,
imagen, bytes del PDF descargado, validación de archivos, borrador sin conexión
y disposición móvil/escritorio. Guarda capturas en un directorio temporal.

La suite completa pasa 77 pruebas. La compilación de producción y el instalador
Windows NSIS también se verificaron localmente. Las pruebas de API usan SQLite;
no sustituyen una ejecución de migraciones y concurrencia sobre PostgreSQL real.

## Referencia visual y funcional

REA 6.8.0 inspeccionó la pantalla pública de acceso de WhatsApp Web en un perfil
Chrome temporal, sin sesión. Evidencia:
`ev_dea35dc74510bc3c9a9ede4e2d913b9d3b1f9bd9ee4ec26b0570e8fdbea8450e`.
No se observaron conversaciones privadas ni la implementación interna autenticada.
La disposición del chat es una adaptación del diseño solicitado, no una
comparación visual píxel por píxel con una sesión de WhatsApp.

Las semánticas de referencia se contrastaron con documentación oficial:
[confirmaciones de lectura](https://faq.whatsapp.com/665923838265756/?cms_platform=web),
[última vez y en línea](https://faq.whatsapp.com/419827870318306/),
[multimedia y documentos](https://faq.whatsapp.com/453914586839706/?cms_platform=web).

## Actualización OTA

Frontend, desktop y `public/version.json` comparten la versión 1.3.39.
La etiqueta `v1.3.39` dispara `.github/workflows/release-desktop.yml`, que genera
Windows/macOS y publica los instaladores y manifiestos de actualización. El
despliegue de la API debe aplicar Alembic hasta la revisión 0021 antes de servir
este frontend; el entrypoint del contenedor ya ejecuta las migraciones.
