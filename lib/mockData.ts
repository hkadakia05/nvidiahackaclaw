import type {
  AgentEvent,
  AgentStatus,
  AlertItem,
  ChartPoint,
  ClusterNode,
  PolicyStatus,
} from "../types/dashboard";

// Dev-only placeholders. Active dashboard views intentionally do not import
// these values; backend WebSocket events are the source of displayed telemetry.
export const fallbackEvents: AgentEvent[] = [];
export const initialAgents: AgentStatus[] = [];
export const initialChartData: ChartPoint[] = [];
export const policies: PolicyStatus[] = [];
export const clusterNodes: ClusterNode[] = [];
export const alerts: AlertItem[] = [];
export const costOptimization = {
  computeSavedPercent: 0,
  computeSavedToday: 0,
  unnecessaryJobsPrevented: 0,
  cheaperModelsSelected: 0,
  duplicateTasksAvoided: 0,
  projectedMonthlySavings: 0,
};
