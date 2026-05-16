import PageFrame from "../../../components/PageFrame";
import { policies } from "../../../lib/mockData";
import { policyStatusClass } from "../../../lib/utils";

export default function PoliciesPage() {
  return (
    <PageFrame>
     <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
      <p className="mt-1 text-sm text-slate-600">
        Review safety controls, GPU limits, shell restrictions, and cost threshold policies.
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
                {policy.lastTriggered}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageFrame>
  );
}