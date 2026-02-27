'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TelemetryData, GPSData } from '@/types/gps';

interface UseTelemetryOptions {
  url?: string;
  onMessage?: (data: TelemetryData) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  reconnectAttempts?: number;
}

interface UseTelemetryReturn {
  isConnected: boolean;
  gpsData: GPSData | null;
  lastMessage: TelemetryData | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

export function useTelemetry({
  url = 'ws://localhost:8000/ws/telemetry',
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  reconnectInterval = 3000,
  reconnectAttempts = 5,
}: UseTelemetryOptions = {}): UseTelemetryReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [gpsData, setGpsData] = useState<GPSData | null>(null);
  const [lastMessage, setLastMessage] = useState<TelemetryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnect = useRef(false);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isManualDisconnect.current = false;
    setError(null);

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectCount.current = 0;
        onConnect?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const data: TelemetryData = JSON.parse(event.data);
          setLastMessage(data);
          
          if (data.gps) {
            setGpsData(data.gps);
          }
          
          onMessage?.(data);
        } catch (err) {
          console.error('Failed to parse telemetry data:', err);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();

        if (!isManualDisconnect.current && reconnectCount.current < reconnectAttempts) {
          reconnectCount.current++;
          console.log(`Reconnecting... Attempt ${reconnectCount.current}/${reconnectAttempts}`);
          
          reconnectTimer.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error');
        onError?.(event);
      };
    } catch (err) {
      setError('Failed to create WebSocket connection');
      console.error('WebSocket creation error:', err);
    }
  }, [url, onMessage, onConnect, onDisconnect, onError, reconnectInterval, reconnectAttempts]);

  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;
    
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const heartbeat = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send('ping');
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(heartbeat);
  }, [isConnected]);

  return {
    isConnected,
    gpsData,
    lastMessage,
    error,
    connect,
    disconnect,
  };
}
