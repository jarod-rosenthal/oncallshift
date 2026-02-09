import { Calendar } from "lucide-react";

export default function Schedules() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Schedules</h1>
          <p className="mt-1 text-sm text-gray-500">Configure on-call schedules and rotations</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Create Schedule
        </button>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Calendar className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-sm font-medium text-gray-900">No schedules</h3>
        <p className="mt-1 text-sm text-gray-500">Create a schedule to manage on-call rotations</p>
      </div>
    </div>
  );
}
