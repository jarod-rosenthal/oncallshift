import { Server } from "lucide-react";

export default function Services() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Services</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your services and integrations</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add Service
        </button>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Server className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-sm font-medium text-gray-900">No services</h3>
        <p className="mt-1 text-sm text-gray-500">Add a service to start monitoring</p>
      </div>
    </div>
  );
}
