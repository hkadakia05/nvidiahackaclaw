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
import { clusterNodes, costOptimization } from "../../../lib/mockData";
import { formatCurrency } from "../../../lib/utils";
import { useBackendRunStream } from "../../../lib/useBackendRunStream";

export default function CostOptimizationPage() {
  const {
    chartData,
    connectionStatus,
    hasBackendEvents,
    isRunning,
    runAgentControl,
  } = useBackendRunStream();
  const availableGpus = clusterNodes.reduce((sum, node) => sum + node.gpus, 0);
  const allocatedGpus = clusterNodes.reduce((sum, node) => sum + node.usedGpus, 0);
  const queuedWorkloads = clusterNodes.reduce((sum, node) => sum + node.queue, 0);
  const averageUtilization = Math.round(
    clusterNodes.reduce((sum, node) => sum + node.utilization, 0) /
      Math.max(clusterNodes.length, 1)
  );

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
              {/* TODO: Replace fallback chart values when backend events include GPU/cost metrics. */}
              Waiting for backend data. Charts use fallback values until `/ws/run`
              emits cost or GPU metadata.
            </p>
          )}
        </div>

        <p className="text-sm font-medium text-slate-900">
          Saved {costOptimization.computeSavedPercent}% GPU compute this week
        </p>
      </div>

      <section className="grid grid-cols-6 gap-6 border-y border-slate-200 py-5 text-sm">
        <div>
          <p className="text-xs text-slate-500">GPUs allocated</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {allocatedGpus}/{availableGpus}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Average utilization</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {averageUtilization}%
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Queued workloads</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{queuedWorkloads}</p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Compute saved today</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatCurrency(costOptimization.computeSavedToday)}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Jobs prevented</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {costOptimization.unnecessaryJobsPrevented}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Monthly savings</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatCurrency(costOptimization.projectedMonthlySavings)}
          </p>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">GPU utilization</h2>
            <p className="text-xs text-slate-500">Percent over time</p>
          </div>

          <div className="h-64 border-y border-slate-200 py-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="gpu" stroke="#334155" fill="#e2e8f0" strokeWidth={1.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Cost trend</h2>
            <p className="text-xs text-slate-500">Savings and hourly spend</p>
          </div>

          <div className="h-64 border-y border-slate-200 py-4">
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
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Optimization actions</h2>
          <p className="text-xs text-slate-500">Prevented work, cache reuse, and model routing</p>
        </div>

        <div className="h-64 border-y border-slate-200 py-4">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={[
                { name: "GPU denied", value: 14 },
                { name: "Cache hits", value: 9 },
                { name: "Model routing", value: 6 },
                { name: "Idle kills", value: 4 },
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
        </div>
      </section>
    </PageFrame>
  );
}
