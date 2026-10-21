"use strict";

const { app, BrowserWindow, Menu, Notification, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const APP_URL = (
  process.env.AUTOPILOT_APP_URL || "https://academic-autopilot2-0.vercel.app"
).replace(/\/+$/, "");
const APP_ORIGIN = new URL(APP_URL).origin;
const PARTITION = "persist:academic-autopilot";
const SMOKE = process.env.AUTOPILOT_SMOKE === "1";
const SMOKE_FILE = process.env.AUTOPILOT_SMOKE_FILE || "";
const ICON_PATH = path.join(__dirname, "assets", "icon.png");
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36 AcademicAutopilotDesktop/${app.getVersion()}`;

let mainWindow = null;
let smokeFinished = false;
let smokeTimer = null;

app.setAppUserModelId("com.academicautopilot.desktop");

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    configureSession(session.fromPartition(PARTITION));
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#f7f7fc",
    title: "Academic Autopilot",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);
  mainWindow.webContents.setUserAgent(CHROME_UA);

  mainWindow.once("ready-to-show", () => {
    if (!SMOKE && mainWindow) mainWindow.show();
  });

  mainWindow.webContents.on("did-finish-load", () => {
    if (SMOKE) runSmokeTest();
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || !mainWindow) return;
      // -3 = ERR_ABORTED, suele ocurrir en redirecciones normales.
      if (errorCode === -3) return;
      if (SMOKE) {
        finishSmoke(false, `No se pudo cargar ${validatedURL}: ${errorDescription}`);
        return;
      }
      mainWindow.loadFile(path.join(__dirname, "offline.html"), {
        query: { target: APP_URL, error: errorDescription || `Error ${errorCode}` },
      });
    },
  );

  // Los enlaces de otras webs se abren en el navegador del sistema, no dentro
  // de la app. Las rutas internas siguen funcionando con normalidad.
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (isAppUrl(targetUrl) || targetUrl.startsWith("file:")) return;
    event.preventDefault();
    openExternal(targetUrl);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1100,
          height: 760,
          icon: ICON_PATH,
          autoHideMenuBar: true,
          webPreferences: {
            partition: PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }
    openExternal(url);
    return { action: "deny" };
  });

  // Atajos utiles sin depender de la barra de menus.
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const ctrl = input.control || input.meta;
    if (input.key === "F5" || (ctrl && input.key.toLowerCase() === "r")) {
      event.preventDefault();
      mainWindow?.webContents.reload();
    } else if (input.key === "F11") {
      event.preventDefault();
      if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
    } else if (ctrl && input.shift && input.key.toLowerCase() === "i" && !app.isPackaged) {
      event.preventDefault();
      mainWindow?.webContents.toggleDevTools();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(APP_URL);
}

function configureSession(appSession) {
  const allowedPermissions = new Set([
    "notifications",
    "clipboard-sanitized-write",
    "fullscreen",
    "media",
  ]);

  appSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return isAppOrigin(requestingOrigin) && allowedPermissions.has(permission);
  });

  appSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      const origin = details.requestingUrl || "";
      callback(isAppOrigin(origin) && allowedPermissions.has(permission));
    },
  );

  appSession.on("will-download", (_event, item) => {
    const filename = safeFilename(item.getFilename());
    let target = path.join(app.getPath("downloads"), filename);
    if (fs.existsSync(target)) {
      const extension = path.extname(filename);
      const base = path.basename(filename, extension);
      target = path.join(
        app.getPath("downloads"),
        `${base}-${new Date().toISOString().replace(/[:.]/g, "-")}${extension}`,
      );
    }
    item.setSavePath(target);
    item.once("done", (_downloadEvent, state) => {
      if (state !== "completed") return;
      if (Notification.isSupported()) {
        new Notification({
          title: "Descarga completada",
          body: path.basename(target),
          icon: ICON_PATH,
        }).show();
      }
    });
  });
}

function isAppUrl(targetUrl) {
  try {
    const url = new URL(targetUrl);
    return url.origin === APP_ORIGIN && url.protocol === "https:";
  } catch {
    return false;
  }
}

function isAppOrigin(origin) {
  try {
    return new URL(origin).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function openExternal(targetUrl) {
  try {
    const url = new URL(targetUrl);
    if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:") {
      void shell.openExternal(targetUrl);
    }
  } catch {
    // Ignorar enlaces mal formados.
  }
}

function safeFilename(filename) {
  const cleaned = String(filename || "descarga")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .trim();
  return cleaned || "descarga";
}

function runSmokeTest() {
  if (!mainWindow || smokeFinished) return;
  smokeFinished = true;
  if (smokeTimer) clearTimeout(smokeTimer);
  mainWindow.webContents
    .executeJavaScript(
      `({ title: document.title, href: location.href, userAgent: navigator.userAgent, text: (document.body.innerText || "").slice(0, 500) })`,
      true,
    )
    .then((result) => {
      const ok =
        result &&
        typeof result.href === "string" &&
        result.href.startsWith(APP_ORIGIN) &&
        String(result.userAgent).includes("AcademicAutopilotDesktop/") &&
        (String(result.title).includes("Academic Autopilot") ||
          String(result.text).includes("Academic Autopilot"));
      finishSmoke(
        ok,
        ok
          ? "La app de escritorio carga la web correctamente."
          : "La página cargada no parece Academic Autopilot o falta la identificación de escritorio.",
      );
    })
    .catch((error) => finishSmoke(false, error.message));
}

function finishSmoke(ok, message) {
  if (smokeTimer) clearTimeout(smokeTimer);
  const payload = {
    ok,
    message,
    url: APP_URL,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    at: new Date().toISOString(),
  };
  if (SMOKE_FILE) {
    try {
      fs.writeFileSync(SMOKE_FILE, JSON.stringify(payload, null, 2), "utf8");
    } catch {
      // El código de salida sigue indicando el resultado.
    }
  }
  console.log(`SMOKE ${ok ? "OK" : "FAIL"}: ${message}`);
  app.exit(ok ? 0 : 1);
}

if (SMOKE) {
  smokeTimer = setTimeout(() => {
    finishSmoke(false, "Tiempo de espera agotado al cargar la app.");
  }, 45000);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
