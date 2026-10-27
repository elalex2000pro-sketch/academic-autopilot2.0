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

// electron-updater se carga de forma tolerante para que `npm start` siga
// funcionando aunque las dependencias aún no se hayan instalado.
let autoUpdater = null;
try {
  ({ autoUpdater } = require("electron-updater"));
} catch (error) {
  console.warn("electron-updater no está disponible:", error.message);
}

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

// --- Auto-actualizaciones silenciosas -------------------------------------
// `electron-updater` descarga el instalador en segundo plano y lo aplica al
// reiniciar. El renderer solo recibe el estado por IPC y muestra el aviso.
const UPDATE_START_DELAY_MS = 4000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas
let updateCheckTimer = null;
let updateInstallStarted = false;
let updateState = {
  status: "idle", // idle | checking | available | downloading | ready | current | error | disabled
  version: null,
  progress: 0,
  transferred: 0,
  total: 0,
  bytesPerSecond: 0,
  releaseNotes: "",
  releaseDate: null,
  error: null,
};

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
    registerUpdaterControls();
    configureAutoUpdater();
    createWindow();
    scheduleUpdateChecks();
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

function normalizeReleaseNotes(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => (item && typeof item.note === "string" ? item.note : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function broadcastUpdateState() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send("updater:state", { ...updateState });
  }
}

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  broadcastUpdateState();
}

function configureAutoUpdater() {
  if (!autoUpdater) {
    updateState = { ...updateState, status: "disabled" };
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = console;

  autoUpdater.on("checking-for-update", () => {
    setUpdateState({ status: "checking", error: null });
  });

  autoUpdater.on("update-available", (info) => {
    setUpdateState({
      status: "available",
      version: info?.version ?? null,
      releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
      releaseDate: info?.releaseDate ?? null,
      progress: 0,
      transferred: 0,
      total: 0,
      error: null,
    });
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateState({ status: "current", progress: 0, error: null });
  });

  autoUpdater.on("download-progress", (progress) => {
    setUpdateState({
      status: "downloading",
      progress: Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0))),
      transferred: progress?.transferred ?? 0,
      total: progress?.total ?? 0,
      bytesPerSecond: progress?.bytesPerSecond ?? 0,
      error: null,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setUpdateState({
      status: "ready",
      version: info?.version ?? updateState.version,
      releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
      releaseDate: info?.releaseDate ?? updateState.releaseDate,
      progress: 100,
      error: null,
    });
  });

  autoUpdater.on("update-cancelled", () => {
    setUpdateState({ status: "available", progress: 0 });
  });

  autoUpdater.on("error", (error) => {
    console.error("Error del actualizador:", error);
    setUpdateState({
      status: "error",
      error: error?.message || "No se pudo comprobar la actualización.",
    });
  });
}

function scheduleUpdateChecks() {
  if (SMOKE) return;

  if (!autoUpdater || !app.isPackaged) {
    // En desarrollo no hay app-update.yml ni instalador que actualizar.
    setUpdateState({ status: "disabled" });
    return;
  }

  const check = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error("No se pudo comprobar la actualización:", error);
      setUpdateState({
        status: "error",
        error: error?.message || "No se pudo comprobar la actualización.",
      });
    });
  };

  // Espera a que la ventana termine de pintar para no competir con el arranque.
  setTimeout(check, UPDATE_START_DELAY_MS);
  updateCheckTimer = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
  if (typeof updateCheckTimer.unref === "function") updateCheckTimer.unref();
}

function isTrustedRenderer(event) {
  try {
    const rawUrl = event.senderFrame?.url || event.sender.getURL();
    return new URL(rawUrl).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function registerUpdaterControls() {
  ipcMain.handle("updater:get-state", (event) => {
    if (!isTrustedRenderer(event)) throw new Error("Origen no autorizado");
    return { ...updateState };
  });

  ipcMain.handle("updater:check", async (event) => {
    if (!isTrustedRenderer(event)) throw new Error("Origen no autorizado");
    if (!autoUpdater || !app.isPackaged) {
      setUpdateState({ status: "disabled" });
      return { ...updateState };
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      setUpdateState({
        status: "error",
        error: error?.message || "No se pudo comprobar la actualización.",
      });
    }
    return { ...updateState };
  });

  ipcMain.handle("updater:download", async (event) => {
    if (!isTrustedRenderer(event)) throw new Error("Origen no autorizado");
    if (!autoUpdater || !app.isPackaged) {
      return { ...updateState, status: "disabled" };
    }
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      // Si ya hay una descarga en curso, no es un fallo real.
      if (!/already|in progress/i.test(String(error?.message ?? ""))) {
        setUpdateState({
          status: "error",
          error: error?.message || "No se pudo descargar la actualización.",
        });
      }
    }
    return { ...updateState };
  });

  ipcMain.handle("updater:install", (event) => {
    if (!isTrustedRenderer(event)) throw new Error("Origen no autorizado");
    if (!autoUpdater || !app.isPackaged) {
      return { ok: false, reason: "not-packaged" };
    }
    if (updateState.status !== "ready") {
      return { ok: false, reason: "not-ready" };
    }
    if (updateInstallStarted) return { ok: true };

    updateInstallStarted = true;
    // Instalación silenciosa y relanzado automático al terminar.
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
    return { ok: true };
  });
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

app.on("will-quit", () => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
