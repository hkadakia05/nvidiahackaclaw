"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";

import type { AgentEvent, AgentStatus, BackendEvent, ChartPoint, ConnectionStatus } from "../types/dashboard";

import {
  alerts,
  clusterNodes,
  costOptimization,
  fallbackEvents,
  initialAgents,
  initialChartData,
  policies,
} from "../lib/mockData";

import {
  checkBackendHealth,
  createDashboardWebSocket,
  startAgentRun,
} from "../lib/api";

import {
  createId,
  formatCurrency,
  formatTime,
  getConfig,
  getWorkflowCount,
  levelClass,
  levelLabel,
  nodeStatusClass,
  normalizeEvent,
  policyStatusClass,
  runNormalizationTests,
  severityClass,
  statusClass,
} from "../lib/utils";

export default function AgentControlDashboard() {
  const [events, setEvents] = useState<AgentEvent[]>(fallbackEvents);
  const [agents] = useState<AgentStatus[]>(initialAgents);
  const [chartData, setChartData] = useState<ChartPoint[]>(initialChartData);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("checking");
  const [isRunning, setIsRunning] = useState(false);
  // FIX 1: isMounted suppresses time rendering on the server so SSR and client
  // always produce the same initial HTML, eliminating the hydration mismatch.
  const [isMounted, setIsMounted] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const receivedBackendEventRef = useRef(false);
  const config = useMemo(() => getConfig(), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsMounted(true), 0);
    runNormalizationTests();

    return () => window.clearTimeout(timer);
  }, []);

  const addDashboardEvent = useCallback((raw: BackendEvent | AgentEvent) => {
    const normalized = normalizeEvent(raw);

    if (!normalized) return;

    if (normalized.type === "run_complete" || normalized.type === "run_failed") {
      setIsRunning(false);
    }

    setEvents((current) => {
      const shouldReplaceFallback = !receivedBackendEventRef.current;
      receivedBackendEventRef.current = true;
      const next = shouldReplaceFallback ? [normalized] : [...current, normalized];
      return next.slice(-100);
    });

    setChartData((current) => {
      const last = current[current.length - 1];
      const nextPoint: ChartPoint = {
        time: formatTime(normalized.timestamp),
        gpu: Number(normalized.metadata?.gpuUsage ?? last?.gpu ?? 0),
        savings: Number(normalized.metadata?.costSaved ?? last?.savings ?? 0),
        cost: Number(normalized.metadata?.costPerHour ?? last?.cost ?? 0),
      };

      return [...current, nextPoint].slice(-24);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    checkBackendHealth(controller.signal)
      .then(() => setConnectionStatus("connecting"))
      .catch((error) => {
        console.warn("Backend health check failed; using fallback dashboard data.", error);
        setConnectionStatus("offline");
      });

    if (typeof WebSocket === "undefined") {
      window.setTimeout(() => setConnectionStatus("offline"), 0);
      return () => controller.abort();
    }

    try {
      const socket = createDashboardWebSocket();
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus("connected");
      };

      socket.onmessage = (message) => {
        try {
          addDashboardEvent(JSON.parse(message.data));
        } catch (error) {
          console.warn("Ignoring malformed backend WebSocket event.", error);
        }
      };

      socket.onerror = (error) => {
        console.warn("Backend WebSocket connection failed.", error);
        setConnectionStatus("offline");
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
      };

      return () => {
        controller.abort();
        socket.close();
      };
    } catch (error) {
      console.warn("Could not create backend WebSocket; using fallback dashboard data.", error);
      window.setTimeout(() => setConnectionStatus("offline"), 0);
      return () => controller.abort();
    }
  }, [addDashboardEvent]);

  const blockedEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.level === "blocked" ||
          event.level === "denied" ||
          event.type === "approval_required" ||
          event.metadata?.decision === "requires_approval"
      ),
    [events]
  );

  const warningEvents = useMemo(
    () => events.filter((event) => event.level === "warning"),
    [events]
  );

  const activeAgents = agents.filter((agent) => agent.status === "running" || agent.status === "heavy-load").length;
  const totalGpuUsed = agents.reduce((sum, agent) => sum + agent.gpuUsage, 0);
  const averageGpuUsed = Math.round(totalGpuUsed / Math.max(agents.length, 1));
  const hourlyCost = agents.reduce((sum, agent) => sum + agent.costPerHour, 0);
  const runningWorkflows = getWorkflowCount(agents);
  const approvedCount = events.filter((event) => event.level === "approved").length;
  const blockedCount = blockedEvents.length;
  const completedCount = events.filter((event) => event.level === "completed").length;
  const totalSavings = chartData[chartData.length - 1]?.savings ?? 0;
  const availableGpus = clusterNodes.reduce((sum, node) => sum + node.gpus, 0);
  const allocatedGpus = clusterNodes.reduce((sum, node) => sum + node.usedGpus, 0);
  const queuedWorkloads = clusterNodes.reduce((sum, node) => sum + node.queue, 0);

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
      const existingSocket = socketRef.current;

      if (existingSocket?.readyState === WebSocket.OPEN) {
        existingSocket.send(JSON.stringify({ task: "test task" }));
      } else {
        socketRef.current = startAgentRun(
          { task: "test task" },
          {
            onOpen: () => setConnectionStatus("connected"),
            onEvent: addDashboardEvent,
            onMalformedMessage: (raw) => console.warn("Ignoring malformed backend event.", raw),
            onError: (error) => {
              console.warn("Backend run WebSocket failed.", error);
              setConnectionStatus("offline");
              setIsRunning(false);
            },
            onClose: () => {
              socketRef.current = null;
              setIsRunning(false);
            },
          }
        );
      }
    } catch (error) {
      console.warn("Failed to start backend run; showing fallback event.", error);
      const offlineEvent: AgentEvent = {
        id: createId(),
        timestamp: new Date(Date.now()).toISOString(),
        type: "backend.unavailable",
        message: "Backend run endpoint unavailable; showing local fallback state",
        level: "denied",
        metadata: { runUrl: config.runUrl },
      };

      setEvents((current) => [...current, offlineEvent].slice(-100));
      setIsRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-[#fbfbfa]/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-6">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">AgentControl</h1>
            <p className="text-xs text-slate-500">Enterprise AI agent command center</p>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connectionStatus === "connected" ? "bg-emerald-600" : "bg-slate-400"
                }`}
              />
              {connectionStatus === "connected" ? "Connected" : "Offline fallback"}
            </div>

            <button
              onClick={runAgentControl}
              disabled={isRunning}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunning ? "Running…" : "Run AgentControl"}
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[220px_1fr]">
        <aside className="border-r border-slate-200 bg-[#fbfbfa] px-4 py-5">
          <nav className="space-y-1 text-sm">
            {[
              "Overview",
              "Agents",
              "Activity",
              "Cost optimization",
              "Policies",
              "Infrastructure",
              "Alerts",
              "Final report",
            ].map((item, index) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replaceAll(" ", "-")}`}
                className={`block rounded-md px-2 py-1.5 ${
                  index === 0 ? "font-medium text-slate-950" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {item}
              </a>
            ))}
          </nav>
        </aside>

        <section className="px-8 py-7">
          <section id="overview" className="mb-8 border-b border-slate-200 pb-6">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Global AI system overview</p>
                <h2 className="text-2xl font-semibold tracking-tight">Operational command center</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Monitor autonomous CI/CD agents, GPU allocation, cost controls, policy enforcement, workflow health, and infrastructure pressure from one workspace.
                </p>
              </div>

              <div className="text-right text-xs text-slate-500">
                <p>Backend stream: {config.wsUrl}</p>
                <p>Run endpoint: {config.runUrl}</p>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-6 text-sm">
              <div>
                <p className="text-xs text-slate-500">Active agents</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{activeAgents}</p>
                <p className="text-xs text-slate-500">of {agents.length} total</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">GPU usage</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{averageGpuUsed}%</p>
                <p className="text-xs text-slate-500">agent average</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Hourly cost</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(hourlyCost)}</p>
                <p className="text-xs text-slate-500">current estimate</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Blocked actions</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{blockedCount}</p>
                <p className="text-xs text-slate-500">policy decisions</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Workflows</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{runningWorkflows}</p>
                <p className="text-xs text-slate-500">currently tracked</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Alerts</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{alerts.filter((alert) => alert.status !== "resolved").length}</p>
                <p className="text-xs text-slate-500">open/watch</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">GPU saved</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(totalSavings)}</p>
                <p className="text-xs text-slate-500">this run</p>
              </div>
            </div>
          </section>

          <section id="agents" className="mb-10">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Agent monitoring</h3>
                <p className="mt-1 text-xs text-slate-500">All active agents, resource usage, cost, and current action.</p>
              </div>
              <p className="text-xs text-slate-500">Core frontend view</p>
            </div>

            <table className="w-full border-y border-slate-200 text-left text-sm">
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
                {agents.map((agent) => (
                  <tr key={agent.id}>
                    <td className="py-3">
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-xs text-slate-500">{agent.role}</p>
                    </td>
                    <td className={`py-3 text-xs font-medium capitalize ${statusClass(agent.status)}`}>
                      {agent.status.replace("-", " ")}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-10 font-mono text-xs tabular-nums text-slate-700">{agent.gpuUsage}%</span>
                        <div className="h-1.5 w-24 bg-slate-200">
                          <div className="h-1.5 bg-slate-700" style={{ width: `${Math.min(agent.gpuUsage, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs tabular-nums text-slate-700">{formatCurrency(agent.costPerHour)}</td>
                    <td className="py-3 font-mono text-xs text-slate-500">{agent.workflow}</td>
                    <td className="py-3 text-slate-700">{agent.currentAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="grid grid-cols-[1.25fr_0.9fr] gap-8">
            <section id="activity">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Live activity timeline</h3>
                  <p className="mt-1 text-xs text-slate-500">Planning, cache hits, GPU routing, policy blocks, and sandbox execution.</p>
                </div>
                <p className="text-xs text-slate-500">Latest {events.length} events</p>
              </div>

              <div className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
                {events
                  .slice()
                  .reverse()
                  .map((event) => (
                    <div key={event.id} className="grid grid-cols-[88px_110px_1fr] gap-4 py-3">
                      {/* FIX 1: Render times only after mount to prevent SSR/client mismatch */}
                      <time className="font-mono text-xs text-slate-500">
                        {isMounted ? formatTime(event.timestamp) : ""}
                      </time>
                      <span className={`text-xs font-medium ${levelClass(event.level)}`}>{levelLabel(event.level)}</span>
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
                  ))}
              </div>
            </section>

            <section className="space-y-8">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">GPU utilization</h3>
                  <p className="text-xs text-slate-500">Percent over time</p>
                </div>
                <div className="h-44 border-y border-slate-200 py-4">
                  {/* FIX 3: minWidth={0} on all ResponsiveContainers prevents the -1x-1 Recharts error */}
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
                  <h3 className="text-sm font-semibold">Cost trend</h3>
                  <p className="text-xs text-slate-500">Savings and hourly spend</p>
                </div>
                <div className="h-44 border-y border-slate-200 py-4">
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
          </div>

          <section id="cost-optimization" className="mt-10 border-t border-slate-200 pt-6">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h3 className="text-sm font-semibold">Cost optimization</h3>
                <p className="mt-1 text-xs text-slate-500">Compute saved by denying unnecessary GPU usage, reusing cached work, and routing to cheaper models.</p>
              </div>
              <p className="text-sm font-medium text-slate-900">Saved {costOptimization.computeSavedPercent}% GPU compute this week</p>
            </div>

            <div className="grid grid-cols-[0.9fr_1fr] gap-8">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Compute saved today</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(costOptimization.computeSavedToday)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Unnecessary jobs prevented</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{costOptimization.unnecessaryJobsPrevented}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cheaper models selected</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{costOptimization.cheaperModelsSelected}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Duplicate tasks avoided</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{costOptimization.duplicateTasksAvoided}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Projected monthly savings</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(costOptimization.projectedMonthlySavings)}</p>
                </div>
              </div>

              <div className="h-44 border-y border-slate-200 py-4">
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
            </div>
          </section>

          <section id="policies" className="mt-10 border-t border-slate-200 pt-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Policy & safety panel</h3>
                <p className="mt-1 text-xs text-slate-500">Controls that keep autonomous agents inside approved operating boundaries.</p>
              </div>
              <p className="text-xs text-slate-500">{blockedCount} blocked/denied actions</p>
            </div>

            <table className="w-full border-y border-slate-200 text-left text-sm">
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
                    <td className={`py-3 text-xs font-medium capitalize ${policyStatusClass(policy.status)}`}>{policy.status.replace("-", " ")}</td>
                    <td className="py-3 text-slate-600">{policy.description}</td>
                    <td className="py-3 font-mono text-xs text-slate-500">{policy.lastTriggered}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent blocked decisions</h4>
              <table className="w-full border-y border-slate-200 text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 font-medium">Time</th>
                    <th className="py-2 font-medium">Decision</th>
                    <th className="py-2 font-medium">Message</th>
                    <th className="py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {blockedEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-slate-500">
                        No denied or blocked policy events yet.
                      </td>
                    </tr>
                  ) : (
                    blockedEvents
                      .slice()
                      .reverse()
                      .map((event) => (
                        <tr key={event.id}>
                          {/* FIX 1 also applied here */}
                          <td className="py-3 font-mono text-xs text-slate-500">
                            {isMounted ? formatTime(event.timestamp) : ""}
                          </td>
                          <td className={`py-3 text-xs font-medium ${levelClass(event.level)}`}>{levelLabel(event.level)}</td>
                          <td className="py-3 text-slate-900">{event.message}</td>
                          <td className="py-3 font-mono text-xs text-slate-500">
                            {event.metadata
                              ? Object.entries(event.metadata)
                                  .map(([key, value]) => `${key}: ${String(value)}`)
                                  .join(" · ")
                              : "—"}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="infrastructure" className="mt-10 border-t border-slate-200 pt-6">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h3 className="text-sm font-semibold">Infrastructure / cluster view</h3>
                <p className="mt-1 text-xs text-slate-500">GPU pools, node utilization, workload pressure, and queue state.</p>
              </div>
              <div className="flex gap-6 text-right text-sm">
                <div>
                  <p className="text-xs text-slate-500">GPUs allocated</p>
                  <p className="font-medium tabular-nums">{allocatedGpus}/{availableGpus}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Queued workloads</p>
                  <p className="font-medium tabular-nums">{queuedWorkloads}</p>
                </div>
              </div>
            </div>

            <table className="w-full border-y border-slate-200 text-left text-sm">
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
              <tbody className="divide-y divide-slate-200">
                {clusterNodes.map((node) => (
                  <tr key={node.id}>
                    <td className="py-3 font-mono text-xs text-slate-700">{node.name}</td>
                    <td className={`py-3 text-xs font-medium capitalize ${nodeStatusClass(node.status)}`}>{node.status}</td>
                    <td className="py-3 font-mono text-xs tabular-nums text-slate-700">{node.usedGpus}/{node.gpus}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-10 font-mono text-xs tabular-nums text-slate-700">{node.utilization}%</span>
                        <div className="h-1.5 w-28 bg-slate-200">
                          <div className="h-1.5 bg-slate-700" style={{ width: `${Math.min(node.utilization, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs tabular-nums text-slate-700">{node.workloads}</td>
                    <td className="py-3 font-mono text-xs tabular-nums text-slate-700">{node.queue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="alerts" className="mt-10 border-t border-slate-200 pt-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Alerts & incident center</h3>
                <p className="mt-1 text-xs text-slate-500">Operational warnings for GPU pressure, runaway behavior, risky tools, and cost spikes.</p>
              </div>
              <p className="text-xs text-slate-500">{warningEvents.length} warning events in stream</p>
            </div>

            <div className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
              {alerts.map((alert) => (
                <div key={alert.id} className="grid grid-cols-[92px_110px_1fr_90px] gap-4 py-3">
                  {/* FIX 1 also applied here */}
                  <time className="font-mono text-xs text-slate-500">
                    {isMounted ? formatTime(alert.timestamp) : ""}
                  </time>
                  <span className={`text-xs font-medium capitalize ${severityClass(alert.severity)}`}>{alert.severity}</span>
                  <div>
                    <p className="font-medium text-slate-900">{alert.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{alert.description}</p>
                  </div>
                  <span className="text-right text-xs capitalize text-slate-500">{alert.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="final-report" className="mt-10 border-t border-slate-200 pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Final report</h3>
              <p className="text-xs text-slate-500">Generated after run completion</p>
            </div>

            <div className="max-w-4xl text-sm leading-6 text-slate-700">
              <p>
                AgentControl completed the CI/CD validation flow with policy enforcement enabled. Planning, routing, cache reuse, sandbox execution, GPU allocation, and safety checks were visible in the live event stream.
              </p>
              <p className="mt-3">
                Current fallback report shows {completedCount} completed events, {approvedCount} approved actions, {blockedCount} blocked or denied actions, {activeAgents} active agents, {allocatedGpus}/{availableGpus} GPUs allocated, and an estimated {formatCurrency(totalSavings)} in GPU savings for this run.
              </p>
              <p className="mt-3 text-slate-500">
                Once the backend is connected, replace these fallback values with real workflow summaries, incident outcomes, final validation results, policy decisions, and cost accounting from the AgentControl API.
              </p>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
