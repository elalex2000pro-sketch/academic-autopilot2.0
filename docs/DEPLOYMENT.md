# Guia de Configuracion y Despliegue

## 0. Prerequisitos

| Herramienta | Version | Uso |
|-------------|---------|-----|
| Docker + Docker Compose | 24+ | Via rapida (recomendada) |
| Python | 3.11+ | Backend en local |
| Node.js | 20+ | Frontend en local |
| PostgreSQL | 16 | Base de datos (si no usas Docker) |

---

## 1. Variables de entorno

```bash
cp .env.example .env
```

Genera una `SECRET_KEY` segura:

```bash
# Linux/macOS
openssl rand -hex 32
# Windows (PowerShell)
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

Edita `.env` y rellena al menos `SECRET_KEY`. Para Google Classroom rellena
`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (paso 4).

---

## 2. Via rapida con Docker (recomendada)

```bash
docker compose up --build
```

Esto levanta:

| Servicio | URL |
|----------|-----|
| Proxy (acceso unico) | http://localhost:8080 |
| Frontend | http://localhost:3000 |
| Backend (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |
| Worker | (sin puerto; sincronizacion periodica) |

El contenedor `backend` aplica las migraciones de Alembic automaticamente al
arrancar (`entrypoint.sh`). El `worker` ejecuta la sincronizacion periodica.
El contenedor `proxy` (Caddy) sirve frontend + API en un unico origen
(`http://localhost:8080`), lo que permite acceder desde otros dispositivos
(véase la seccion 7).

Para parar: `docker compose down`. Para borrar tambien los datos:
`docker compose down -v`.

---

## 3. Desarrollo local (sin Docker)

### 3.1 Base de datos

Necesitas un PostgreSQL 16 en marcha. Con Docker solo para la BD:

```bash
docker run --name autopilot-db -e POSTGRES_USER=autopilot \
  -e POSTGRES_PASSWORD=autopilot -e POSTGRES_DB=academic_autopilot \
  -p 5432:5432 -d postgres:16-alpine
```

### 3.2 Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt

# Aplicar migraciones
alembic upgrade head

# Levantar la API (con recarga en caliente)
uvicorn app.main:app --reload --port 8000
```

Si dejas `ENABLE_SCHEDULER=true`, la API arrancara el worker interno. Para
tener el worker como proceso aparte:

```bash
python -m app.workers.run
```

### 3.3 Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # ajusta NEXT_PUBLIC_API_URL si hace falta
npm run dev
```

Abre http://localhost:3000, crea una cuenta (`Registrate`) y ve a **Ajustes**.

### 3.4 Tests

```bash
cd backend
pytest -q
```

---

## 4. Configurar Google Classroom (OAuth2)

1. Entra en [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto y habilita la **Google Classroom API**
   (APIs & Services → Library → "Google Classroom API" → Enable).
3. Configura la pantalla de consentimiento (APIs & Services → OAuth consent
   screen). En modo "Testing" agrega tu cuenta como *test user*.
4. Crea credenciales: **APIs & Services → Credentials → Create credentials →
   OAuth client ID → Application type: Web application**.
5. En **Authorized redirect URIs** agrega exactamente el valor de
   `GOOGLE_REDIRECT_URI`:
   ```
   http://localhost:3000/settings
   ```
6. Copia `Client ID` y `Client Secret` a tu `.env`
   (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) y reinicia el backend.
7. En la app: **Ajustes → Conectar Google Classroom → Autorizar**.

> En produccion cambia `GOOGLE_REDIRECT_URI` a
> `https://tu-dominio.com/settings` y registra esa URL en Google Cloud.

## 5. Configurar Moodle

1. En tu Moodle: **Perfil → Preferencias → Seguridad → Claves de acceso**
   (o *Security keys* / *Tokens*).
2. Si no aparece, el sitio debe tener habilitados los **Web Services**
   (`Administracion del sitio → Plugins → Web services`).
3. Copia el token.
4. En la app: **Ajustes → Conectar Moodle**: introduce la URL raiz
   (`https://moodle.universidad.edu`) y el token.

El conector usa estas funciones (deben estar permitidas en el servicio web):
`core_webservice_get_site_info`, `core_enrol_get_users_courses` y
`mod_assign_get_assignments`.

Para marcar automaticamente las tareas ya entregadas se usa ademas
`mod_assign_get_submissions`. Es opcional: si el token no la permite, la app
conserva el estado de completado que hayas marcado manualmente.

La pantalla de conexion comprueba el token contra esas funciones antes de
guardarlo. Si ves un error de permisos, revisa el servicio web asociado al
token en Moodle (`Administracion del sitio -> Plugins -> Web services ->
Servicios externos`).

---

## 6. Primer uso

1. Crea tu cuenta en http://localhost:3000/login.
2. **Ajustes**: conecta Moodle y/o Google Classroom.
3. **Ajustes → Disponibilidad semanal**: anade tus franjas libres
   (ej. lunes a viernes, 16:30–20:30).
4. Pulsa **Sincronizar** en el Dashboard. El backend descargara tareas,
   las priorizara y las repartira en tus huecos.
5. Revisa el **Dashboard** (plan horario + tareas) y el **Modo Enfoque** (plan
   del dia con barra de progreso).

### 6.1 Gestion manual (sin plataformas externas)

La app funciona sin conectar Moodle/Google:

- **Asignaturas**: crea/elimina tus asignaturas (nombre, codigo, color).
- **Horario**: define tus clases semanales recurrentes (dia, hora, aula).
- **Examenes**: registra tus notas; la media se calcula automaticamente
  (ponderada si indicas pesos).

### 6.2 IA Studio (resumenes e infografias en PDF)

En **IA Studio** selecciona un documento subido (PDF, DOCX, TXT, MD, CSV) y genera:

- **Resumen**: texto sintetizado + puntos clave.
- **Infografia**: secciones, ideas y estadisticas en un PDF visual.

El resultado se guarda como PDF descargable y aparece en la lista de resultados.
Usa el asistente local (Ollama); si no esta disponible, cae a un motor de reglas.

---

## 7. Acceso multi-dispositivo (LAN y fuera de casa)

El stack incluye **Caddy** como proxy inverso (`proxy`) que publica frontend y
API en **un unico origen**: `http://<host>:8080`. El frontend detecta el origen
en tiempo de ejecucion, asi que funciona igual en localhost, en la LAN y por un
tunel, sin recompilar.

- **Local**: http://localhost:8080 (o sigue usando :3000 para dev).
- **LAN**: `http://<IP-del-PC>:8080`. Averigua tu IP con `ipconfig`.
- **Fuera de casa** (tunel rapido con Cloudflare, sin cuenta):

  ```bash
  # Instala cloudflared y ejecuta:
  cloudflared tunnel --url http://localhost:8080
  ```

  Comparte la URL `https://<algo>.trycloudflare.com` que muestra. Caddy ya
  enruta `/api/*` y `/ws` al backend y el resto al frontend, asi que la app
  funciona completa (login, archivos, IA, tiempo real).

> La sincronizacion en tiempo real usa WebSocket (`/api/v1/ws`) y atraviesa el
> proxy automaticamente. Al cambiar datos en un dispositivo, el resto se
> actualiza al instante.

> **Seguridad**: por defecto `CORS_ORIGIN_REGEX=^https?://.*$` acepta cualquier
> origen para simplificar LAN/tunel. Si expones la app publicamente, restringelo
> (p.ej. `^https://tu-subdominio\.trycloudflare\.com$`) y considera autenticacion
> adicional (Cloudflare Access).

---

## 8. Notas de produccion

- **SECRET_KEY**: usa una clave larga y unica; nunca la subas al repo.
- **HTTPS**: pon el stack detras de un reverse proxy (Nginx/Traefik/Caddy) con
  TLS. Ajusta `GOOGLE_REDIRECT_URI`, `CORS_ORIGINS` y `NEXT_PUBLIC_API_URL` a
  `https://`.
- **Worker**: en produccion usa el servicio `worker` y deja
  `ENABLE_SCHEDULER=false` en la API para evitar doble sincronizacion.
- **Escalado**: puedes correr varias replicas de `backend`; el `worker` debe
  ser una sola instancia (o migrar a Celery para paralelizar).
- **Backups**: respalda el volumen `pgdata` (`docker compose exec db pg_dump ...`).
- **CORS**: restringe `CORS_ORIGINS` a tus dominios reales.
- **Migraciones**: en cada despliegue ejecuta `alembic upgrade head` (el
  `entrypoint.sh` ya lo hace).

## 9. Solucion de problemas

| Sintoma | Causa probable | Solucion |
|---------|----------------|----------|
| `SECRET_KEY field required` | Falta la variable | Rellena `SECRET_KEY` en `.env` |
| Error de conexion a BD | Postgres no arranco | Revisa `docker compose logs db` |
| 401 en la app | Token expirado/invalido | Vuelve a iniciar sesion |
| Sync Moodle "Invalid token" | Token o URL incorrectos | Regenera el token en Moodle |
| Google "redirect_uri_mismatch" | URI no coincide | Registra exactamente `GOOGLE_REDIRECT_URI` |
| Token de Google caduca | Falta refresh_token | Reconecta con `prompt=consent` (la app ya lo pide) |
| `alembic` no encuentra modelos | Falta import | `env.py` importa `app.models` |
| IA Studio "formato no soportado" | Documento no textual | Usa PDF/DOCX/TXT/MD/CSV |
| Sin sincronizacion entre dispositivos | WebSocket bloqueado | Revisa `REALTIME_ENABLED` y que el proxy reenvie `/ws` |
| No accesible desde otro dispositivo | Firewall del host | Permite el puerto `PROXY_PORT` (8080) en el firewall |

---

## 10. Acceso 24/7 gratis (Oracle Cloud Always Free + DuckDNS)

Objetivo: tener la app disponible "cuando quieras" desde cualquier dispositivo
con solo un navegador, **sin depender de que tu PC este encendido** y sin coste
(capa *Always Free* de Oracle + dominio gratuito de DuckDNS).

El stack ya trae `docker-compose.prod.yml`, que publica los puertos **80/443** y
deja que **Caddy** obtenga el certificado TLS de Let's Encrypt automaticamente a
partir de `SITE_ADDRESS`.

### 10.1. Crear la cuenta y la VM

1. Crea una cuenta en https://cloud.oracle.com (región con "Always Free").
2. **Compute → Instances → Create**:
   - Imagen: **Ubuntu 22.04**.
   - Shape: **VM.Standard.A1.Flex** (ARM, Always Free: hasta 4 OCPU / 24 GB).
     Si no hay capacidad, reintenta mas tarde o usa `VM.Standard.E2.1.Micro`.
   - Sube tu clave SSH publica (o deja que genere el par y descarga la privada).
3. **Reserva una IP publica** (Networking → IP: Adjunta una *Reserved Public IP*
   a la VM). Asi la IP no cambia al reiniciar.

### 10.2. Abrir los puertos 80 y 443

Hay **dos firewalls** que abrir:

**a) Security List de la VCN (panel de Oracle):** VCN → Security Lists →
Default → *Add Ingress Rules* → permite `0.0.0.0/0` en TCP **80** y **443**.

**b) Firewall del sistema (dentro de la VM, siempre por SSH):**

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 10.3. Dominio gratis con DuckDNS

