"use client";

import PageFrame from "../../../components/PageFrame";
import { policies } from "../../../lib/mockData";
import {
  formatTime,
  levelClass,
  levelLabel,
  policyStatusClass,
} from "../../../lib/utils";
import { useBackendRunStream } from "../../../lib/useBackendRunStream";

export default function PoliciesPage() {
  const {
    connectionStatus,
    events,
    hasBackendEvents,
    isRunning,
    runAgentControl,
  } = useBackendRunStream();

  const securityEvents = events.filter(
    (event) =>
      event.metadata?.source === "security" ||
      event.type.includes("policy") ||
      event.type.includes("security") ||
      event.type === "action_blocked" ||
      event.type === "approval_required" ||
      event.type === "sandbox_violation"
  );

  return (
    <PageFrame
      connectionStatus={connectionStatus}
      isRunning={isRunning}
      onRunAgentControl={runAgentControl}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
      <p className="mt-1 text-sm text-slate-600">
        Review safety controls, GPU limits, shell restrictions, and cost
        threshold policies.
      </p>

      <table className="mt-6 w-full border-y border-slate-200 text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-2 font-medium">Policy</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 font-medium">Last triggered</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-200">
          {policies.map((policy) => (
            <tr key={policy.id}>
              <td className="py-3 font-medium">{policy.policy}</td>
              <td className={`py-3 text-xs font-medium capitalize ${policyStatusClass(policy.status)}`}>
                {policy.status.replace("-", " ")}
              </td>
              <td className="py-3 text-slate-600">{policy.description}</td>
              <td className="py-3 font-mono text-xs text-slate-500">
                {hasBackendEvents ? "Updated from event stream" : "Waiting for backend data"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Live security decisions</h2>
          <p className="text-xs text-slate-500">{securityEvents.length} events</p>
        </div>

        <div className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
          {securityEvents.length === 0 ? (
            <p className="py-3 text-slate-500">
              Waiting for backend data. Security decisions will appear here when
              `/ws/run` emits policy or sandbox events.
            </p>
          ) : (
            securityEvents
              .slice()
              .reverse()
              .map((event) => (
                <div key={event.id} className="grid grid-cols-[88px_110px_1fr] gap-4 py-3">
                  <time className="font-mono text-xs text-slate-500">
                    {formatTime(event.timestamp)}
                  </time>
                  <span className={`text-xs font-medium ${levelClass(event.level)}`}>
                    {levelLabel(event.level)}
                  </span>
                  <div>
                    <p className="text-slate-900">{event.message}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">
                      {event.metadata
                        ? Object.entries(event.metadata)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(" · ")
                        : event.type}
                    </p>
                  </div>
                </div>
              ))
          )}
        </div>
      </section>
    </PageFrame>
  );
}
