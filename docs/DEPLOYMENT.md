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

| Servicio | URL | Query |
|----------|-----|-------|
| Proxy (acceso unico) | http://localhost:8080 | - |
| Frontend | http://localhost:3000 | 11 |
| Backend (Swagger) | http://localhost:8000/docs | 12 |
| PostgreSQL | localhost:5432 | 13 |
| Worker | (sin puerto) | 14 |

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
`core_webservice_get_site_info`, `core_enrol_get_users_courses`,
`mod_assign_get_assignments`.

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

## 11. Publicar gratis en Google Cloud + actualizaciones automaticas (GitHub Actions)

Objetivo: dejar la app **en internet, disponible para todo el mundo, gratis
para siempre**, y que **cada cambio se despliegue solo** al subirlo a GitHub.

Arquitectura:

```
   Tu PC  --git push-->  GitHub  --(Actions)--> construye imagenes -> ghcr.io
                            |                                             |
                            +--------------(SSH deploy)-----------------+
                                                                          v
   Usuarios <--HTTPS--> Caddy <- VM Google Cloud e2-micro (Always Free) -> backend/frontend/db
```

- **GitHub** (gratis): guarda el codigo y, en cada `push` a `main`, construye las
  imagenes Docker y las publica en **GitHub Container Registry** (`ghcr.io`).
- **VM Google Cloud e2-micro "Always Free"**: ejecuta la app 24/7 sin coste. La
  VM solo **descarga** las imagenes ya construidas (no compila, porque tiene
  poca memoria).
- **DuckDNS** (gratis): da un dominio para el HTTPS automatico de Caddy.

> **Coste 0**: se usa solo la capa *Always Free* (1 VM e2-micro + 30 GB de disco
> estandar + IP reservada). Google pide una tarjeta al registrarte **solo para
> verificar identidad**; mientras no salgas de la capa gratuita no se cobra.
> Activa alertas de presupuesto por si acaso.

### 11.1. Crear la cuenta de GitHub y subir el proyecto

1. Crea una cuenta en https://github.com (gratis).
2. Instala Git si no lo tienes: https://git-scm.com/download/win (siguiente,
   siguiente). Abre "Git Bash".
3. En la carpeta del proyecto, sube el codigo (sustituye `TU_USUARIO`):

   ```bash
   cd "ruta/al/proyecto"          # la carpeta academic-autopilot
   git init
   git add .
   git commit -m "Primera version"
   git branch -M main
   # Crea ANTES un repositorio VACIO y PUBLICO en https://github.com/new
   # llamado "academic-autopilot" (sin README ni .gitignore).
   git remote add origin https://github.com/TU_USUARIO/academic-autopilot.git
   git push -u origin main
   ```

   > El repositorio debe ser **Publico**: asi GitHub Actions es gratis sin limite
   > y la VM puede descargar las imagenes sin contraseñas. Secreto alguno
   > (`.env`) no se sube: ya esta en `.gitignore`.

4. Tras el primer `push`, en GitHub ve a **Actions**: se ejecutara el workflow
   "Deploy" (aun fallara en el paso de desplegar porque falta la VM; es normal).

### 11.2. Crear la VM gratuita en Google Cloud

1. Entra en https://console.cloud.google.com y crea una cuenta (te pedira una
   tarjeta para verificar; no se cobra en la capa gratuita).
2. Crea un proyecto nuevo (arriba a la izquierda).
3. **Compute Engine → Instances → Create instance**:
   - Nombre: `academic-autopilot`.
   - **Region**: `us-central1`, `us-east1` o `us-west1` (las unicas donde la
     e2-micro es gratis).
   - **Machine type**: `e2-micro`.
   - **Boot disk**: **Ubuntu 22.04 LTS**, tamaño 30 GB, tipo **Standard**.
   - **Firewall**: marca **Allow HTTP traffic** y **Allow HTTPS traffic**.
   - Crea la instancia.
4. **IP fija**: Networking → **IP addresses → Reserve external static address**
   y asignala a la VM (asi la IP no cambia nunca).
5. Anota la **IP externa** (la usaremos luego como `SSH_HOST`).

### 11.3. Abrir los puertos 80 y 443

En **VPC network → Firewall → Create firewall rule** (dos reglas):
- Nombre `allow-http`, Direction Ingress, Targets: All, Source `0.0.0.0/0`,
  Protocolos y puertos: `tcp:80`.
