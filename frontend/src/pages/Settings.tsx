export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">Manage your account and organization settings</p>

      <div className="mt-6 space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          <p className="mt-1 text-sm text-gray-500">Your personal account settings</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          <p className="mt-1 text-sm text-gray-500">Configure how you receive notifications</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
          <p className="mt-1 text-sm text-gray-500">Manage API keys for integrations</p>
        </div>
      </div>
    </div>
  );
}
