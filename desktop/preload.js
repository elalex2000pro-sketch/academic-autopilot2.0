"use strict";

const { contextBridge, ipcRenderer } = require("electron");

let spotifyAuthListener = null;

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

  // OAuth de Spotify: el proceso principal abre una ventana hija y devuelve
  // aquí el code/state de la redirección para canjearlo en el renderer.
  startSpotifyAuth: (url, redirectUri) =>
    ipcRenderer.invoke("spotify:start-auth", { url, redirectUri }),
  onSpotifyAuth: (callback) => {
    if (typeof callback !== "function") return;
    if (spotifyAuthListener) {
      ipcRenderer.removeListener("spotify:oauth-callback", spotifyAuthListener);
    }
    spotifyAuthListener = (_event, payload) => callback(payload);
    ipcRenderer.on("spotify:oauth-callback", spotifyAuthListener);
  },
  offSpotifyAuth: () => {
    if (!spotifyAuthListener) return;
    ipcRenderer.removeListener("spotify:oauth-callback", spotifyAuthListener);
    spotifyAuthListener = null;
  },

  // Avisos nativos: el renderer envia titulo y cuerpo, el proceso principal
  // crea la notificacion del sistema operativo.
  notify: (payload) => ipcRenderer.invoke("notifications:show", payload),

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
