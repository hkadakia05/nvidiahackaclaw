"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { ConnectionStatus } from "../types/dashboard";

type PageFrameProps = {
  children: ReactNode;
  connectionStatus?: ConnectionStatus;
  isRunning?: boolean;
  onRunAgentControl?: () => void;
};

const navItems = [
  { label: "Overview", href: "/" },
  { label: "Agents", href: "/agents" },
  { label: "Activity", href: "/activity" },
  { label: "Cost optimization", href: "/cost-optimization" },
  { label: "Policies", href: "/policies" },
  { label: "Infrastructure", href: "/infrastructure" },
  { label: "Alerts", href: "/alerts" },
  { label: "Final report", href: "/final-report" },
];

export default function PageFrame({
  children,
  connectionStatus = "offline",
  isRunning = false,
  onRunAgentControl,
}: PageFrameProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-[#fbfbfa]/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-6">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">AgentControl</h1>
            <p className="text-xs text-slate-500">
              Enterprise AI agent command center
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-600"
                    : "bg-slate-400"
                }`}
              />
              {connectionStatus === "connected" ? "Connected" : "Offline fallback"}
            </div>

            <button
              onClick={onRunAgentControl}
              disabled={isRunning || !onRunAgentControl}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunning ? "Running..." : "Run AgentControl"}
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-[220px_1fr]">
        <aside className="border-r border-slate-200 bg-[#fbfbfa] px-4 py-5">
          <nav className="space-y-1 text-sm">
            {navItems.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-2 py-1.5 ${
                  pathname === item.href || (index === 0 && pathname === "/")
                    ? "font-medium text-slate-950"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 px-8 py-7">{children}</section>
      </div>
    </main>
  );
}
