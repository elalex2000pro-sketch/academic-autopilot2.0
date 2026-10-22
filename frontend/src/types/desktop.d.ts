export {};

declare global {
  interface Window {
    /** Puente mínimo que expone la ventana de Electron al renderer. */
    autopilotDesktop?: {
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
    };
  }
}
