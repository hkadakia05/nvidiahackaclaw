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
  const agents = useMemo(() => deriveAgentsFromEvents(events), [events]);

  return (
    <PageFrame
      connectionStatus={connectionStatus}
      isRunning={isRunning}
      onRunAgentControl={runAgentControl}  
      // starts the backend
    >
      <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
      <p className="mt-1 text-sm text-slate-600">
        Monitor agent status, GPU usage, cost, workflow, and current action.
      </p> 
      {/* if no backend events: */}
      {!hasBackendEvents && (
        <p className="mt-4 text-xs text-slate-500">
          No backend agent telemetry yet. Click Run AgentControl to start a
          control-plane run.
        </p>
      )}

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
          {/* This checks whether there are zero agents. */}
          {agents.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-3 text-slate-500">
                Waiting for agent telemetry from backend events.
              </td>
            </tr>
          ) : (
            agents.map((agent) => (
              <tr key={agent.id}>
                <td className="py-3">
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-xs text-slate-500">{agent.role}</p>
                </td>

                <td className={`py-3 text-xs font-medium capitalize ${statusClass(agent.status)}`}>
                  {agent.status.replace("-", " ")}
                </td>

                <td className="py-3 font-mono text-xs">{agent.gpuUsage}%</td>

                <td className="py-3 font-mono text-xs">
                  {formatCurrency(agent.costPerHour)}
                </td>

                <td className="py-3 font-mono text-xs text-slate-500">
                  {agent.workflow}
                </td>

                <td className="py-3 text-slate-700">{agent.currentAction}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </PageFrame>
    // agents are being pulled from backend via {agent} which uses {deriveAgentsFromEvents} which uses {events} from backend
  );
}
