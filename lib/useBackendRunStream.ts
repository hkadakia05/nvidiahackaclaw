"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentEvent, BackendEvent, ChartPoint, ConnectionStatus } from "../types/dashboard";
import {
  checkBackendHealth,
  createDashboardWebSocket,
  startAgentRun,
} from "./api";
import {
  formatTime,
  getConfig,
  normalizeEvent,
} from "./utils";

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function closeSocketQuietly(socket: WebSocket | null) {
  if (!socket || socket.readyState === WebSocket.CLOSED) return;

  try {
    socket.close();
  } catch (error) {
    console.warn("Failed to close backend WebSocket during cleanup.", error);
  }
}

let sharedEvents: AgentEvent[] = [];
let sharedChartData: ChartPoint[] = [];
let sharedHasBackendEvents = false;

export function useBackendRunStream(initialEvents: AgentEvent[] = []) {
  const [events, setEvents] = useState<AgentEvent[]>(
    sharedEvents.length > 0 ? sharedEvents : initialEvents
  );
  const [chartData, setChartData] = useState<ChartPoint[]>(sharedChartData);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("checking");
  const [isRunning, setIsRunning] = useState(false);
  const [hasBackendEvents, setHasBackendEvents] = useState(sharedHasBackendEvents);
  const socketRef = useRef<WebSocket | null>(null);
  const receivedBackendEventRef = useRef(false);
  const config = useMemo(() => getConfig(), []);

  const addDashboardEvent = useCallback((raw: BackendEvent | AgentEvent) => {
    const normalized = normalizeEvent(raw);

    if (!normalized) return;

    if (normalized.type === "run_complete" || normalized.type === "run_failed") {
      setIsRunning(false);
    }

    sharedHasBackendEvents = true;
    setHasBackendEvents(true);
    setEvents((current) => {
      receivedBackendEventRef.current = true;
      const next = [...current, normalized];
      sharedEvents = next.slice(-100);
      return sharedEvents;
    });

    setChartData((current) => {
      const hasMetric =
        normalized.metadata?.gpuUsage !== undefined ||
        normalized.metadata?.costSaved !== undefined ||
        normalized.metadata?.costPerHour !== undefined;

      if (!hasMetric) return current;

      const last = current[current.length - 1];
      const nextPoint: ChartPoint = {
        time: formatTime(normalized.timestamp),
        gpu: Number(normalized.metadata?.gpuUsage ?? last?.gpu ?? 0),
        savings: Number(normalized.metadata?.costSaved ?? last?.savings ?? 0),
        cost: Number(normalized.metadata?.costPerHour ?? last?.cost ?? 0),
      };

      sharedChartData = [...current, nextPoint].slice(-24);
      return sharedChartData;
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let socket: WebSocket | null = null;
    let isCleaningUp = false;

    try {
      checkBackendHealth(controller.signal)
        .then(() => setConnectionStatus("connecting"))
        .catch((error) => {
          if (controller.signal.aborted || isAbortError(error)) {
            return;
          }

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
        if (isCleaningUp || socket?.readyState === WebSocket.CLOSING) {
          return;
        }

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
      isCleaningUp = true;
      controller.abort();
      closeSocketQuietly(socket);
    };
  }, [addDashboardEvent]);

  const runAgentControl = useCallback(() => {
    setIsRunning(true);

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
      console.warn("Failed to start backend run.", error);
      setIsRunning(false);
    }
  }, [addDashboardEvent]);

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
