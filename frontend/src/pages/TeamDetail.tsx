import { useParams } from "react-router-dom";

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        Team Details
      </h1>
      <p className="mt-1 text-sm text-gray-500">Team {id}</p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">Team detail view coming soon.</p>
      </div>
    </div>
  );
}
