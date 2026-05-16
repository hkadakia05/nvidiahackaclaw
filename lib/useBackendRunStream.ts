"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentEvent, BackendEvent, ChartPoint, ConnectionStatus } from "../types/dashboard";
import { fallbackEvents, initialChartData } from "./mockData";
import {
  checkBackendHealth,
  createDashboardWebSocket,
  startAgentRun,
} from "./api";
import {
  createId,
  formatTime,
  getConfig,
  normalizeEvent,
} from "./utils";

export function useBackendRunStream(initialEvents: AgentEvent[] = fallbackEvents) {
  const [events, setEvents] = useState<AgentEvent[]>(initialEvents);
  const [chartData, setChartData] = useState<ChartPoint[]>(initialChartData);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("checking");
  const [isRunning, setIsRunning] = useState(false);
  const [hasBackendEvents, setHasBackendEvents] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const receivedBackendEventRef = useRef(false);
  const config = useMemo(() => getConfig(), []);

  const addDashboardEvent = useCallback((raw: BackendEvent | AgentEvent) => {
    const normalized = normalizeEvent(raw);

    if (!normalized) return;

    if (normalized.type === "run_complete" || normalized.type === "run_failed") {
      setIsRunning(false);
    }

    setHasBackendEvents(true);
    setEvents((current) => {
      const shouldReplaceFallback = !receivedBackendEventRef.current;
      receivedBackendEventRef.current = true;
      const next = shouldReplaceFallback ? [normalized] : [...current, normalized];
      return next.slice(-100);
    });

    setChartData((current) => {
      const last = current[current.length - 1];
      const nextPoint: ChartPoint = {
        time: formatTime(normalized.timestamp),
        gpu: Number(normalized.metadata?.gpuUsage ?? last?.gpu ?? 0),
        savings: Number(normalized.metadata?.costSaved ?? last?.savings ?? 0),
        cost: Number(normalized.metadata?.costPerHour ?? last?.cost ?? 0),
      };

      return [...current, nextPoint].slice(-24);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let socket: WebSocket | null = null;

    try {
      checkBackendHealth(controller.signal)
        .then(() => setConnectionStatus("connecting"))
        .catch((error) => {
          console.warn("Backend health check failed; using fallback dashboard data.", error);
          setConnectionStatus("offline");
        });

      if (typeof WebSocket === "undefined") {
        window.setTimeout(() => setConnectionStatus("offline"), 0);
        return;
      }

      socket = createDashboardWebSocket();
      socketRef.current = socket;

      socket.onopen = () => setConnectionStatus("connected");
      socket.onmessage = (message) => {
        try {
          addDashboardEvent(JSON.parse(message.data));
        } catch (error) {
          console.warn("Ignoring malformed backend WebSocket event.", error);
        }
      };
      socket.onerror = (error) => {
        console.warn("Backend WebSocket connection failed.", error);
        setConnectionStatus("offline");
      };
      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
      };
    } catch (error) {
      console.error("Failed to initialize dashboard connection:", error);
      window.setTimeout(() => setConnectionStatus("offline"), 0);
    }

    return () => {
      controller.abort();

      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }
    };
  }, [addDashboardEvent]);

  const runAgentControl = useCallback(() => {
    setIsRunning(true);

    const localEvent: AgentEvent = {
      id: createId(),
      timestamp: new Date().toISOString(),
      type: "run.started",
      message: "AgentControl run requested from frontend",
      level: "info",
      metadata: { source: "ui" },
    };

    setEvents((current) => [...current, localEvent].slice(-100));

    try {
      const existingSocket = socketRef.current;

      if (existingSocket?.readyState === WebSocket.OPEN) {
        existingSocket.send(JSON.stringify({ task: "test task" }));
      } else {
        socketRef.current = startAgentRun(
          { task: "test task" },
          {
            onOpen: () => setConnectionStatus("connected"),
            onEvent: addDashboardEvent,
            onMalformedMessage: (raw) => console.warn("Ignoring malformed backend event.", raw),
            onError: (error) => {
              console.warn("Backend run WebSocket failed.", error);
              setConnectionStatus("offline");
              setIsRunning(false);
            },
            onClose: () => {
              socketRef.current = null;
              setIsRunning(false);
            },
          }
        );
      }
    } catch (error) {
      console.warn("Failed to start backend run; showing fallback event.", error);
      const offlineEvent: AgentEvent = {
        id: createId(),
        timestamp: new Date(Date.now()).toISOString(),
        type: "backend.unavailable",
        message: "Backend run endpoint unavailable; showing local fallback state",
        level: "denied",
        metadata: { runUrl: config.runUrl },
      };

      setEvents((current) =>
        [...current, offlineEvent].slice(-100)
      );
      setIsRunning(false);
    }
  }, [addDashboardEvent, config.runUrl]);

  return {
    addDashboardEvent,
    chartData,
    config,
    connectionStatus,
    events,
    hasBackendEvents,
    isRunning,
    runAgentControl,
  };
}
