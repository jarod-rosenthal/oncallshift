import { useState, useEffect } from 'react';
import { businessServicesAPI, dependenciesAPI, servicesAPI } from '../lib/api-client';
import type {
  DependencyGraph,
  Service,
  ServiceDependency,
  CreateDependencyRequest,
  DependencyType,
  DependencyImpactLevel,
} from '../types/api';

const DEPENDENCY_TYPES: { value: DependencyType; label: string; description: string }[] = [
  { value: 'required', label: 'Required', description: 'Service cannot function without it' },
  { value: 'optional', label: 'Optional', description: 'Enhances functionality but not essential' },
  { value: 'runtime', label: 'Runtime', description: 'Needed during operation' },
  { value: 'development', label: 'Development', description: 'Only needed for development' },
];

const IMPACT_LEVELS: { value: DependencyImpactLevel; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800 border-green-300' },
];

export function ServiceDependencies() {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [serviceDeps, setServiceDeps] = useState<{
    upstream: ServiceDependency[];
    downstream: ServiceDependency[];
  } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add dependency form
  const [formDependentId, setFormDependentId] = useState('');
  const [formSupportingId, setFormSupportingId] = useState('');
  const [formType, setFormType] = useState<DependencyType>('required');
  const [formImpact, setFormImpact] = useState<DependencyImpactLevel>('high');
  const [formDescription, setFormDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedService) {
      loadServiceDeps(selectedService);
    } else {
      setServiceDeps(null);
    }
  }, [selectedService]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [graphData, servicesData] = await Promise.all([
        businessServicesAPI.getDependencyGraph(),
        servicesAPI.list(),
      ]);
      setGraph(graphData);
      // Handle paginated responses - prefer legacy key, fall back to data array
      setServices(servicesData.services || (servicesData as any).data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load dependency graph:', err);
      setError('Failed to load dependency graph');
    } finally {
      setLoading(false);
    }
  };

  const loadServiceDeps = async (serviceId: string) => {
    try {
      const deps = await dependenciesAPI.getForService(serviceId, 'both');
      setServiceDeps(deps);
    } catch (err) {
      console.error('Failed to load service dependencies:', err);
    }
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDependentId || !formSupportingId) return;
    if (formDependentId === formSupportingId) {
      setError('A service cannot depend on itself');
      return;
    }

    try {
      setSubmitting(true);
      const data: CreateDependencyRequest = {
        dependentServiceId: formDependentId,
        supportingServiceId: formSupportingId,
        dependencyType: formType,
        impactLevel: formImpact,
        description: formDescription || undefined,
      };
      await dependenciesAPI.create(data);
      setShowAddModal(false);
      resetForm();
      loadData();
      if (selectedService) {
        loadServiceDeps(selectedService);
      }
    } catch (err: any) {
      console.error('Failed to add dependency:', err);
      setError(err.response?.data?.error || 'Failed to add dependency');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDependency = async (depId: string) => {
    if (!confirm('Delete this dependency?')) return;

    try {
      await dependenciesAPI.delete(depId);
      loadData();
      if (selectedService) {
        loadServiceDeps(selectedService);
      }
    } catch (err) {
      console.error('Failed to delete dependency:', err);
      setError('Failed to delete dependency');
    }
  };

  const resetForm = () => {
    setFormDependentId('');
    setFormSupportingId('');
    setFormType('required');
    setFormImpact('high');
    setFormDescription('');
  };

  const getImpactColor = (impact: DependencyImpactLevel) => {
    const level = IMPACT_LEVELS.find((l) => l.value === impact);
    return level?.color || 'bg-muted text-gray-800';
  };

  const getServiceName = (id: string) => {
    const node = graph?.nodes.find((n) => n.id === id);
    return node?.name || services.find((s) => s.id === id)?.name || id;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading dependency graph...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Service Dependencies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Map relationships between technical services
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          Add Dependency
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-500 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Services List */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-lg">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Services</h2>
              <p className="text-xs text-muted-foreground mt-1">Click to view dependencies</p>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {graph?.nodes.length === 0 ? (
                <div className="p-4 text-muted-foreground text-sm text-center">No services found</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {graph?.nodes.map((node) => {
                    const inDeps = graph.edges.filter((e) => e.target === node.id).length;
                    const outDeps = graph.edges.filter((e) => e.source === node.id).length;

                    return (
                      <button
                        key={node.id}
                        onClick={() =>
                          setSelectedService(selectedService === node.id ? null : node.id)
                        }
                        className={`w-full p-3 text-left hover:bg-muted transition-colors ${
                          selectedService === node.id ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{node.name}</p>
                            {node.businessServiceName && (
                              <p className="text-xs text-muted-foreground">{node.businessServiceName}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {outDeps > 0 && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                {outDeps} deps
                              </span>
                            )}
                            {inDeps > 0 && (
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                {inDeps} depnts
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dependency Details */}
        <div className="lg:col-span-2">
          {selectedService && serviceDeps ? (
            <div className="space-y-6">
              {/* Selected Service Header */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {getServiceName(selectedService)}
                </h2>
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                  <span>{serviceDeps.upstream.length} upstream dependencies</span>
                  <span>{serviceDeps.downstream.length} downstream dependents</span>
                </div>
              </div>

              {/* Upstream (services this depends on) */}
              <div className="bg-card border border-border rounded-lg">
                <div className="p-4 border-b border-border bg-blue-50">
                  <h3 className="font-semibold text-blue-900">
                    Depends On (Upstream)
                  </h3>
                  <p className="text-xs text-blue-700 mt-1">
                    Services that this service requires to function
                  </p>
                </div>
                {serviceDeps.upstream.length === 0 ? (
                  <div className="p-4 text-muted-foreground text-sm">No upstream dependencies</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {serviceDeps.upstream.map((dep) => (
                      <div key={dep.id} className="p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {dep.supportingService?.name || dep.supportingServiceId}
                          </p>
                          {dep.description && (
                            <p className="text-sm text-muted-foreground mt-1">{dep.description}</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <span className="px-2 py-0.5 text-xs bg-muted text-foreground rounded">
                              {DEPENDENCY_TYPES.find((t) => t.value === dep.dependencyType)?.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded border ${getImpactColor(
                                dep.impactLevel
                              )}`}
                            >
                              {dep.impactLevel}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDependency(dep.id)}
                          className="ml-4 text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Downstream (services that depend on this) */}
              <div className="bg-card border border-border rounded-lg">
                <div className="p-4 border-b border-border bg-green-50">
                  <h3 className="font-semibold text-green-900">
                    Dependents (Downstream)
                  </h3>
                  <p className="text-xs text-green-700 mt-1">
                    Services that require this service to function
                  </p>
                </div>
                {serviceDeps.downstream.length === 0 ? (
                  <div className="p-4 text-muted-foreground text-sm">No downstream dependents</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {serviceDeps.downstream.map((dep) => (
                      <div key={dep.id} className="p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {dep.dependentService?.name || dep.dependentServiceId}
                          </p>
                          {dep.description && (
                            <p className="text-sm text-muted-foreground mt-1">{dep.description}</p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <span className="px-2 py-0.5 text-xs bg-muted text-foreground rounded">
                              {DEPENDENCY_TYPES.find((t) => t.value === dep.dependencyType)?.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded border ${getImpactColor(
                                dep.impactLevel
                              )}`}
                            >
                              {dep.impactLevel}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDependency(dep.id)}
                          className="ml-4 text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <div className="text-muted-foreground mb-4">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <p className="text-muted-foreground">Select a service to view its dependencies</p>
              <p className="text-sm text-muted-foreground mt-2">
                {graph?.edges.length || 0} total dependencies mapped
              </p>
            </div>
          )}

          {/* Dependency Summary */}
          {graph && graph.edges.length > 0 && !selectedService && (
            <div className="mt-6 bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-4">Dependency Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{graph.nodes.length}</p>
                  <p className="text-sm text-muted-foreground">Services</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{graph.edges.length}</p>
                  <p className="text-sm text-muted-foreground">Dependencies</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">
                    {graph.edges.filter((e) => e.impactLevel === 'critical').length}
                  </p>
                  <p className="text-sm text-red-600">Critical</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {graph.edges.filter((e) => e.impactLevel === 'high').length}
                  </p>
                  <p className="text-sm text-orange-600">High Impact</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Dependency Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4">
            <form onSubmit={handleAddDependency}>
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">Add Dependency</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Define a relationship between two services
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Dependent Service *
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    The service that requires another service
                  </p>
                  <select
                    value={formDependentId}
                    onChange={(e) => setFormDependentId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select service...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-center">
                  <div className="text-muted-foreground">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                  <span className="ml-2 text-sm text-muted-foreground">depends on</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Supporting Service *
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">The service being depended upon</p>
                  <select
                    value={formSupportingId}
                    onChange={(e) => setFormSupportingId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select service...</option>
                    {services
                      .filter((s) => s.id !== formDependentId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Dependency Type
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as DependencyType)}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {DEPENDENCY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Impact Level
                    </label>
                    <select
                      value={formImpact}
                      onChange={(e) => setFormImpact(e.target.value as DependencyImpactLevel)}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {IMPACT_LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe this dependency..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-foreground bg-muted rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formDependentId || !formSupportingId}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Dependency'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
