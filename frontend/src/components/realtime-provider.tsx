"use client";

// Proveedor de sincronizacion en tiempo real: mantiene un WebSocket por sesion
// y notifica a los componentes suscritos cuando cambian los datos en otro dispositivo.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/auth-provider";
import { chatApi, realtimeUrl } from "@/lib/api";
import { notifyChatMessage } from "@/lib/chat-notifications";

export interface RealtimeEvent {
  event: string;
  data?: Record<string, unknown>;
  at?: string;
}

type Listener = (event: RealtimeEvent) => void;

const RealtimeContext = createContext<(listener: Listener) => () => void>(
  () => () => {},
);
const RealtimeConnectedContext = createContext(false);

export function useRealtimeConnected() {
  return useContext(RealtimeConnectedContext);
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const listeners = useRef<Set<Listener>>(new Set());
  const [connected, setConnected] = useState(false);

  // Depender del id (y no del objeto User) evita reconectar el WebSocket cada
  // vez que `/auth/me` refresca el perfil con un objeto nuevo.
  useEffect(() => {
    if (!userId) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastActivity = Date.now();
    setConnected(false);

    const connect = () => {
      if (stopped || !navigator.onLine) return;
      if (timer) clearTimeout(timer);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.onopen = null;
        ws.close();
      }
      setConnected(false);
      const url = realtimeUrl();
      if (!url) return;
      const socket = new WebSocket(url);
      ws = socket;
      lastActivity = Date.now();
      socket.onopen = () => {
        if (stopped || ws !== socket) return;
        lastActivity = Date.now();
        setConnected(true);
        retry = 0;
        // Un dispositivo conectado confirma entrega incluso fuera de /chat.
        void chatApi.markAllDelivered().catch(() => undefined);
        listeners.current.forEach((listener) => {
          try { listener({ event: "reconnected" }); } catch (error) {
            console.error("Error en listener realtime", error);
          }
        });
      };
      socket.onmessage = (message) => {
        if (stopped || ws !== socket) return;
        lastActivity = Date.now();
        try {
          const parsed = JSON.parse(message.data) as RealtimeEvent;
          if (parsed.event === "ping") return;
          if (parsed.event === "chat" && parsed.data?.action === "message") {
            const message = parsed.data.message as { sender_id?: string } | undefined;
            const conversationId = parsed.data.conversation_id;
            if (message?.sender_id !== userId && typeof conversationId === "string") {
              void chatApi.markDelivered(conversationId).catch(() => undefined);
            }
          }
          listeners.current.forEach((listener) => {
            try {
              listener(parsed);
            } catch (error) {
              // Un listener defectuoso no debe dejar sin eventos a los demas.
              console.error("Error en listener realtime", error);
            }
          });
          // El aviso vive aqui y no en la vista de chat para que llegue aunque
          // el usuario este en otra seccion de la app.
          void notifyChatMessage(parsed, userId);
        } catch {
          /* ignora mensajes no JSON */
        }
      };
      socket.onclose = () => {
        if (stopped || ws !== socket) return;
        setConnected(false);
        if (!navigator.onLine) return;
        retry = Math.min(retry + 1, 6);
        timer = setTimeout(connect, Math.min(1000 * retry, 15000));
      };
      socket.onerror = () => socket.close();
    };

    // El servidor envía ping cada 15 s: una conexión muda no está sana.
    const watchdog = setInterval(() => {
      if (ws && Date.now() - lastActivity > 45_000) {
        setConnected(false);
        ws.close();
      }
    }, 10_000);
    const resume = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (!ws || ws.readyState === WebSocket.CLOSED || Date.now() - lastActivity > 45_000)
        connect();
    };
    const offline = () => {
      setConnected(false);
      if (timer) clearTimeout(timer);
      ws?.close();
    };
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    connect();
    return () => {
      stopped = true;
      setConnected(false);
      if (timer) clearTimeout(timer);
      clearInterval(watchdog);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      ws?.close();
    };
  }, [userId]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return (
    <RealtimeContext.Provider value={subscribe}>
      <RealtimeConnectedContext.Provider value={connected}>
        {children}
      </RealtimeConnectedContext.Provider>
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
