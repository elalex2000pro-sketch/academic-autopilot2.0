"use client";

// Proveedor de sincronizacion en tiempo real: mantiene un WebSocket por sesion
// y notifica a los componentes suscritos cuando cambian los datos en otro dispositivo.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/auth-provider";
import { realtimeUrl } from "@/lib/api";

export interface RealtimeEvent {
  event: string;
  data?: Record<string, unknown>;
  at?: string;
}

type Listener = (event: RealtimeEvent) => void;

const RealtimeContext = createContext<(listener: Listener) => () => void>(
  () => () => {},
);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const listeners = useRef<Set<Listener>>(new Set());

  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const url = realtimeUrl();
      if (!url) return;
      ws = new WebSocket(url);
      ws.onopen = () => {
        retry = 0;
      };
      ws.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data) as RealtimeEvent;
          if (parsed.event === "ping") return;
          listeners.current.forEach((listener) => listener(parsed));
        } catch {
          /* ignora mensajes no JSON */
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        retry = Math.min(retry + 1, 6);
        timer = setTimeout(connect, Math.min(1000 * retry, 15000));
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [user]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return (
    <RealtimeContext.Provider value={subscribe}>
      {children}
    </RealtimeContext.Provider>
  );
}

// Hook para reaccionar a eventos en tiempo real desde cualquier pagina.
export function useRealtime(handler: Listener) {
  const subscribe = useContext(RealtimeContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => subscribe((event) => handlerRef.current(event)), [subscribe]);
}
