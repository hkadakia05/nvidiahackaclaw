import type { BackendEvent, HealthResponse, StartRunPayload } from "../types/dashboard";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function buildWebSocketUrl(apiBaseUrl = API_BASE_URL) {
  try {
    const url = new URL(apiBaseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "ws://localhost:8000";
  }
}

export function dashboardWebSocketUrl() {
  return `${buildWebSocketUrl(API_BASE_URL)}/ws/run`;
}

export async function checkBackendHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, { signal });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json();
}

export function createDashboardWebSocket() {
  return new WebSocket(dashboardWebSocketUrl());
}

export function startAgentRun(
  payload: StartRunPayload,
  handlers: {
    onOpen?: () => void;
    onEvent?: (event: BackendEvent) => void;
    onError?: (error: Event) => void;
    onClose?: () => void;
    onMalformedMessage?: (raw: unknown) => void;
  } = {}
) {
  const socket = createDashboardWebSocket();

  socket.onopen = () => {
    handlers.onOpen?.();
    socket.send(JSON.stringify(payload));
  };

  socket.onmessage = (message) => {
    try {
      const parsed = JSON.parse(message.data) as BackendEvent;
      handlers.onEvent?.(parsed);
    } catch {
      handlers.onMalformedMessage?.(message.data);
    }
  };

  socket.onerror = (error) => {
    handlers.onError?.(error);
  };

  socket.onclose = () => {
    handlers.onClose?.();
  };

  return socket;
}
