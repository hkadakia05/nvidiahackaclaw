"use client";

import { useMemo } from "react";

import PageFrame from "../../../components/PageFrame";
import { useBackendRunStream } from "../../../lib/useBackendRunStream";
import { deriveAlertsFromEvents, severityClass } from "../../../lib/utils";

export default function AlertsPage() {
  const {
    connectionStatus,
    events,
    hasBackendEvents,
    isRunning,
    runAgentControl,
  } = useBackendRunStream();
  const alerts = useMemo(() => deriveAlertsFromEvents(events), [events]);

  return (
    <PageFrame
      connectionStatus={connectionStatus}
      isRunning={isRunning}
      onRunAgentControl={runAgentControl}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
      <p className="mt-1 text-sm text-slate-600">
        Track warnings, incidents, risky actions, and operational issues.
      </p>
      {!hasBackendEvents && (
        <p className="mt-4 text-xs text-slate-500">
          No backend alerts yet. Click Run AgentControl to stream warning,
          error, and security events.
        </p>
      )}

      <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200 text-sm">
        {alerts.length === 0 ? (
          <p className="py-3 text-slate-500">Waiting for alert-worthy backend events.</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="grid grid-cols-[120px_1fr_100px] gap-4 py-3">
              <span className={`text-xs font-medium capitalize ${severityClass(alert.severity)}`}>
                {alert.severity}
              </span>

              <div>
                <p className="font-medium">{alert.title}</p>
                <p className="mt-1 text-xs text-slate-500">{alert.description}</p>
              </div>

              <span className="text-right text-xs capitalize text-slate-500">
                {alert.status}
              </span>
            </div>
          ))
        )}
      </div>
    </PageFrame>
  );
}