- Nombre `allow-https`, igual pero `tcp:443`.

### 11.4. Dominio gratis con DuckDNS

1. Entra en https://www.duckdns.org (login con Google/GitHub).
2. Crea un subdominio, p. ej. `miacademia` → `miacademia.duckdns.org`.
3. En el campo de IP pone la **IP externa de la VM** y pulsa *update*
   (o pega esta URL en el navegador cambiando los datos):
   `https://www.duckdns.org/update?domains=miacademia&token=TU_TOKEN&ip=IP_DE_LA_VM`

### 11.5. Preparar la VM (una sola vez)

1. En la consola de Google Cloud, en la VM, pulsa **SSH** (abre una terminal en
   el navegador).
2. Descarga el proyecto y prepara el sistema:

   ```bash
   git clone https://github.com/TU_USUARIO/academic-autopilot.git
   cd academic-autopilot
   bash deploy/gcp-vm-setup.sh        # instala Docker + 2 GB de swap
   ```

3. **Cierra la sesion SSH y vuelve a entrar** (para usar Docker sin `sudo`).
4. Crea el archivo `.env` de la nube:

   ```bash
   cp .env.cloud.example .env
   nano .env
   ```

   Rellena obligatoriamente:
   - `SECRET_KEY` → genera con `openssl rand -hex 32` y pega el resultado.
   - `POSTGRES_PASSWORD` → una contraseña fuerte.
   - `IMAGE_REGISTRY` → `ghcr.io/tu-usuario-github` (tu usuario en **minusculas**).
   - `SITE_ADDRESS`, `CORS_ORIGINS`, `CORS_ORIGIN_REGEX` → tu dominio DuckDNS.
   Guarda con `Ctrl+O`, Enter y sal con `Ctrl+X`.

5. Primer arranque manual:

   ```bash
   ./deploy/server-deploy.sh
   ```

   Caddy obtiene el certificado HTTPS en 1-2 minutos. Abre en el navegador:
   **https://miacademia.duckdns.org**

### 11.6. Conectar GitHub con la VM (para que actualice sola)

1. En la terminal SSH de la VM, genera una clave solo para el despliegue y
   autorizala:

   ```bash
   ssh-keygen -t ed25519 -N "" -f ~/.ssh/gh_actions
   cat ~/.ssh/gh_actions.pub >> ~/.ssh/authorized_keys
   echo "Usuario SSH:"; whoami
   cat ~/.ssh/gh_actions            # COPIA TODO este texto (clave privada)
   ```

2. En GitHub, en el repositorio → **Settings → Secrets and variables → Actions
   → New repository secret**. Crea tres secretos:
   - `SSH_HOST` → la **IP externa** de la VM.
   - `SSH_USER` → el usuario que mostro `whoami` arriba.
   - `SSH_KEY` → **todo** el contenido de `~/.ssh/gh_actions` que copiaste.

3. Listo. A partir de ahora, cada `git push` a `main` reconstruye las imagenes y
   actualiza la app automaticamente (tarda unos minutos). Puedes forzarlo desde
   **Actions → Deploy → Run workflow**.

### 11.7. Actualizaciones del dia a dia

Para publicar un cambio: editar el codigo en tu PC y:

```bash
git add .
git commit -m "Descripcion del cambio"
git push
```

GitHub construye y despliega solo. En la VM no hay que hacer nada.

### 11.8. Inteligencia artificial en la nube

En una VM pequena no cabe Ollama, por eso `.env.cloud.example` ya trae
`AI_DEFAULT_PROVIDER=gemini`. Cada usuario entra en **Ajustes → Motor del
asistente IA**, elige **Gemini** y pega **su propia** clave de
https://aistudio.google.com/apikey (asi no dependes de una sola cuota).

### 11.9. Notas y mantenimiento

- **Backups**: `docker compose -f docker-compose.cloud.yml exec db pg_dump -U autopilot academic_autopilot > backup.sql`.
- **Ver el estado**: `docker compose -f docker-compose.cloud.yml ps` y
  `docker compose -f docker-compose.cloud.yml logs -f`.
- **Repositorio privado** (opcional): si prefieres que el codigo no sea publico,
  deberas (a) iniciar sesion en `ghcr.io` en la VM con un *personal access
  token*, y (b) dar acceso de lectura al repo en el despliegue. Mas complejo;
  para empezar, publico es lo mas sencillo y sigue siendo gratis.
