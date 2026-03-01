'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { TelemetryData } from '@/types/gps';

interface TelemetryContextValue {
  /** Latest telemetry frame from the WebSocket (null until first message). */
  telemetry: TelemetryData | null;
  /** Whether the WebSocket is currently connected. */
  connected: boolean;
}

const TelemetryContext = createContext<TelemetryContextValue>({
  telemetry: null,
  connected: false,
});

export function useTelemetry() {
  return useContext(TelemetryContext);
}

const WS_URL = 'ws://127.0.0.1:8000/ws/telemetry';
const RECONNECT_DELAY = 3000;

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmounted) setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as TelemetryData;
          if (data.type === 'telemetry') {
            setTelemetry(data);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          setConnected(false);
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <TelemetryContext.Provider value={{ telemetry, connected }}>
      {children}
    </TelemetryContext.Provider>
  );
}
