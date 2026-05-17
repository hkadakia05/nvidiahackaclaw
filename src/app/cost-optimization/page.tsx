"use client";

import { useMemo } from "react";

import PageFrame from "../../../components/PageFrame";
import { useBackendRunStream } from "../../../lib/useBackendRunStream";

import {
  deriveAgentsFromEvents,
  formatCurrency,
  statusClass,
} from "../../../lib/utils";

export default function AgentsPage() {
  const {
    connectionStatus,
    events,
    hasBackendEvents,
    isRunning,
    runAgentControl,
  } = useBackendRunStream();

  // This page does NOT directly make graphs.
  // The graph data is made inside useBackendRunStream as chartData.
  //
  // In that hook, every backend WebSocket message gets normalized into an event.
  // If the event metadata includes gpuUsage, costSaved, or costPerHour,
  // the hook creates a chart point like:
  //
  // {
  //   time: formatted timestamp,
  //   gpu: metadata.gpuUsage,
  //   savings: metadata.costSaved,
  //   cost: metadata.costPerHour
  // }
  //
  // Graph pages then pass chartData into Recharts components.
  // This Agents page uses the same events, but instead of graphing them,
  // it converts them into table rows.
  const agents = useMemo(() => deriveAgentsFromEvents(events), [events]);

  return (
    <PageFrame
      connectionStatus={connectionStatus}
      isRunning={isRunning}
      onRunAgentControl={runAgentControl}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>

      <p className="mt-1 text-sm text-slate-600">
        Monitor agent status, GPU usage, cost, workflow, and current action.
      </p>

      {/* 
        If no backend WebSocket events have arrived yet, show this message.
        Once the backend sends real telemetry, hasBackendEvents becomes true.
      */}
      {!hasBackendEvents && (
        <p className="mt-4 text-xs text-slate-500">
          No backend agent telemetry yet. Click Run AgentControl to start a
          control-plane run.
        </p>
      )}

      {/* 
        This table is the Agent Monitoring page.
        It is not hardcoded mock data.
        The rows come from backend events after deriveAgentsFromEvents(events)
        extracts agent metadata from the event stream.
      */}
      <table className="mt-6 w-full border-y border-slate-200 text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-2 font-medium">Agent</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">GPU Usage</th>
            <th className="py-2 font-medium">Cost/hr</th>
            <th className="py-2 font-medium">Workflow</th>
            <th className="py-2 font-medium">Current Action</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-200">
          {agents.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-3 text-slate-500">
                Waiting for agent telemetry from backend events.
              </td>
            </tr>
          ) : (
            agents.map((agent) => (
              <tr key={agent.id}>
                {/* 
                  Agent name and role come from backend event metadata:
                  worker_agent_name and worker_agent_type.
                */}
                <td className="py-3">
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-xs text-slate-500">{agent.role}</p>
                </td>

                {/* 
                  Status also comes from event metadata when available.
                  If not, utils infer status from event level/type.
                  Example: blocked events become "blocked",
                  completed events become "completed",
                  high GPU usage can become "heavy-load".
                */}
                <td
                  className={`py-3 text-xs font-medium capitalize ${statusClass(
                    agent.status
                  )}`}
                >
                  {agent.status.replace("-", " ")}
                </td>

                {/* 
                  GPU usage comes from event metadata.
                  deriveAgentsFromEvents checks gpuUsage first,
                  then falls back to estimated_gpu_cost or gpu_cost if needed.
                  This same gpuUsage field is also what graph pages can plot.
                */}
                <td className="py-3 font-mono text-xs">{agent.gpuUsage}%</td>

                {/* 
                  Cost/hr comes from costPerHour or estimated_gpu_cost.
                  The number is formatted as USD using formatCurrency().
                  Graph pages can also use costPerHour to draw cost trends.
                */}
                <td className="py-3 font-mono text-xs">
                  {formatCurrency(agent.costPerHour)}
                </td>

                {/* 
                  Workflow usually comes from run_id in the backend metadata.
                  If there is no run_id, utils fallback to "current run".
                */}
                <td className="py-3 font-mono text-xs text-slate-500">
                  {agent.workflow}
                </td>

                {/* 
                  Current action comes from requested_tool_action,
                  requested_action, or finally the event message itself.
                  So this is showing what the backend says the agent is doing.
                */}
                <td className="py-3 text-slate-700">{agent.currentAction}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </PageFrame>
  );
}