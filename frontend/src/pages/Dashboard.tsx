import { AlertTriangle, CheckCircle, Clock, Server } from "lucide-react";

const stats = [
  { name: "Triggered", value: "—", icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  { name: "Acknowledged", value: "—", icon: Clock, color: "text-yellow-600 bg-yellow-50" },
  { name: "Resolved (24h)", value: "—", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  { name: "Services", value: "—", icon: Server, color: "text-blue-600 bg-blue-50" },
];

export default function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Overview of your on-call operations</p>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className={`rounded-md p-2 ${stat.color}`}>
                <stat.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Incidents</h2>
          <p className="mt-2 text-sm text-gray-500">No incidents to display</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">On-Call Now</h2>
          <p className="mt-2 text-sm text-gray-500">No on-call schedules configured</p>
        </div>
      </div>
    </div>
  );
}
