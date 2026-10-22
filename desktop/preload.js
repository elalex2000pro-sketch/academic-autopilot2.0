"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Superficie mínima para los semáforos de la ventana frameless.
contextBridge.exposeInMainWorld("autopilotDesktop", {
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
});
