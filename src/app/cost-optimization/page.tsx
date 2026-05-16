"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageFrame from "../../../components/PageFrame";
import { formatCurrency } from "../../../lib/utils";
import { useBackendRunStream } from "../../../lib/useBackendRunStream";

export default function CostOptimizationPage() {
  const {
    chartData,
    connectionStatus,
    events,
    hasBackendEvents,
    isRunning,
    runAgentControl,
  } = useBackendRunStream();
  const latestPoint = chartData[chartData.length - 1];
  const gpuEvents = events.filter((event) => event.type === "gpu_metric");
  const budgetEvents = events.filter((event) => event.metadata?.budget_decision);
  const deniedBudgetEvents = budgetEvents.filter(
    (event) => event.metadata?.budget_decision === "denied"
  );
  const routedLocally = gpuEvents.filter(
    (event) => event.metadata?.route === "local-model"
  ).length;
  const cacheHits = events.filter((event) => event.type === "cached_decision_used").length;
  const approvedRoutes = gpuEvents.filter(
    (event) => event.metadata?.budget_decision === "approved"
  ).length;

  return (
    <PageFrame
      connectionStatus={connectionStatus}
      isRunning={isRunning}
      onRunAgentControl={runAgentControl}
    >
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cost and GPU</h1>
          <p className="mt-1 text-sm text-slate-600">
            Monitor GPU usage, hourly cost, savings, queue pressure, and compute
            optimization.
          </p>
          {!hasBackendEvents && (
            <p className="mt-4 text-xs text-slate-500">
              Waiting for GPU and budget telemetry from backend events.
            </p>
          )}
        </div>

        <p className="text-sm font-medium text-slate-900">
          {latestPoint
            ? `Saved ${latestPoint.savings}% GPU compute in this run`
            : "No run data yet"}
        </p>
      </div>

      <section className="grid grid-cols-5 gap-6 border-y border-slate-200 py-5 text-sm">
        <div>
          <p className="text-xs text-slate-500">GPU route events</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{gpuEvents.length}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Latest GPU estimate</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {latestPoint ? `${latestPoint.gpu}%` : "--"}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Latest hourly cost</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatCurrency(latestPoint?.cost ?? 0)}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Budget denials</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {deniedBudgetEvents.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Estimated savings</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {latestPoint ? `${latestPoint.savings}%` : "--"}
          </p>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">GPU utilization</h2>
            <p className="text-xs text-slate-500">Backend event estimates</p>
          </div>

          <div className="h-64 border-y border-slate-200 py-4">
            {chartData.length === 0 ? (
              <p className="text-sm text-slate-500">Waiting for GPU metrics.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="gpu" stroke="#334155" fill="#e2e8f0" strokeWidth={1.6} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Cost trend</h2>
            <p className="text-xs text-slate-500">Savings and hourly spend</p>
          </div>

          <div className="h-64 border-y border-slate-200 py-4">
            {chartData.length === 0 ? (
              <p className="text-sm text-slate-500">Waiting for cost metrics.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="savings" stroke="#059669" strokeWidth={1.6} dot={false} />
                  <Line type="monotone" dataKey="cost" stroke="#64748b" strokeWidth={1.4} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Optimization actions</h2>
          <p className="text-xs text-slate-500">Backend-generated run telemetry</p>
        </div>

        <div className="h-64 border-y border-slate-200 py-4">
          {!hasBackendEvents ? (
            <p className="text-sm text-slate-500">Waiting for optimization events.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={[
                  { name: "Budget denied", value: deniedBudgetEvents.length },
                  { name: "Cache hits", value: cacheHits },
                  { name: "Local routes", value: routedLocally },
                  { name: "GPU approved", value: approvedRoutes },
                ]}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#64748b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </PageFrame>
  );
}
