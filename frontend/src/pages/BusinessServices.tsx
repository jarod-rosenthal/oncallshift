import { useState, useEffect } from 'react';
import { businessServicesAPI, servicesAPI, teamsAPI, usersAPI } from '../lib/api-client';
import type { Team } from '../lib/api-client';
import type {
  BusinessService,
  CreateBusinessServiceRequest,
  UpdateBusinessServiceRequest,
  BusinessServiceStatus,
  ImpactTier,
  Service,
  User,
} from '../types/api';

const STATUS_OPTIONS: { value: BusinessServiceStatus; label: string; color: string }[] = [
  { value: 'operational', label: 'Operational', color: 'bg-green-100 text-green-800' },
  { value: 'degraded', label: 'Degraded', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'major_outage', label: 'Major Outage', color: 'bg-red-100 text-red-800' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-blue-100 text-blue-800' },
  { value: 'unknown', label: 'Unknown', color: 'bg-muted text-muted-foreground' },
];

const IMPACT_TIERS: { value: ImpactTier; label: string; description: string }[] = [
  { value: 'tier_1', label: 'Tier 1 - Critical', description: 'Critical business impact' },
  { value: 'tier_2', label: 'Tier 2 - High', description: 'Significant business impact' },
  { value: 'tier_3', label: 'Tier 3 - Medium', description: 'Moderate business impact' },
  { value: 'tier_4', label: 'Tier 4 - Low', description: 'Minimal business impact' },
];

export function BusinessServices() {
  const [businessServices, setBusinessServices] = useState<BusinessService[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<BusinessService | null>(null);
  const [showServiceSelector, setShowServiceSelector] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formOwnerTeamId, setFormOwnerTeamId] = useState('');
  const [formPointOfContactId, setFormPointOfContactId] = useState('');
  const [formStatus, setFormStatus] = useState<BusinessServiceStatus>('operational');
  const [formImpactTier, setFormImpactTier] = useState<ImpactTier>('tier_3');
  const [formExternalId, setFormExternalId] = useState('');
  const [formDocumentationUrl, setFormDocumentationUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTier, setFilterTier] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bsData, servicesData, teamsData, usersData] = await Promise.all([
        businessServicesAPI.list(),
        servicesAPI.list(),
        teamsAPI.list(),
        usersAPI.listUsers(),
      ]);
      setBusinessServices(bsData || []);
      setServices(servicesData?.services || []);
      setTeams(teamsData?.teams || []);
      setUsers(usersData?.users || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load business services');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormOwnerTeamId('');
    setFormPointOfContactId('');
    setFormStatus('operational');
    setFormImpactTier('tier_3');
    setFormExternalId('');
    setFormDocumentationUrl('');
    setEditingService(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (bs: BusinessService) => {
    setFormName(bs.name);
    setFormDescription(bs.description || '');
    setFormOwnerTeamId(bs.ownerTeamId || '');
    setFormPointOfContactId(bs.pointOfContactId || '');
    setFormStatus(bs.status);
    setFormImpactTier(bs.impactTier);
    setFormExternalId(bs.externalId || '');
    setFormDocumentationUrl(bs.documentationUrl || '');
    setEditingService(bs);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      setSubmitting(true);

      if (editingService) {
        const updateData: UpdateBusinessServiceRequest = {
          name: formName,
          description: formDescription || null,
          ownerTeamId: formOwnerTeamId || null,
          pointOfContactId: formPointOfContactId || null,
          status: formStatus,
          impactTier: formImpactTier,
          externalId: formExternalId || null,
          documentationUrl: formDocumentationUrl || null,
        };
        await businessServicesAPI.update(editingService.id, updateData);
      } else {
        const createData: CreateBusinessServiceRequest = {
          name: formName,
          description: formDescription || undefined,
          ownerTeamId: formOwnerTeamId || undefined,
          pointOfContactId: formPointOfContactId || undefined,
          status: formStatus,
          impactTier: formImpactTier,
          externalId: formExternalId || undefined,
          documentationUrl: formDocumentationUrl || undefined,
        };
        await businessServicesAPI.create(createData);
      }

      closeModal();
      loadData();
    } catch (err) {
      console.error('Failed to save business service:', err);
      setError('Failed to save business service');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (bs: BusinessService) => {
    if (!confirm(`Delete business service "${bs.name}"? This will unlink all associated technical services.`)) {
      return;
    }

    try {
      await businessServicesAPI.delete(bs.id);
      loadData();
    } catch (err) {
      console.error('Failed to delete business service:', err);
      setError('Failed to delete business service');
    }
  };

  const handleUpdateServices = async (bsId: string, serviceIds: string[]) => {
    try {
      await businessServicesAPI.updateServices(bsId, serviceIds);
      setShowServiceSelector(null);
      loadData();
    } catch (err) {
      console.error('Failed to update services:', err);
      setError('Failed to update linked services');
    }
  };

  const getStatusBadge = (status: BusinessServiceStatus) => {
    const statusOpt = STATUS_OPTIONS.find(s => s.value === status);
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusOpt?.color || 'bg-muted text-muted-foreground'}`}>
        {statusOpt?.label || status}
      </span>
    );
  };

  const getTierBadge = (tier: ImpactTier) => {
    const colors: Record<ImpactTier, string> = {
      tier_1: 'bg-red-100 text-red-800 border-red-200',
      tier_2: 'bg-orange-100 text-orange-800 border-orange-200',
      tier_3: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      tier_4: 'bg-green-100 text-green-800 border-green-200',
    };
    const tierOpt = IMPACT_TIERS.find(t => t.value === tier);
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${colors[tier]}`}>
        {tierOpt?.label || tier}
      </span>
    );
  };

  const filteredServices = businessServices.filter(bs => {
    if (filterStatus && bs.status !== filterStatus) return false;
    if (filterTier && bs.impactTier !== filterTier) return false;
    return true;
  });

  // Get services not assigned to any business service
  const unassignedServices = services.filter(
    s => !businessServices.some(bs => bs.services?.some(linked => linked.id === s.id))
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading business services...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Business Services</h1>
          <p className="text-sm text-muted-foreground mt-1">
            High-level services representing business capabilities
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          Create Business Service
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

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
        >
          <option value="">All Impact Tiers</option>
          {IMPACT_TIERS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Business Services Grid */}
      {filteredServices.length === 0 ? (
        <div className="text-center py-12 bg-muted rounded-lg">
          <p className="text-muted-foreground">No business services found</p>
          <button
            onClick={openCreateModal}
            className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Create your first business service
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((bs) => (
            <div
              key={bs.id}
              className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{bs.name}</h3>
                    {bs.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{bs.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(bs.status)}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  {getTierBadge(bs.impactTier)}
                </div>

                {/* Owner & Contact */}
                <div className="text-sm text-muted-foreground space-y-1 mb-4">
                  {bs.ownerTeam && (
                    <p>
                      <span className="text-muted-foreground">Team:</span> {bs.ownerTeam.name}
                    </p>
                  )}
                  {bs.pointOfContact && (
                    <p>
                      <span className="text-muted-foreground">Contact:</span> {bs.pointOfContact.fullName}
                    </p>
                  )}
                </div>

                {/* Linked Services */}
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      Technical Services ({bs.services?.length || 0})
                    </span>
                    <button
                      onClick={() => setShowServiceSelector(bs.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Manage
                    </button>
                  </div>
                  {bs.services && bs.services.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {bs.services.slice(0, 3).map((s) => (
                        <span
                          key={s.id}
                          className="px-2 py-0.5 bg-muted text-foreground text-xs rounded"
                        >
                          {s.name}
                        </span>
                      ))}
                      {bs.services.length > 3 && (
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded">
                          +{bs.services.length - 3} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No services linked</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => openEditModal(bs)}
                    className="flex-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded"
                  >
                    Edit
                  </button>
                  {bs.documentationUrl && (
                    <a
                      href={bs.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded text-center"
                    >
                      Docs
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(bs)}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unassigned Services Summary */}
      {unassignedServices.length > 0 && (
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">
            Unassigned Technical Services ({unassignedServices.length})
          </h4>
          <p className="text-sm text-yellow-700 mb-2">
            These technical services are not linked to any business service:
          </p>
          <div className="flex flex-wrap gap-2">
            {unassignedServices.slice(0, 10).map((s) => (
              <span key={s.id} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                {s.name}
              </span>
            ))}
            {unassignedServices.length > 10 && (
              <span className="px-2 py-1 text-yellow-600 text-xs">
                +{unassignedServices.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingService ? 'Edit Business Service' : 'Create Business Service'}
                </h2>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., E-Commerce Platform"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Describe this business service..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as BusinessServiceStatus)}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Impact Tier
                    </label>
                    <select
                      value={formImpactTier}
                      onChange={(e) => setFormImpactTier(e.target.value as ImpactTier)}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {IMPACT_TIERS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Owner Team
                    </label>
                    <select
                      value={formOwnerTeamId}
                      onChange={(e) => setFormOwnerTeamId(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select a team...</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Point of Contact
                    </label>
                    <select
                      value={formPointOfContactId}
                      onChange={(e) => setFormPointOfContactId(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select a user...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    External ID
                  </label>
                  <input
                    type="text"
                    value={formExternalId}
                    onChange={(e) => setFormExternalId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Optional external reference ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Documentation URL
                  </label>
                  <input
                    type="url"
                    value={formDocumentationUrl}
                    onChange={(e) => setFormDocumentationUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-foreground bg-muted rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingService ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Selector Modal */}
      {showServiceSelector && (
        <ServiceSelectorModal
          currentServices={
            businessServices.find((bs) => bs.id === showServiceSelector)?.services?.map((s) => s.id) || []
          }
          allServices={services}
          onSave={(serviceIds) => handleUpdateServices(showServiceSelector, serviceIds)}
          onClose={() => setShowServiceSelector(null)}
        />
      )}
    </div>
  );
}

// Service Selector Modal Component
function ServiceSelectorModal({
  currentServices,
  allServices,
  onSave,
  onClose,
}: {
  currentServices: string[];
  allServices: Service[];
  onSave: (serviceIds: string[]) => void;
  onClose: () => void;
}) {
  const [selectedServices, setSelectedServices] = useState<string[]>(currentServices);

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Link Technical Services</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select the technical services that belong to this business service
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {allServices.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No technical services available</p>
          ) : (
            <div className="space-y-2">
              {allServices.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center p-3 border border-border rounded-lg hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(service.id)}
                    onChange={() => toggleService(service.id)}
                    className="h-4 w-4 text-indigo-600 rounded border-border focus:ring-indigo-500"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-foreground">{service.name}</p>
                    {service.description && (
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    )}
                  </div>
                  <span
                    className={`ml-auto px-2 py-0.5 text-xs rounded ${
                      service.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : service.status === 'maintenance'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-muted text-gray-800'
                    }`}
                  >
                    {service.status}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-foreground bg-muted rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(selectedServices)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
