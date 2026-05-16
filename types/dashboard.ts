export type EventLevel = "info" | "approved" | "denied" | "blocked" | "completed" | "warning";

export type AgentEvent = {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  level: EventLevel;
  metadata?: Record<string, string | number | boolean>;
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
  wsUrl?: string;
  runUrl?: string;
};