1. Entra en https://www.duckdns.org, inicia sesion y crea un subdominio
   (p. ej. `miacademia` → `miacademia.duckdns.org`). Copia tu **token**.
2. Registra la IP de la VM (ejecutalo **dentro de la VM** para que detecte su IP):

   ```bash
   curl "https://www.duckdns.org/update?domains=miacademia&token=TU_TOKEN&ip="
   ```

   Debe responder `OK`. (DuckDNS devuelve una A record hacia esa IP.)

### 10.4. Instalar Docker en la VM

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker compose version   # debe responder
```

### 10.5. Desplegar la app

```bash
git clone <url-del-repo> academic-autopilot
cd academic-autopilot
cp .env.example .env
```

Edita `.env` con estos valores clave:

```dotenv
SITE_ADDRESS=miacademia.duckdns.org          # dominio DuckDNS (HTTPS automatico)
SECRET_KEY=<genera con: openssl rand -hex 32>
CORS_ORIGINS=https://miacademia.duckdns.org
CORS_ORIGIN_REGEX=^https://miacademia\.duckdns\.org$
GOOGLE_REDIRECT_URI=https://miacademia.duckdns.org/settings   # si usas Google
POSTGRES_PASSWORD=<una-password-fuerte>
```

Levanta el stack con la extension de produccion:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Caddy obtiene el certificado (1-2 min). Abre en cualquier dispositivo:
**https://miacademia.duckdns.org**

> El frontend detecta el origen en tiempo de ejecucion, asi que **no hace falta
> recompilar** al cambiar de dominio.

### 10.6. Inteligencia artificial (Ollama)

La IA usa Ollama. Opciones en la VM:

- **Instalar Ollama en la propia VM** (el shape ARM 4/24 GB mueve un modelo
  pequeno sin problema):

  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ollama pull llama3.2:3b
  # y en .env:  AI_MODEL=llama3.2:3b   (AI_BASE_URL por defecto ya apunta
  # al host via host.docker.internal, que docker-compose configura solo)
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
  ```

