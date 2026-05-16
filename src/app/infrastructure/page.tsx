import PageFrame from "../../../components/PageFrame";
import { clusterNodes } from "../../../lib/mockData";
import { nodeStatusClass } from "../../../lib/utils";

export default function InfrastructurePage() {
  return (
    <PageFrame>
      <h1 className="text-2xl font-semibold tracking-tight">Infrastructure</h1>
      <p className="mt-1 text-sm text-slate-600">
        View GPU nodes, utilization, workloads, queue pressure, and cluster health.
      </p>

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

        <tbody className="divide-y divide-slate-200">
          {clusterNodes.map((node) => (
            <tr key={node.id}>
              <td className="py-3 font-mono text-xs">{node.name}</td>
              <td className={`py-3 text-xs font-medium capitalize ${nodeStatusClass(node.status)}`}>
                {node.status}
              </td>
              <td className="py-3 font-mono text-xs">
                {node.usedGpus}/{node.gpus}
              </td>
              <td className="py-3 font-mono text-xs">{node.utilization}%</td>
              <td className="py-3 font-mono text-xs">{node.workloads}</td>
              <td className="py-3 font-mono text-xs">{node.queue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageFrame>
  );
}