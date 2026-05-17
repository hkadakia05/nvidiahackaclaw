import { API_BASE_URL, dashboardWebSocketUrl } from "./api";
import type { AgentEvent, AgentStatus, AlertItem, BackendEvent, BrowserConfig, ClusterNode, EventLevel, PolicyStatus } from "../types/dashboard";

declare global {
  interface Window {
    __AGENTCONTROL_CONFIG__?: BrowserConfig;
  }
}

export function getConfig() {
  const browserConfig =
    typeof window !== "undefined" && window.__AGENTCONTROL_CONFIG__
      ? window.__AGENTCONTROL_CONFIG__
      : {};

  return {
    apiBaseUrl: browserConfig.apiBaseUrl || API_BASE_URL,
    wsUrl: browserConfig.wsUrl || dashboardWebSocketUrl(),
    runUrl: browserConfig.runUrl || `${API_BASE_URL}/ws/run`,
  };
}

export function createId(prefix = "evt") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function isEventLevel(value: unknown): value is EventLevel {
  return (
    value === "info" ||
    value === "approved" ||
    value === "denied" ||
    value === "blocked" ||
    value === "completed" ||
    value === "warning"
  );
}

export function normalizeBackendLevel(event: BackendEvent): EventLevel {
  if (event.decision === "deny") return "blocked";
  if (event.decision === "requires_approval") return "warning";
  if (event.decision === "allow") return "approved";

  if (
    event.type === "action_blocked" ||
    event.type === "sandbox_violation" ||
    event.type === "security_denied"
  ) {
    return "blocked";
  }

  if (
    event.type === "run_complete" ||
    event.type === "runtime_completed" ||
    event.type === "repo_clone_completed" ||
    event.type === "sandbox_completed" ||
    event.type === "audit_written"
  ) {
    return "completed";
  }

  if (
    event.type === "action_allowed" ||
    event.type === "security_allowed" ||
    event.level === "success"
  ) {
    return "approved";
  }

  if (
    event.type === "run_failed" ||
    event.type === "runtime_failed" ||
    event.type === "error" ||
    event.level === "error"
  ) {
    return "denied";
  }

  if (event.level === "warning") return "warning";
  if (isEventLevel(event.level)) return event.level;

  return "info";
}

export function levelLabel(level: EventLevel) {
  const labels: Record<EventLevel, string> = {
    info: "Info",
    approved: "Approved",
    denied: "Denied",
    blocked: "Blocked",
    completed: "Completed",
    warning: "Warning",
  };

  return labels[level];
}

export function levelClass(level: EventLevel) {
  const classes: Record<EventLevel, string> = {
    info: "text-slate-500",
    approved: "text-emerald-700",
    denied: "text-amber-700",
    blocked: "text-red-700",
    completed: "text-blue-700",
    warning: "text-orange-700",
  };

  return classes[level];
}

export function statusClass(status: AgentStatus["status"]) {
  const classes: Record<AgentStatus["status"], string> = {
    idle: "text-slate-500",
    running: "text-blue-700",
    paused: "text-amber-700",
    blocked: "text-red-700",
    completed: "text-emerald-700",
    "heavy-load": "text-orange-700",
  };

  return classes[status];
}

export function policyStatusClass(status: PolicyStatus["status"]) {
  const classes: Record<PolicyStatus["status"], string> = {
    active: "text-emerald-700",
    monitoring: "text-blue-700",
    "needs-review": "text-amber-700",
  };

  return classes[status];
}

export function severityClass(severity: AlertItem["severity"]) {
  const classes: Record<AlertItem["severity"], string> = {
    low: "text-slate-600",
    medium: "text-amber-700",
    high: "text-red-700",
  };

  return classes[severity];
}

export function nodeStatusClass(status: ClusterNode["status"]) {
  const classes: Record<ClusterNode["status"], string> = {
    healthy: "text-emerald-700",
    busy: "text-amber-700",
    degraded: "text-red-700",
  };

  return classes[status];
}

export function normalizeMetadata(value: unknown): AgentEvent["metadata"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const metadata: AgentEvent["metadata"] = {};

  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      metadata[key] = entry;
    }
  }

  return metadata;
}

function addMetadataValue(
  metadata: AgentEvent["metadata"],
  key: string,
  value: unknown
) {
  if (
    metadata &&
    (typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean")
  ) {
    metadata[key] = value;
  }
}

export function normalizeEvent(raw: unknown): AgentEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const event = raw as BackendEvent;

  if (typeof event.message !== "string" || typeof event.type !== "string") {
    return null;
  }

  const metadata = normalizeMetadata(event.metadata);
  addMetadataValue(metadata, "run_id", event.run_id);
  addMetadataValue(metadata, "source", event.source);
  addMetadataValue(metadata, "action_type", event.action_type);
  addMetadataValue(metadata, "tool_name", event.tool_name);
  addMetadataValue(metadata, "command", event.command);
  addMetadataValue(metadata, "path", event.path);
  addMetadataValue(metadata, "domain", event.domain);
  addMetadataValue(metadata, "decision", event.decision);
  addMetadataValue(metadata, "risk_level", event.risk_level);
  addMetadataValue(metadata, "policy_triggered", event.policy_triggered);
  addMetadataValue(metadata, "reason", event.reason);
  addMetadataValue(metadata, "agent", event.agent);
  addMetadataValue(metadata, "route", event.route);
  addMetadataValue(metadata, "gpu_cost", event.gpu_cost);
  addMetadataValue(metadata, "approved", event.approved);
  addMetadataValue(metadata, "worker_agent_name", event.worker_agent_name);
  addMetadataValue(metadata, "worker_agent_type", event.worker_agent_type);
  addMetadataValue(metadata, "worker_agent_status", event.worker_agent_status);
  addMetadataValue(metadata, "requested_action", event.requested_action);
  addMetadataValue(metadata, "requested_tool", event.requested_tool);
  addMetadataValue(metadata, "requested_tool_action", event.requested_tool_action);
  addMetadataValue(metadata, "model", event.model);
  addMetadataValue(metadata, "estimated_gpu_cost", event.estimated_gpu_cost);
  addMetadataValue(metadata, "budget_decision", event.budget_decision);
  addMetadataValue(metadata, "security_decision", event.security_decision);
  addMetadataValue(metadata, "verifier_decision", event.verifier_decision);

  return {
    id: typeof event.id === "string" ? event.id : createId(),
    timestamp: typeof event.timestamp === "string" ? event.timestamp : new Date().toISOString(),
    type: event.type,
    message: event.message,
    level: normalizeBackendLevel(event),
    metadata,
  };
}

