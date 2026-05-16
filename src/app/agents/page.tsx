import PageFrame from "../../../components/PageFrame";
import { initialAgents } from "../../../lib/mockData";
import { formatCurrency, statusClass } from "../../../lib/utils";

export default function AgentsPage() {
  return (
    <PageFrame>
      <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
      <p className="mt-1 text-sm text-slate-600">
        Monitor agent status, GPU usage, cost, workflow, and current action.
      </p>
      <p className="mt-4 text-xs text-slate-500">
        {/* TODO: Replace placeholder rows when the backend exposes an agents endpoint. */}
        Waiting for backend data. The current backend streams run events, but
        does not expose a dedicated agents endpoint yet.
      </p>

      <table className="mt-6 w-full border-y border-slate-200 text-left text-sm">
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
          {initialAgents.map((agent) => (
            <tr key={agent.id}>
              <td className="py-3">
                <p className="font-medium">{agent.name}</p>
                <p className="text-xs text-slate-500">{agent.role}</p>
              </td>

              <td className={`py-3 text-xs font-medium capitalize ${statusClass(agent.status)}`}>
                {agent.status.replace("-", " ")}
              </td>

              <td className="py-3 font-mono text-xs">{agent.gpuUsage}%</td>

              <td className="py-3 font-mono text-xs">
                {formatCurrency(agent.costPerHour)}
              </td>

              <td className="py-3 font-mono text-xs text-slate-500">
                {agent.workflow}
              </td>

              <td className="py-3 text-slate-700">{agent.currentAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageFrame>
  );
}
