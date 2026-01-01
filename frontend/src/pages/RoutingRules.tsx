import { useState, useEffect } from 'react';
import { routingRulesAPI, servicesAPI } from '../lib/api-client';
import type {
  AlertRoutingRule,
  CreateRoutingRuleRequest,
  UpdateRoutingRuleRequest,
  RoutingCondition,
  ConditionOperator,
  MatchType,
  Service,
} from '../types/api';

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'regex', label: 'Matches Regex' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' },
  { value: 'exists', label: 'Exists' },
  { value: 'not_exists', label: 'Does Not Exist' },
];

const COMMON_FIELDS = [
  'summary',
  'severity',
  'source',
  'details.environment',
  'details.host',
  'details.service',
  'details.component',
];

const SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;

export function RoutingRules() {
  const [rules, setRules] = useState<AlertRoutingRule[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRoutingRule | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMatchType, setFormMatchType] = useState<MatchType>('all');
  const [formConditions, setFormConditions] = useState<RoutingCondition[]>([]);
  const [formTargetServiceId, setFormTargetServiceId] = useState<string>('');
  const [formSetSeverity, setFormSetSeverity] = useState<string>('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesRes, servicesRes] = await Promise.all([
        routingRulesAPI.list(),
        servicesAPI.list(),
      ]);
      setRules(rulesRes.rules);
      setServices(servicesRes.services);
      setError(null);
    } catch (err) {
      setError('Failed to load routing rules');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormMatchType('all');
    setFormConditions([]);
    setFormTargetServiceId('');
    setFormSetSeverity('');
    setFormEnabled(true);
    setEditingRule(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (rule: AlertRoutingRule) => {
    setFormName(rule.name);
    setFormDescription(rule.description || '');
    setFormMatchType(rule.matchType);
    setFormConditions(rule.conditions || []);
    setFormTargetServiceId(rule.targetServiceId || '');
    setFormSetSeverity(rule.setSeverity || '');
    setFormEnabled(rule.enabled);
    setEditingRule(rule);
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const addCondition = () => {
    setFormConditions([
      ...formConditions,
      { field: 'summary', operator: 'contains', value: '' },
    ]);
  };

  const updateCondition = (index: number, updates: Partial<RoutingCondition>) => {
    const newConditions = [...formConditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setFormConditions(newConditions);
  };

  const removeCondition = (index: number) => {
    setFormConditions(formConditions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      setSubmitting(true);

      if (editingRule) {
        const updateData: UpdateRoutingRuleRequest = {
          name: formName,
          description: formDescription || undefined,
          matchType: formMatchType,
          conditions: formConditions,
          targetServiceId: formTargetServiceId || null,
          setSeverity: (formSetSeverity as any) || null,
          enabled: formEnabled,
        };
        await routingRulesAPI.update(editingRule.id, updateData);
      } else {
        const createData: CreateRoutingRuleRequest = {
          name: formName,
          description: formDescription || undefined,
          matchType: formMatchType,
          conditions: formConditions,
          targetServiceId: formTargetServiceId || undefined,
          setSeverity: (formSetSeverity as any) || undefined,
          enabled: formEnabled,
        };
        await routingRulesAPI.create(createData);
      }

      closeModal();
      loadData();
    } catch (err) {
      console.error('Failed to save rule:', err);
      setError('Failed to save routing rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rule: AlertRoutingRule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;

    try {
      await routingRulesAPI.delete(rule.id);
      loadData();
    } catch (err) {
      console.error('Failed to delete rule:', err);
      setError('Failed to delete routing rule');
    }
  };

  const handleToggleEnabled = async (rule: AlertRoutingRule) => {
    try {
      await routingRulesAPI.update(rule.id, { enabled: !rule.enabled });
      loadData();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading routing rules...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alert Routing Rules</h1>
          <p className="text-muted-foreground mt-1">
            Route incoming alerts to services based on content conditions
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Create Rule
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="bg-card rounded-lg shadow p-12 text-center">
          <div className="text-muted-foreground text-5xl mb-4">...</div>
          <h3 className="text-lg font-medium text-foreground mb-2">No routing rules yet</h3>
          <p className="text-muted-foreground mb-4">
            Create routing rules to automatically route alerts to the right service based on their content.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Your First Rule
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Rule
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Conditions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {rules.map((rule) => (
                <tr key={rule.id} className={!rule.enabled ? 'bg-muted opacity-60' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    #{rule.ruleOrder + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground">{rule.name}</div>
                    {rule.description && (
                      <div className="text-sm text-muted-foreground">{rule.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-foreground">
                      {rule.conditions.length === 0 ? (
                        <span className="text-muted-foreground italic">Match all alerts</span>
                      ) : (
                        <div className="space-y-1">
                          {rule.conditions.slice(0, 2).map((c, i) => (
                            <div key={i} className="text-xs bg-muted px-2 py-1 rounded">
                              {c.field} {c.operator.replace('_', ' ')} "{String(c.value)}"
                            </div>
                          ))}
                          {rule.conditions.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{rule.conditions.length - 2} more ({rule.matchType === 'all' ? 'AND' : 'OR'})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {rule.targetService && (
                      <div className="text-foreground">
                        Route to: <span className="font-medium">{rule.targetService.name}</span>
                      </div>
                    )}
                    {rule.setSeverity && (
                      <div className="text-muted-foreground">
                        Set severity: <span className={`font-medium ${
                          rule.setSeverity === 'critical' ? 'text-red-600' :
                          rule.setSeverity === 'error' ? 'text-orange-600' :
                          rule.setSeverity === 'warning' ? 'text-yellow-600' :
                          'text-blue-600'
                        }`}>{rule.setSeverity}</span>
                      </div>
                    )}
                    {!rule.targetService && !rule.setSeverity && (
                      <span className="text-muted-foreground italic">No action</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleEnabled(rule)}
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        rule.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(rule)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-bold text-foreground">
                  {editingRule ? 'Edit Routing Rule' : 'Create Routing Rule'}
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Route Production Alerts"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>

                {/* Match Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Match Type
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={formMatchType === 'all'}
                        onChange={() => setFormMatchType('all')}
                        className="mr-2"
                      />
                      <span>All conditions (AND)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={formMatchType === 'any'}
                        onChange={() => setFormMatchType('any')}
                        className="mr-2"
                      />
                      <span>Any condition (OR)</span>
                    </label>
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Conditions
                  </label>
                  <div className="space-y-3">
                    {formConditions.map((condition, index) => (
                      <div key={index} className="flex gap-2 items-start bg-muted p-3 rounded-lg">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div>
                            <select
                              value={condition.field}
                              onChange={(e) => updateCondition(index, { field: e.target.value })}
                              className="w-full border border-border rounded px-2 py-1 text-sm"
                            >
                              {COMMON_FIELDS.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <select
                              value={condition.operator}
                              onChange={(e) => updateCondition(index, { operator: e.target.value as ConditionOperator })}
                              className="w-full border border-border rounded px-2 py-1 text-sm"
                            >
                              {OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            {condition.operator !== 'exists' && condition.operator !== 'not_exists' && (
                              <input
                                type="text"
                                value={String(condition.value || '')}
                                onChange={(e) => updateCondition(index, { value: e.target.value })}
                                className="w-full border border-border rounded px-2 py-1 text-sm"
                                placeholder="Value"
                              />
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCondition(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add Condition
                  </button>
                  {formConditions.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      No conditions = matches all alerts
                    </p>
                  )}
                </div>

                {/* Target Service */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Route to Service
                  </label>
                  <select
                    value={formTargetServiceId}
                    onChange={(e) => setFormTargetServiceId(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- No routing (keep original) --</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Set Severity */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Override Severity
                  </label>
                  <select
                    value={formSetSeverity}
                    onChange={(e) => setFormSetSeverity(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- No override (keep original) --</option>
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Enabled */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formEnabled}
                      onChange={(e) => setFormEnabled(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-foreground">Enabled</span>
                  </label>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingRule ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoutingRules;
