"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Superficie mínima para los semáforos y el marco de la ventana.
contextBridge.exposeInMainWorld("autopilotDesktop", {
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
  // Reconstruye la ventana con marco nativo (false) o frameless (true).
  setCustomTitlebar: (enabled) =>
    ipcRenderer.invoke("window:set-custom-titlebar", Boolean(enabled)),
  // Alias explícito para integraciones que llaman a setFrameless.
  setFrameless: (enabled) => ipcRenderer.invoke("window:set-frameless", Boolean(enabled)),
  getWindowPreferences: () => ipcRenderer.invoke("window:get-preferences"),

  // Actualizaciones silenciosas: el proceso principal descarga el instalador
  // y el renderer solo muestra el estado y pide el reinicio.
  updater: {
    getState: () => ipcRenderer.invoke("updater:get-state"),
    check: () => ipcRenderer.invoke("updater:check"),
    download: () => ipcRenderer.invoke("updater:download"),
    install: () => ipcRenderer.invoke("updater:install"),
    onState: (callback) => {
      if (typeof callback !== "function") return () => undefined;
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("updater:state", listener);
      return () => ipcRenderer.removeListener("updater:state", listener);
    },
  },
});
