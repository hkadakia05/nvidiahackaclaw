"use client";

import PageFrame from "../../../components/PageFrame";
import { clusterNodes, initialAgents } from "../../../lib/mockData";
import { formatCurrency, getWorkflowCount, levelClass, levelLabel } from "../../../lib/utils";
import { useBackendRunStream } from "../../../lib/useBackendRunStream";

export default function FinalReportPage() {
  const {
    chartData,
    connectionStatus,
    events,
    hasBackendEvents,
    isRunning,
    runAgentControl,
  } = useBackendRunStream();

  const blockedEvents = events.filter(
    (event) => event.level === "blocked" || event.level === "denied"
  );
  const approvedCount = events.filter((event) => event.level === "approved").length;
  const completedCount = events.filter((event) => event.level === "completed").length;
  const activeAgents = initialAgents.filter(
    (agent) => agent.status === "running" || agent.status === "heavy-load"
  ).length;
  const runningWorkflows = getWorkflowCount(initialAgents);
  const availableGpus = clusterNodes.reduce((sum, node) => sum + node.gpus, 0);
  const allocatedGpus = clusterNodes.reduce((sum, node) => sum + node.usedGpus, 0);
  const queuedWorkloads = clusterNodes.reduce((sum, node) => sum + node.queue, 0);
  const totalSavings = chartData[chartData.length - 1]?.savings ?? 0;

  return (
    <PageFrame
      connectionStatus={connectionStatus}
      isRunning={isRunning}
      onRunAgentControl={runAgentControl}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Final report</h1>
        <p className="mt-1 text-sm text-slate-600">
          Summary of agent activity, policy enforcement, GPU allocation, and
          cost optimization for the current run.
        </p>
        {!hasBackendEvents && (
          <p className="mt-4 text-xs text-slate-500">
            Waiting for backend data. Click Run AgentControl to generate a live
            summary from streamed backend events.
          </p>
        )}
      </div>

      <section className="grid grid-cols-4 gap-6 border-y border-slate-200 py-5 text-sm">
        <div>
          <p className="text-xs text-slate-500">Completed events</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{completedCount}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Approved actions</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{approvedCount}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Blocked / denied</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{blockedEvents.length}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Estimated savings</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatCurrency(totalSavings)}
          </p>
        </div>
      </section>

      <section className="mt-8 max-w-4xl text-sm leading-6 text-slate-700">
        <h2 className="text-sm font-semibold text-slate-950">Run summary</h2>

        <p className="mt-3">
          AgentControl completed the CI/CD validation flow with policy
          enforcement enabled. Planning, routing, cache reuse, sandbox execution,
          GPU allocation, and safety checks were visible in the event stream.
        </p>

        <p className="mt-3">
          The current report shows {completedCount} completed events,{" "}
          {approvedCount} approved actions, {blockedEvents.length} blocked or
          denied actions, {activeAgents} active agents, and {runningWorkflows}{" "}
          tracked workflows.
        </p>

        <p className="mt-3">
          Infrastructure usage currently shows {allocatedGpus}/{availableGpus}{" "}
          GPUs allocated with {queuedWorkloads} queued workloads. Estimated GPU
          savings for this run are {formatCurrency(totalSavings)}.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Policy decisions</h2>

        <table className="w-full border-y border-slate-200 text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium">Level</th>
              <th className="py-2 font-medium">Message</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {blockedEvents.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-3 text-slate-500">
                  Waiting for backend policy decisions.
                </td>
              </tr>
            ) : (
              blockedEvents.map((event) => (
                <tr key={event.id}>
                  <td className="py-3 font-mono text-xs text-slate-500">
                    {event.type}
                  </td>

                  <td className={`py-3 text-xs font-medium capitalize ${levelClass(event.level)}`}>
                    {levelLabel(event.level)}
                  </td>

                  <td className="py-3 text-slate-700">{event.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </PageFrame>
  );
}
