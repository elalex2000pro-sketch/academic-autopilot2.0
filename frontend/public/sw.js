/* Service worker de Academic Autopilot.
 *
 * - Guarda el armazon de la app y los recursos de Next para abrirla sin conexion.
 * - Las respuestas de la API se cachean aparte, en IndexedDB, desde el cliente
 *   (asi no se mezclan datos privados con la cache publica del service worker).
 * - Navegacion: red primero; si falla, usa la ultima pagina visitada.
 */
const VERSION = "2026-10-25-1";
const PRECACHE = `autopilot-precache-${VERSION}`;
const STATIC_CACHE = `autopilot-static-${VERSION}`;
const PAGES_CACHE = `autopilot-pages-${VERSION}`;

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

// Guarda el HTML inicial y los chunks que referencia. Sin esto, la primera
// apertura sin conexión podría tener el armazón pero no el JavaScript de Next.
async function precacheShell(cache) {
  try {
    const shell = await fetch("/", { cache: "reload" });
    if (!shell.ok) return;
    await cache.put("/", shell.clone());
    const html = await shell.text();
    const assets = Array.from(
      html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g),
      (match) => match[1],
    );
    await Promise.allSettled(assets.map((url) => cache.add(url)));
  } catch {
    // Si falla, todavía queda la página offline y la copia de navegación.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await precacheShell(cache);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const allowed = new Set([PRECACHE, STATIC_CACHE, PAGES_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !allowed.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      return response;
    }
    throw new Error(`HTTP ${response.status}`);
  } catch {
    return (
      (await cache.match(request)) ||
      (await caches.match(request)) ||
      (await caches.match("/")) ||
      (await caches.match("/offline.html"))
    );
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // La API se gestiona en la app con IndexedDB. Nunca se cachea aqui.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Navegacion interna de Next (RSC): red primero con ultima copia de respaldo.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirstStatic(request));
  }
});