export function runNormalizationTests() {
  const validEvent = normalizeEvent({
    type: "cache.hit",
    message: "Duplicate call served from Redis cache",
    level: "completed",
    metadata: { latencyMs: 18, nested: { ignored: true } },
  });

  console.assert(validEvent?.level === "completed", "valid event levels should be preserved");
  console.assert(validEvent?.metadata?.latencyMs === 18, "primitive metadata values should be preserved");
  console.assert(!validEvent?.metadata?.nested, "non-primitive metadata values should be ignored");
  console.assert(normalizeEvent({ message: "Missing type" }) === null, "events without a string type should be rejected");
  console.assert(normalizeEvent({ type: "missing.message" }) === null, "events without a string message should be rejected");
  console.assert(formatTime("not-a-date") === "--:--:--", "invalid timestamps should render safely");

  const invalidLevelEvent = normalizeEvent({
    type: "policy.check",
    message: "Unknown level should become info",
    level: "weird",
  });

  console.assert(invalidLevelEvent?.level === "info", "unknown event levels should fall back to info");

  const warningEvent = normalizeEvent({
    type: "budget.guard.warning",
    message: "Budget warning",
    level: "warning",
  });

  console.assert(warningEvent?.level === "warning", "warning events should be supported");

  const config = getConfig();
  console.assert(config.wsUrl.length > 0, "config should always provide a WebSocket URL");
  console.assert(config.runUrl.length > 0, "config should always provide a run URL");
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function getWorkflowCount(agents: AgentStatus[]) {
  return new Set(agents.map((agent) => agent.workflow)).size;
}

function metadataString(event: AgentEvent, key: string) {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function metadataNumber(event: AgentEvent, key: string) {
  const value = event.metadata?.[key];

  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function agentStatusFromEvent(event: AgentEvent): AgentStatus["status"] {
  const status = metadataString(event, "worker_agent_status");

  if (
    status === "idle" ||
    status === "running" ||
    status === "paused" ||
    status === "blocked" ||
    status === "completed" ||
    status === "heavy-load"
  ) {
    return status;
  }

  if (event.level === "blocked" || event.level === "denied") return "blocked";
  if (event.level === "completed" || event.type === "run_complete") return "completed";
  if ((metadataNumber(event, "gpuUsage") ?? 0) >= 85) return "heavy-load";
  return "running";
}

export function deriveAgentsFromEvents(events: AgentEvent[]): AgentStatus[] {
  const agents = new Map<string, AgentStatus>();

  for (const event of events) {
    const name = metadataString(event, "worker_agent_name");
    if (!name) continue;

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const gpuUsage =
      metadataNumber(event, "gpuUsage") ??
      metadataNumber(event, "estimated_gpu_cost") ??
      metadataNumber(event, "gpu_cost") ??
      0;
    const costPerHour =
      metadataNumber(event, "costPerHour") ??
      metadataNumber(event, "estimated_gpu_cost") ??
      0;

    agents.set(id, {
      id,
      name,
      role: metadataString(event, "worker_agent_type") ?? "backend simulated worker",
      status: agentStatusFromEvent(event),
      gpuUsage,
      costPerHour,
      currentAction:
        metadataString(event, "requested_tool_action") ??
        metadataString(event, "requested_action") ??
        event.message,
      workflow: metadataString(event, "run_id") ?? "current run",
    });
  }

  return Array.from(agents.values());
}

export function isBlockedOrDeniedEvent(event: AgentEvent) {
  return (
    event.level === "blocked" ||
    event.level === "denied" ||
    event.type === "action_blocked" ||
    event.type === "approval_required" ||
    event.type === "sandbox_violation" ||
    event.metadata?.decision === "deny" ||
    event.metadata?.decision === "requires_approval"
  );
}

export function deriveAlertsFromEvents(events: AgentEvent[]): AlertItem[] {
  return events
    .filter(
      (event) =>
        event.level === "warning" ||
        event.level === "denied" ||
        event.level === "blocked" ||
        event.type === "run_failed" ||
        event.type === "security_warning" ||
        event.type === "sandbox_violation" ||
        event.type === "resource_limit_hit"
    )
    .map((event) => ({
      id: event.id,
      severity: event.level === "warning" ? "medium" : "high",
      title: event.type.replaceAll("_", " "),
      description: event.message,
      timestamp: event.timestamp,
      status: event.type === "run_failed" ? "open" : "watching",
    }));
}

export function securityEventsFromEvents(events: AgentEvent[]) {
  return events.filter(
    (event) =>
      event.metadata?.source === "security" ||
      event.type.includes("policy") ||
      event.type.includes("security") ||
      event.type === "action_blocked" ||
      event.type === "action_allowed" ||
      event.type === "approval_required" ||
      event.type === "sandbox_violation" ||
      event.type === "resource_check" ||
      event.type === "audit_written"
  );
}
