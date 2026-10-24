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
});
