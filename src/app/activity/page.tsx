"use client";

import PageFrame from "../../../components/PageFrame";
import { formatTime, levelClass, levelLabel } from "../../../lib/utils";
import { useBackendRunStream } from "../../../lib/useBackendRunStream";

export default function ActivityPage() {
  const {
    connectionStatus,
    events,
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
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live timeline of planning, GPU routing, cache hits, policy blocks,
            and sandbox execution.
          </p>
        </div>

        <p className="text-xs text-slate-500">Latest {events.length} events</p>
      </div>

      {!hasBackendEvents && (
        <p className="mt-4 text-xs text-slate-500">
          No backend events yet. Click Run AgentControl to start a
          control-plane run.
        </p>
      )}  
    {/*if hasBackendEvents not triggered message: no backend ....*/}

      <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200 text-sm">
        {events.length === 0 ? (
          <p className="py-3 text-slate-500">Waiting for backend event stream.</p>  
        ) : (   
          events
            .slice()
            .reverse()
            .map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[88px_110px_1fr] gap-4 py-3"
            >
              <time className="font-mono text-xs text-slate-500">
                {formatTime(event.timestamp)}
              </time>

              <span className={`text-xs font-medium ${levelClass(event.level)}`}>
                {levelLabel(event.level)}
              </span>

              <div>
                <p className="text-slate-900">{event.message}</p>

                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-slate-500">
                  <span>{event.type}</span>

                  {event.metadata &&
                    Object.entries(event.metadata).map(([key, value]) => (
                      <span key={key}>
                        {key}: {String(value)}
                      </span>
                    ))}
                </div>
              </div>
            </div>
            ))
        )}
      </div>
    </PageFrame>
  );
}
