import { GitBranch } from "lucide-react";

export default function EscalationPolicies() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Escalation Policies</h1>
          <p className="mt-1 text-sm text-gray-500">Define how incidents escalate through your teams</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Create Policy
        </button>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-12 text-center">
        <GitBranch className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-sm font-medium text-gray-900">No escalation policies</h3>
        <p className="mt-1 text-sm text-gray-500">Create an escalation policy to route incidents</p>
      </div>
    </div>
  );
}
