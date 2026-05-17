"use client";

import { useEffect, useMemo, useState } from "react";

import PageFrame from "./PageFrame";
import {
  deriveAgentsFromEvents,
  deriveAlertsFromEvents,
  formatCurrency,
  getWorkflowCount,
  isBlockedOrDeniedEvent,
  runNormalizationTests,
  statusClass,
} from "../lib/utils";
import { useBackendRunStream } from "../lib/useBackendRunStream";

export default function AgentControlDashboard() {
  const {
    config,
    connectionStatus,
    events,
    hasBackendEvents,
    isRunning,
    runAgentControl,
    runAgentControlWithUrl,
  } = useBackendRunStream();

  const [githubUrl, setGithubUrl] = useState(
    "https://github.com/gaurijain21/test_gpugodfather"
  );
  const [urlValid, setUrlValid] = useState(true);

  const handleStartTestRun = () => {
    if (!githubUrl || !githubUrl.startsWith("https://github.com/")) {
      setUrlValid(false);
      return;
    }
    setUrlValid(true);
    runAgentControlWithUrl ? runAgentControlWithUrl(githubUrl) : runAgentControl();
  };

  useEffect(() => {
    runNormalizationTests();
  }, []);

  const agents = useMemo(() => deriveAgentsFromEvents(events), [events]);
  const blockedEvents = useMemo(
    () => events.filter(isBlockedOrDeniedEvent),
    [events]
  );
  const alerts = useMemo(() => deriveAlertsFromEvents(events), [events]);

  const activeAgents = agents.filter(
    (agent) => agent.status === "running" || agent.status === "heavy-load"
  ).length;
  const runningWorkflows = getWorkflowCount(agents);
  const openAlerts = alerts.length;

  return (
    <PageFrame
      connectionStatus={connectionStatus}
      isRunning={isRunning}
      onRunAgentControl={runAgentControl}
    >
      <section className="mb-8 border-b border-slate-200 pb-6">
        <div className="mb-6 flex items-end justify-between gap-8">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Comapny AI operations dashboard
            </p>

            <h1 className="text-2xl font-semibold tracking-tight">
              Operational command center
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Monitor autonomous CI/CD agents, policy decisions, workflow
              health, and active agent behavior from one workspace.
            </p>
          </div>

          <div className="hidden text-right text-xs text-slate-500 xl:block">
            <p>Backend stream: {config.wsUrl}</p>
            <p>Run endpoint: {config.runUrl}</p>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500">GitHub Repository URL</label>
          <div className="mt-2 flex gap-3">
            <input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />

            <button
              onClick={handleStartTestRun}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              Start Test Run
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">Try the included demo repository or paste your own GitHub repo.</p>

          {!urlValid && (
            <p className="mt-2 text-xs text-amber-700">Please enter a valid GitHub URL starting with https://github.com/</p>
          )}

          {connectionStatus !== "connected" && (
            <p className="mt-2 text-xs text-slate-500">Backend not connected yet — showing demo run</p>
          )}
        </div>

        <div className="grid grid-cols-5 gap-6 text-sm">
          <div>
            <p className="text-xs text-slate-500">Backend status</p>
            <p className="mt-1 text-lg font-semibold capitalize tabular-nums">
              {connectionStatus === "connected" ? "Connected" : "Waiting"}
            </p>
            <p className="text-xs text-slate-500">
              {hasBackendEvents ? "live events received" : "waiting for events"}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Active agents</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {activeAgents}
            </p>
            <p className="text-xs text-slate-500">of {agents.length} total</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Blocked actions</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {blockedEvents.length}
            </p>
            <p className="text-xs text-slate-500">policy decisions</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Workflows</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {runningWorkflows}
            </p>
            <p className="text-xs text-slate-500">currently tracked</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Alerts</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {openAlerts}
            </p>
            <p className="text-xs text-slate-500">open/watch</p>
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

          <p className="text-xs text-slate-500">
            {hasBackendEvents
              ? "Derived from backend event telemetry"
              : "Waiting for agent telemetry"}
          </p>
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
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-slate-500">
                    No backend events yet. Click Run AgentControl to start a
                    control-plane run.
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageFrame>
  );
}