- **Sin IA** (el asistente y el IA Studio caen en el modo heuristico, sin
  modelo): pon `AI_ENABLED=false` en `.env`.

### 10.7. Actualizar la app

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 10.8. Notas

- **Coste**: si solo usas recursos *Always Free* (VM A1/E2.1.Micro, IP reservada
  adjunta, volumenes basicos) el coste es **0**. Configura alertas de presupuesto
  por si acaso.
- **Backups**: `docker compose exec db pg_dump -U postgres academic_autopilot > backup.sql`.
- **HTTPS/renovacion**: Caddy renueva el certificado solo; los datos quedan en el
  volumen `caddydata`.

---

## 11. La nube en 30 minutos: Vercel + Render + Neon (sin administrar servidores)

Alternativa recomendada si no quieres mantener una VM: el **frontend** vive en
Vercel, el **backend** en Render y la **base de datos** en Neon (Postgres
gratuito). Todo con planes gratuitos, salvo el disco de archivos (ver abajo).

> **Por que el backend no puede ir en Vercel**: las funciones de Vercel no
> mantienen WebSockets (`/api/v1/ws`), no ejecutan tareas programadas
> (APScheduler) y limitan el cuerpo de cada peticion a ~4.5 MB. El backend
> necesita un proceso vivo: Render (o la VM del apartado 10). Gracias a la
> **subida por trozos** (25 MB por peticion) se pueden subir archivos de hasta
> **20 GB** aunque el proxy corte las peticiones grandes.

