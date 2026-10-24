"use strict";

const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  ipcMain,
  nativeTheme,
  session,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const APP_URL = (
  process.env.AUTOPILOT_APP_URL || "https://academicautopilot.vercel.app"
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
    registerWindowControls();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

function createWindow(options = {}) {
  const isMac = process.platform === "darwin";
  const isWindows = process.platform === "win32";
  const { useCustomTitlebar } = readWindowPreferences();
  const { bounds, maximized = false, fullScreen = false } = options;

  const win = new BrowserWindow({
    width: bounds?.width ?? 1360,
    height: bounds?.height ?? 900,
    ...(Number.isFinite(bounds?.x) ? { x: bounds.x } : {}),
    ...(Number.isFinite(bounds?.y) ? { y: bounds.y } : {}),
    minWidth: 1024,
    minHeight: 680,
    show: false,
    // La página pinta su propio cristal; el SO aporta el escritorio y el blur.
    // Con marco nativo la ventana debe ser opaca para que Windows dibuje bien
    // la barra de título y los bordes.
    transparent: useCustomTitlebar,
    backgroundColor: useCustomTitlebar
      ? "#00000000"
      : nativeTheme.shouldUseDarkColors
        ? "#10131a"
        : "#eef3fa",
    frame: !useCustomTitlebar,
    hasShadow: true,
    title: "Academic Autopilot",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    ...(useCustomTitlebar && isMac
      ? { vibrancy: "under-window", visualEffectState: "active" }
      : {}),
    ...(useCustomTitlebar && isWindows ? { backgroundMaterial: "acrylic" } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow = win;
  win.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);
  win.webContents.setUserAgent(CHROME_UA);

  win.once("ready-to-show", () => {
    if (maximized) win.maximize();
    if (fullScreen) win.setFullScreen(true);
    if (!SMOKE) win.show();
  });

  win.webContents.on("did-finish-load", () => {
    if (SMOKE) runSmokeTest();
  });

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || win.isDestroyed()) return;
      // -3 = ERR_ABORTED, suele ocurrir en redirecciones normales.
      if (errorCode === -3) return;
      if (SMOKE) {
        finishSmoke(false, `No se pudo cargar ${validatedURL}: ${errorDescription}`);
        return;
      }
      win.loadFile(path.join(__dirname, "offline.html"), {
        query: { target: APP_URL, error: errorDescription || `Error ${errorCode}` },
      });
    },
  );

  // Los enlaces de otras webs se abren en el navegador del sistema, no dentro
  // de la app. Las rutas internas siguen funcionando con normalidad.
  win.webContents.on("will-navigate", (event, targetUrl) => {
    if (isAppUrl(targetUrl) || targetUrl.startsWith("file:")) return;
    event.preventDefault();
    openExternal(targetUrl);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
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
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const ctrl = input.control || input.meta;
    if (input.key === "F5" || (ctrl && input.key.toLowerCase() === "r")) {
      event.preventDefault();
      win.webContents.reload();
    } else if (input.key === "F11") {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    } else if (ctrl && input.shift && input.key.toLowerCase() === "i" && !app.isPackaged) {
      event.preventDefault();
      win.webContents.toggleDevTools();
    }
  });

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.loadURL(APP_URL);
  return win;
}

function windowPreferencesPath() {
  return path.join(app.getPath("userData"), "window-preferences.json");
}

function readWindowPreferences() {
  try {
    const raw = fs.readFileSync(windowPreferencesPath(), "utf8");
    const parsed = JSON.parse(raw);
    return { useCustomTitlebar: parsed.useCustomTitlebar !== false };
  } catch {
    // Primera ejecución (o archivo dañado): se conserva la ventana frameless.
    return { useCustomTitlebar: true };
  }
}

function writeWindowPreferences(preferences) {
  try {
    fs.writeFileSync(windowPreferencesPath(), JSON.stringify(preferences, null, 2), "utf8");
  } catch (error) {
    console.error("No se pudo guardar la preferencia de la ventana:", error);
  }
}

/**
 * `frame` no se puede cambiar en caliente en Electron. Guardamos la
 * preferencia y creamos una ventana nueva con el marco correcto; la anterior
 * se destruye cuando la nueva ya está lista para mostrarse.
 */
function applyCustomTitlebar(event, enabled) {
  const useCustomTitlebar = enabled !== false;
  writeWindowPreferences({ useCustomTitlebar });

  const current = BrowserWindow.fromWebContents(event.sender);
  if (!current || current.isDestroyed()) {
    return { ok: false, useCustomTitlebar };
  }

  const next = createWindow({
    bounds: current.getNormalBounds(),
    maximized: current.isMaximized(),
    fullScreen: current.isFullScreen(),
  });

  next.once("ready-to-show", () => {
    if (!current.isDestroyed()) current.destroy();
  });

  return { ok: true, useCustomTitlebar };
}

function registerWindowControls() {
  ipcMain.on("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on("window:toggle-maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle("window:get-preferences", () => readWindowPreferences());
  ipcMain.handle("window:set-custom-titlebar", (event, enabled) =>
    applyCustomTitlebar(event, enabled),
  );
  // Alias con el nombre que usa la integración (setFrameless).
  ipcMain.handle("window:set-frameless", (event, enabled) =>
    applyCustomTitlebar(event, enabled),
  );
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
