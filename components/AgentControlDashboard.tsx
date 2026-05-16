"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import PageFrame from "./PageFrame";

import type { AgentEvent, AgentStatus } from "../types/dashboard";

import { alerts, fallbackEvents, initialAgents } from "../lib/mockData";

import {
  createId,
  formatCurrency,
  getConfig,
  getWorkflowCount,
  normalizeEvent,
  runNormalizationTests,
  statusClass,
} from "../lib/utils";

export default function AgentControlDashboard() {
  const [events, setEvents] = useState<AgentEvent[]>(fallbackEvents);
  const [agents] = useState<AgentStatus[]>(initialAgents);
  const [isRunning, setIsRunning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "offline"
  >("connecting");

  const socketRef = useRef<WebSocket | null>(null);
  const config = useMemo(() => getConfig(), []);

  useEffect(() => {
    runNormalizationTests();
  }, []);

  useEffect(() => {
    let receivedBackendEvent = false;

    if (typeof WebSocket === "undefined") {
      setConnectionStatus("offline");
      return;
    }

    try {
      const socket = new WebSocket(config.wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus("connected");
      };

      socket.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data);
          const normalized = normalizeEvent(parsed);

          if (!normalized) return;

          setEvents((current) => {
            const shouldReplaceFallback = !receivedBackendEvent;
            receivedBackendEvent = true;

            const next = shouldReplaceFallback
              ? [normalized]
              : [...current, normalized];

            return next.slice(-100);
          });
        } catch {
          // Ignore malformed backend events instead of crashing the UI.
        }
      };

      socket.onerror = () => {
        setConnectionStatus("offline");
      };

      socket.onclose = () => {
        setConnectionStatus("offline");
      };

      return () => socket.close();
    } catch {
      setConnectionStatus("offline");
    }
  }, [config.wsUrl]);

  const blockedEvents = useMemo(
    () =>
      events.filter(
        (event) => event.level === "blocked" || event.level === "denied"
      ),
    [events]
  );

  const activeAgents = agents.filter(
    (agent) => agent.status === "running" || agent.status === "heavy-load"
  ).length;

  const totalGpuUsed = agents.reduce((sum, agent) => sum + agent.gpuUsage, 0);
  const averageGpuUsed = Math.round(totalGpuUsed / Math.max(agents.length, 1));
  const hourlyCost = agents.reduce((sum, agent) => sum + agent.costPerHour, 0);
  const runningWorkflows = getWorkflowCount(agents);
  const blockedCount = blockedEvents.length;
  const openAlerts = alerts.filter((alert) => alert.status !== "resolved").length;

  async function runAgentControl() {
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
      await fetch(config.runUrl, { method: "POST" });
    } catch {
      const offlineEvent: AgentEvent = {
        id: createId(),
        timestamp: new Date(Date.now()).toISOString(),
        type: "backend.unavailable",
        message: "Backend run endpoint unavailable; showing local fallback state",
        level: "denied",
        metadata: { runUrl: config.runUrl },
      };

      setEvents((current) => [...current, offlineEvent].slice(-100));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <PageFrame>
      <section className="mb-8 border-b border-slate-200 pb-6">
        <div className="mb-6 flex items-end justify-between gap-8">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Global AI system overview
            </p>

            <h1 className="text-2xl font-semibold tracking-tight">
              Operational command center
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Monitor autonomous CI/CD agents, GPU allocation, policy decisions,
              workflow health, and active agent behavior from one workspace.
            </p>
          </div>

          <div className="hidden text-right text-xs text-slate-500 xl:block">
            <p>Backend stream: {config.wsUrl}</p>
            <p>Run endpoint: {config.runUrl}</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-6 text-sm">
          <div>
            <p className="text-xs text-slate-500">Active agents</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {activeAgents}
            </p>
            <p className="text-xs text-slate-500">of {agents.length} total</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">GPU usage</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {averageGpuUsed}%
            </p>
            <p className="text-xs text-slate-500">agent average</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Hourly cost</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(hourlyCost)}
            </p>
            <p className="text-xs text-slate-500">current estimate</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Blocked actions</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {blockedCount}
            </p>
            <p className="text-xs text-slate-500">policy decisions</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Workflows</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {runningWorkflows}
            </p>
            <p className="text-xs text-slate-500">
              {openAlerts} alerts open/watch
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Agent monitoring</h2>
            <p className="mt-1 text-xs text-slate-500">
              All active agents, resource usage, cost, workflow, and current
              action.
            </p>
          </div>

          <p className="text-xs text-slate-500">{agents.length} total agents</p>
        </div>

        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-6 font-medium">Agent</th>
                <th className="py-2 pr-6 font-medium">Status</th>
                <th className="py-2 pr-6 font-medium">GPU Usage</th>
                <th className="py-2 pr-6 font-medium">Cost/hr</th>
                <th className="py-2 pr-6 font-medium">Workflow</th>
                <th className="py-2 font-medium">Current Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td className="py-3 pr-6">
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-slate-500">{agent.role}</p>
                  </td>

                  <td
                    className={`py-3 pr-6 text-xs font-medium capitalize ${statusClass(
                      agent.status
                    )}`}
                  >
                    {agent.status.replace("-", " ")}
                  </td>

                  <td className="py-3 pr-6">
                    <div className="flex items-center gap-2">
                      <span className="w-10 font-mono text-xs tabular-nums text-slate-700">
                        {agent.gpuUsage}%
                      </span>

                      <div className="h-1.5 w-24 bg-slate-200">
                        <div
                          className="h-1.5 bg-slate-700"
                          style={{
                            width: `${Math.min(agent.gpuUsage, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-3 pr-6 font-mono text-xs tabular-nums text-slate-700">
                    {formatCurrency(agent.costPerHour)}
                  </td>

                  <td className="py-3 pr-6 font-mono text-xs text-slate-500">
                    {agent.workflow}
                  </td>

                  <td className="py-3 text-slate-700">
                    {agent.currentAction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageFrame>
  );
}