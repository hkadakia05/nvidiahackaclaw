"use client";

import PageFrame from "../../../components/PageFrame";
import { useBackendRunStream } from "../../../lib/useBackendRunStream";

export default function InfrastructurePage() {
  const {
    connectionStatus,
    hasBackendEvents,
    isRunning,
    runAgentControl,
  } = useBackendRunStream();

  return (
    <PageFrame
      connectionStatus={connectionStatus}
      isRunning={isRunning}
      onRunAgentControl={runAgentControl}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Infrastructure</h1>
      <p className="mt-1 text-sm text-slate-600">
        View GPU nodes, utilization, workloads, queue pressure, and cluster health.
      </p>
      {!hasBackendEvents && (
        <p className="mt-4 text-xs text-slate-500">
          Waiting for backend infrastructure telemetry.
        </p>
      )}

      <table className="mt-6 w-full border-y border-slate-200 text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-2 font-medium">Node</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">GPUs</th>
            <th className="py-2 font-medium">Utilization</th>
            <th className="py-2 font-medium">Workloads</th>
            <th className="py-2 font-medium">Queue</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td colSpan={6} className="py-3 text-slate-500">
              No backend infrastructure events yet.
            </td>
          </tr>
        </tbody>
      </table>
    </PageFrame>
  );
}