### 11.1. Base de datos en Neon

1. Crea una cuenta en <https://neon.tech> y un proyecto (elige la region mas
   cercana).
2. Copia la cadena de conexion y prepara las dos variantes que usa la app:
   ```
   DATABASE_URL=postgresql+asyncpg://USUARIO:PASSWORD@HOST/DB?ssl=require
   DATABASE_URL_SYNC=postgresql+psycopg2://USUARIO:PASSWORD@HOST/DB?sslmode=require
   ```
   (quita `?sslmode=require` del final si Neon ya lo incluye).
3. No hace falta crear tablas a mano: el backend ejecuta `alembic upgrade head`
   al arrancar.

### 11.2. Backend en Render

1. En <https://render.com> crea un **Web Service** conectado a tu repositorio de
   GitHub:
   - **Root Directory**: `backend`
   - **Runtime**: `Docker` (usa el `Dockerfile` incluido) o `Python`:
     - Build: `pip install -e .`
     - Start: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
2. Variables de entorno:

   ```dotenv
   ENVIRONMENT=production
   SECRET_KEY=<openssl rand -hex 32>
   DATABASE_URL=postgresql+asyncpg://...@....neon.tech/<db>?ssl=require
   DATABASE_URL_SYNC=postgresql+psycopg2://...@...neon.tech/<db>?sslmode=require
   CORS_ORIGINS=https://<tu-app>.vercel.app,http://localhost:3000
   REALTIME_ENABLED=true
   ENABLE_SCHEDULER=true
   FILES_DIR=/data/files
   MAX_UPLOAD_MB=20480
   UPLOAD_CHUNK_MB=25
   UPLOAD_SESSION_TTL_HOURS=48
   ```

   > `CORS_ORIGINS` debe contener el dominio exacto de Vercel (vale tambien el
   > dominio propio, y varios separados por coma). Si dejas el dominio de
   > preview, anade `CORS_ORIGIN_REGEX=^https://.*\.vercel\.app$`.
3. **Archivos y 20 GB**: los servicios gratuitos de Render no conservan el disco
   entre despliegues. Para que los archivos sobrevivan monta un **disco
   persistente** (de pago) en `/data/files` y deja `FILES_DIR=/data/files`. Sin
   disco, chat y calendario funcionan igual, pero los archivos se pierden al
   redesplegar.

### 11.3. Frontend en Vercel

1. Importa el repositorio en <https://vercel.com/new>.
2. **Root Directory**: `frontend` (Vercel detecta Next.js; deja el resto de
   valores por defecto).
3. Variable de entorno (marca **Production** y **Preview**):
   ```
   NEXT_PUBLIC_API_URL=https://<tu-servicio>.onrender.com
   ```
4. Deploy. Cuando tengas el dominio de Vercel, **anadelo a `CORS_ORIGINS`** en
   Render y guarda (el servicio se reinicia solo).

> `NEXT_PUBLIC_API_URL` se incrusta en el build: si cambia la URL del backend,
> vuelve a desplegar en Vercel (Deployments → ⋯ → Redeploy).

### 11.4. Comprobar que todo funciona

1. `https://<tu-servicio>.onrender.com/health` responde con estado ok.
2. Abre la app en Vercel, crea una cuenta y prueba:
   - El **asistente** contesta (modo heuristico si no hay modelo de IA).
   - En **Archivos**, sube un archivo grande: veras la barra de progreso.
   - En **Clases compartidas**, crea una clase, copia el codigo y unete desde
     otro navegador: el chat, el calendario y los archivos se sincronizan.

