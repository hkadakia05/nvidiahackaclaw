export type EventLevel = "info" | "approved" | "denied" | "blocked" | "completed" | "warning";

export type ConnectionStatus = "checking" | "connecting" | "connected" | "offline";

export type PrimitiveMetadataValue = string | number | boolean;

export type EventMetadata = Record<string, PrimitiveMetadataValue>;

export type AgentEvent = {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  level: EventLevel;
  metadata?: EventMetadata;
};

export type BackendEvent = {
  id?: string;
  run_id?: string;
  type?: string;
  source?: string;
  level?: string;
  message?: string;
  timestamp?: string;
  action_type?: string | null;
  tool_name?: string | null;
  command?: string | null;
  path?: string | null;
  domain?: string | null;
  decision?: string | null;
  risk_level?: string | null;
  policy_triggered?: string | null;
  reason?: string | null;
  agent?: string | null;
  route?: string | null;
  gpu_cost?: number | string | null;
  approved?: boolean | string | null;
  worker_agent_name?: string | null;
  worker_agent_type?: string | null;
  worker_agent_status?: string | null;
  requested_action?: string | null;
  requested_tool?: string | null;
  requested_tool_action?: string | null;
  model?: string | null;
  estimated_gpu_cost?: number | string | null;
  budget_decision?: string | null;
  security_decision?: string | null;
  verifier_decision?: string | null;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;
};

export type SecurityDecisionEvent = BackendEvent & {
  source?: "security" | string;
  decision?: "allow" | "deny" | "requires_approval" | string;
  risk_level?: "low" | "medium" | "high" | "critical" | "unknown" | string;
};

export type HealthResponse = {
  status: string;
};

export type StartRunPayload = {
  task: string;
};

export type AgentStatus = {
  id: string;
  name: string;
  role: string;
  status: "idle" | "running" | "paused" | "blocked" | "completed" | "heavy-load";
  gpuUsage: number;
  costPerHour: number;
  currentAction: string;
  workflow: string;
};

export type ChartPoint = {
  time: string;
  gpu: number;
  savings: number;
  cost: number;
};

export type PolicyStatus = {
  id: string;
  policy: string;
  description: string;
  status: "active" | "monitoring" | "needs-review";
  lastTriggered: string;
};

export type ClusterNode = {
  id: string;
  name: string;
  gpus: number;
  usedGpus: number;
  utilization: number;
  workloads: number;
  queue: number;
  status: "healthy" | "busy" | "degraded";
};

export type AlertItem = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  timestamp: string;
  status: "open" | "watching" | "resolved";
};

export type BrowserConfig = {
  apiBaseUrl?: string;
  wsUrl?: string;
  runUrl?: string;
};
