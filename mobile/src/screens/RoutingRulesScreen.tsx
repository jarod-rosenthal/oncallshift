import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  FAB,
  Portal,
  Modal,
  Button,
  TextInput,
  ActivityIndicator,
  Chip,
  IconButton,
  Menu,
  Divider,
  Switch,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useToast } from '../components';
import * as apiService from '../services/apiService';
import type { RoutingRule, RoutingRuleCondition, Service } from '../services/apiService';
import * as hapticService from '../services/hapticService';

type ConditionOperator = RoutingRuleCondition['operator'];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'regex', label: 'Regex' },
  { value: 'exists', label: 'Exists' },
  { value: 'not_exists', label: 'Not Exists' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'No Change' },
  { value: 'critical', label: 'Critical', color: '#dc2626' },
  { value: 'error', label: 'Error', color: '#ea580c' },
  { value: 'warning', label: 'Warning', color: '#ca8a04' },
  { value: 'info', label: 'Info', color: '#2563eb' },
];

const COMMON_FIELDS = [
  'source',
  'severity',
  'summary',
  'component',
  'group',
  'class',
  'custom_details.service',
  'custom_details.environment',
];

export default function RoutingRulesScreen() {
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RoutingRule | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [matchType, setMatchType] = useState<'all' | 'any'>('all');
  const [conditions, setConditions] = useState<RoutingRuleCondition[]>([
    { field: '', operator: 'equals', value: '' },
  ]);
  const [targetServiceId, setTargetServiceId] = useState<string>('');
  const [setSeverity, setSetSeverity] = useState<string>('');
  const [enabled, setEnabled] = useState(true);

  // Pickers state
  const [showOperatorPicker, setShowOperatorPicker] = useState<number | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState<number | null>(null);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showSeverityPicker, setShowSeverityPicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesData, servicesData] = await Promise.all([
        apiService.getRoutingRules(),
        apiService.getServices(),
      ]);
      setRules(rulesData.sort((a, b) => a.ruleOrder - b.ruleOrder));
      setServices(servicesData);
    } catch (error: any) {
      showToast({ message: 'Failed to load routing rules', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!ruleName.trim()) {
      showToast({ message: 'Rule name is required', type: 'error' });
      return;
    }

    const validConditions = conditions.filter(c => c.field.trim());
    if (validConditions.length === 0) {
      showToast({ message: 'At least one condition is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.createRoutingRule({
        name: ruleName.trim(),
        description: ruleDescription.trim() || undefined,
        matchType,
        conditions: validConditions,
        targetServiceId: targetServiceId || undefined,
        setSeverity: (setSeverity as 'info' | 'warning' | 'error' | 'critical') || undefined,
        enabled,
      });
      hapticService.success();
      showToast({ message: 'Routing rule created', type: 'success' });
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      showToast({ message: error.response?.data?.error || 'Failed to create rule', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRule || !ruleName.trim()) return;

    const validConditions = conditions.filter(c => c.field.trim());
    if (validConditions.length === 0) {
      showToast({ message: 'At least one condition is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.updateRoutingRule(selectedRule.id, {
        name: ruleName.trim(),
        description: ruleDescription.trim() || undefined,
        matchType,
        conditions: validConditions,
        targetServiceId: targetServiceId || null,
        setSeverity: (setSeverity as 'info' | 'warning' | 'error' | 'critical') || null,
        enabled,
      });
      hapticService.success();
      showToast({ message: 'Routing rule updated', type: 'success' });
      setShowEditModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      showToast({ message: error.response?.data?.error || 'Failed to update rule', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (rule: RoutingRule) => {
    hapticService.warning();
    Alert.alert(
      'Delete Routing Rule',
      `Are you sure you want to delete "${rule.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteRoutingRule(rule.id);
              hapticService.success();
              showToast({ message: 'Routing rule deleted', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: error.response?.data?.error || 'Failed to delete rule', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleToggleEnabled = async (rule: RoutingRule) => {
    try {
      await apiService.updateRoutingRule(rule.id, { enabled: !rule.enabled });
      hapticService.lightTap();
      showToast({ message: `Rule ${rule.enabled ? 'disabled' : 'enabled'}`, type: 'success' });
      fetchData();
    } catch (error: any) {
      showToast({ message: 'Failed to update rule', type: 'error' });
    }
  };

  const openEditModal = (rule: RoutingRule) => {
    setSelectedRule(rule);
    setRuleName(rule.name);
    setRuleDescription(rule.description || '');
    setMatchType(rule.matchType);
    setConditions(rule.conditions.length > 0 ? rule.conditions : [{ field: '', operator: 'equals', value: '' }]);
    setTargetServiceId(rule.targetServiceId || '');
    setSetSeverity(rule.setSeverity || '');
    setEnabled(rule.enabled);
    setShowEditModal(true);
    setMenuVisible(null);
  };

  const resetForm = () => {
    setRuleName('');
    setRuleDescription('');
    setMatchType('all');
    setConditions([{ field: '', operator: 'equals', value: '' }]);
    setTargetServiceId('');
    setSetSeverity('');
    setEnabled(true);
    setSelectedRule(null);
  };

  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const updateCondition = (index: number, updates: Partial<RoutingRuleCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const getSeverityColor = (severity: string | undefined): string => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'error': return '#ea580c';
      case 'warning': return '#ca8a04';
      case 'info': return '#2563eb';
      default: return colors.textMuted;
    }
  };

  const getOperatorLabel = (operator: ConditionOperator): string => {
    return OPERATORS.find(o => o.value === operator)?.label || operator;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading routing rules...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {rules.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="router" size={64} color={colors.textMuted} />
            <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              No Routing Rules
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
              Create routing rules to automatically route alerts to services based on conditions.
            </Text>
            <Button
              mode="contained"
              onPress={() => {
                hapticService.lightTap();
                setShowCreateModal(true);
              }}
              style={styles.emptyButton}
            >
              Create First Rule
            </Button>
          </View>
        ) : (
          rules.map((rule, index) => (
            <Card key={rule.id} style={[styles.ruleCard, { backgroundColor: colors.surface }]}>
              <Card.Content>
                <View style={styles.ruleHeader}>
                  <View style={styles.ruleOrderBadge}>
                    <Text style={[styles.ruleOrderText, { color: colors.primary }]}>#{rule.ruleOrder}</Text>
                  </View>
                  <View style={styles.ruleInfo}>
                    <View style={styles.ruleTitleRow}>
                      <Text
                        variant="titleMedium"
                        style={[
                          { color: colors.textPrimary, fontWeight: '600' },
                          !rule.enabled && { opacity: 0.5 },
                        ]}
                      >
                        {rule.name}
                      </Text>
                      {!rule.enabled && (
                        <Chip
                          compact
                          style={[styles.disabledChip, { backgroundColor: `${colors.textMuted}20` }]}
                          textStyle={{ color: colors.textMuted, fontSize: 10 }}
                        >
                          Disabled
                        </Chip>
                      )}
                    </View>
                    {rule.description && (
                      <Text
                        variant="bodySmall"
                        style={{ color: colors.textSecondary, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {rule.description}
                      </Text>
                    )}
                  </View>
                  <Menu
                    visible={menuVisible === rule.id}
                    onDismiss={() => setMenuVisible(null)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        size={20}
                        onPress={() => setMenuVisible(rule.id)}
                      />
                    }
                  >
                    <Menu.Item
                      onPress={() => openEditModal(rule)}
                      title="Edit"
                      leadingIcon="pencil"
                    />
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleToggleEnabled(rule);
                      }}
                      title={rule.enabled ? 'Disable' : 'Enable'}
                      leadingIcon={rule.enabled ? 'toggle-switch-off' : 'toggle-switch'}
                    />
                    <Divider />
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleDelete(rule);
                      }}
                      title="Delete"
                      leadingIcon="delete"
                      titleStyle={{ color: colors.error }}
                    />
                  </Menu>
                </View>

                {/* Conditions Preview */}
                <View style={styles.conditionsPreview}>
                  <Text variant="labelSmall" style={{ color: colors.textMuted, marginBottom: 6 }}>
                    Match {rule.matchType.toUpperCase()} conditions:
                  </Text>
                  {rule.conditions.slice(0, 3).map((condition, idx) => (
                    <View key={idx} style={styles.conditionRow}>
                      <MaterialCommunityIcons name="filter" size={14} color={colors.textMuted} />
                      <Text variant="bodySmall" style={{ color: colors.textSecondary, marginLeft: 6 }}>
                        {condition.field} {getOperatorLabel(condition.operator)}{' '}
                        {condition.value !== undefined && `"${condition.value}"`}
                      </Text>
                    </View>
                  ))}
                  {rule.conditions.length > 3 && (
                    <Text variant="bodySmall" style={{ color: colors.textMuted, marginLeft: 20 }}>
                      +{rule.conditions.length - 3} more
                    </Text>
                  )}
                </View>

                {/* Actions Preview */}
                <View style={styles.actionsPreview}>
                  {rule.targetService && (
                    <Chip
                      compact
                      icon="arrow-right"
                      style={[styles.actionChip, { backgroundColor: `${colors.primary}15` }]}
                      textStyle={{ color: colors.primary, fontSize: 11 }}
                    >
                      Route to {rule.targetService.name}
                    </Chip>
                  )}
                  {rule.setSeverity && (
                    <Chip
                      compact
                      icon="alert-circle"
                      style={[styles.actionChip, { backgroundColor: `${getSeverityColor(rule.setSeverity)}15` }]}
                      textStyle={{ color: getSeverityColor(rule.setSeverity), fontSize: 11 }}
                    >
                      Set {rule.setSeverity}
                    </Chip>
                  )}
                  {!rule.targetService && !rule.setSeverity && (
                    <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                      No actions configured
                    </Text>
                  )}
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color="#fff"
        onPress={() => {
          hapticService.lightTap();
          setShowCreateModal(true);
        }}
      />

      {/* Create/Edit Modal */}
      <Portal>
        <Modal
          visible={showCreateModal || showEditModal}
          onDismiss={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            resetForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {showEditModal ? 'Edit Routing Rule' : 'Create Routing Rule'}
            </Text>

            <TextInput
              label="Rule Name"
              value={ruleName}
              onChangeText={setRuleName}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Description (optional)"
              value={ruleDescription}
              onChangeText={setRuleDescription}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.input}
            />

            {/* Match Type */}
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Match Type
            </Text>
            <View style={styles.matchTypeRow}>
              <Pressable
                style={[
                  styles.matchTypeButton,
                  { borderColor: matchType === 'all' ? colors.primary : colors.border },
                  matchType === 'all' && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => setMatchType('all')}
              >
                <Text style={{ color: matchType === 'all' ? colors.primary : colors.textSecondary }}>
                  ALL conditions
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.matchTypeButton,
                  { borderColor: matchType === 'any' ? colors.primary : colors.border },
                  matchType === 'any' && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => setMatchType('any')}
              >
                <Text style={{ color: matchType === 'any' ? colors.primary : colors.textSecondary }}>
                  ANY condition
                </Text>
              </Pressable>
            </View>

            {/* Conditions */}
            <View style={styles.conditionsSection}>
              <View style={styles.conditionsHeader}>
                <Text variant="labelLarge" style={{ color: colors.textSecondary }}>
                  Conditions
                </Text>
                <Button compact mode="text" onPress={addCondition} icon="plus">
                  Add
                </Button>
              </View>

              {conditions.map((condition, index) => (
                <View key={index} style={[styles.conditionCard, { borderColor: colors.border }]}>
                  {/* Field */}
                  <Pressable
                    style={[styles.pickerButton, { borderColor: colors.border }]}
                    onPress={() => setShowFieldPicker(index)}
                  >
                    <Text style={{ color: condition.field ? colors.textPrimary : colors.textMuted }}>
                      {condition.field || 'Select field'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
                  </Pressable>

                  {/* Operator */}
                  <Pressable
                    style={[styles.pickerButton, { borderColor: colors.border }]}
                    onPress={() => setShowOperatorPicker(index)}
                  >
                    <Text style={{ color: colors.textPrimary }}>
                      {getOperatorLabel(condition.operator)}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
                  </Pressable>

                  {/* Value (if not exists/not_exists) */}
                  {!['exists', 'not_exists'].includes(condition.operator) && (
                    <TextInput
                      label="Value"
                      value={typeof condition.value === 'string' ? condition.value : ''}
                      onChangeText={(text) => updateCondition(index, { value: text })}
                      mode="outlined"
                      dense
                      style={styles.conditionInput}
                    />
                  )}

                  {conditions.length > 1 && (
                    <IconButton
                      icon="close"
                      size={18}
                      onPress={() => removeCondition(index)}
                      style={styles.removeConditionButton}
                    />
                  )}
                </View>
              ))}
            </View>

            {/* Actions */}
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Actions
            </Text>

            {/* Target Service */}
            <Pressable
              style={[styles.pickerButton, styles.actionPicker, { borderColor: colors.border }]}
              onPress={() => setShowServicePicker(true)}
            >
              <View>
                <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                  Route to Service
                </Text>
                <Text style={{ color: targetServiceId ? colors.textPrimary : colors.textMuted }}>
                  {targetServiceId
                    ? services.find(s => s.id === targetServiceId)?.name || 'Unknown'
                    : 'No routing (optional)'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>

            {/* Set Severity */}
            <Pressable
              style={[styles.pickerButton, styles.actionPicker, { borderColor: colors.border }]}
              onPress={() => setShowSeverityPicker(true)}
            >
              <View>
                <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                  Override Severity
                </Text>
                <Text style={{ color: setSeverity ? getSeverityColor(setSeverity) : colors.textMuted }}>
                  {setSeverity
                    ? SEVERITY_OPTIONS.find(s => s.value === setSeverity)?.label
                    : 'No change (optional)'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>

            {/* Enabled Toggle */}
            <View style={[styles.enabledRow, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary }}>Rule Enabled</Text>
              <Switch value={enabled} onValueChange={setEnabled} color={colors.primary} />
            </View>

            <View style={styles.modalActions}>
              <Button
                mode="text"
                onPress={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={showEditModal ? handleUpdate : handleCreate}
                loading={saving}
                disabled={saving}
              >
                {showEditModal ? 'Save' : 'Create'}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Field Picker Modal */}
      <Portal>
        <Modal
          visible={showFieldPicker !== null}
          onDismiss={() => setShowFieldPicker(null)}
          contentContainerStyle={[styles.pickerModal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleMedium" style={[styles.pickerTitle, { color: colors.textPrimary }]}>
            Select Field
          </Text>
          <ScrollView style={styles.pickerList}>
            {COMMON_FIELDS.map((field) => (
              <Pressable
                key={field}
                style={[
                  styles.pickerOption,
                  showFieldPicker !== null &&
                    conditions[showFieldPicker]?.field === field && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => {
                  if (showFieldPicker !== null) {
                    updateCondition(showFieldPicker, { field });
                    setShowFieldPicker(null);
                  }
                }}
              >
                <Text style={{ color: colors.textPrimary }}>{field}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            label="Custom field"
            mode="outlined"
            dense
            style={styles.customFieldInput}
            onSubmitEditing={(e) => {
              if (showFieldPicker !== null && e.nativeEvent.text) {
                updateCondition(showFieldPicker, { field: e.nativeEvent.text });
                setShowFieldPicker(null);
              }
            }}
          />
        </Modal>
      </Portal>

      {/* Operator Picker Modal */}
      <Portal>
        <Modal
          visible={showOperatorPicker !== null}
          onDismiss={() => setShowOperatorPicker(null)}
          contentContainerStyle={[styles.pickerModal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleMedium" style={[styles.pickerTitle, { color: colors.textPrimary }]}>
            Select Operator
          </Text>
          <ScrollView style={styles.pickerList}>
            {OPERATORS.map((op) => (
              <Pressable
                key={op.value}
                style={[
                  styles.pickerOption,
                  showOperatorPicker !== null &&
                    conditions[showOperatorPicker]?.operator === op.value && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => {
                  if (showOperatorPicker !== null) {
                    updateCondition(showOperatorPicker, { operator: op.value });
                    setShowOperatorPicker(null);
                  }
                }}
              >
                <Text style={{ color: colors.textPrimary }}>{op.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Modal>
      </Portal>

      {/* Service Picker Modal */}
      <Portal>
        <Modal
          visible={showServicePicker}
          onDismiss={() => setShowServicePicker(false)}
          contentContainerStyle={[styles.pickerModal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleMedium" style={[styles.pickerTitle, { color: colors.textPrimary }]}>
            Select Service
          </Text>
          <ScrollView style={styles.pickerList}>
            <Pressable
              style={[styles.pickerOption, !targetServiceId && { backgroundColor: `${colors.primary}10` }]}
              onPress={() => {
                setTargetServiceId('');
                setShowServicePicker(false);
              }}
            >
              <Text style={{ color: colors.textMuted }}>No routing</Text>
            </Pressable>
            {services.map((service) => (
              <Pressable
                key={service.id}
                style={[
                  styles.pickerOption,
                  targetServiceId === service.id && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => {
                  setTargetServiceId(service.id);
                  setShowServicePicker(false);
                }}
              >
                <Text style={{ color: colors.textPrimary }}>{service.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Modal>
      </Portal>

      {/* Severity Picker Modal */}
      <Portal>
        <Modal
          visible={showSeverityPicker}
          onDismiss={() => setShowSeverityPicker(false)}
          contentContainerStyle={[styles.pickerModal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleMedium" style={[styles.pickerTitle, { color: colors.textPrimary }]}>
            Override Severity
          </Text>
          <ScrollView style={styles.pickerList}>
            {SEVERITY_OPTIONS.map((sev) => (
              <Pressable
                key={sev.value}
                style={[
                  styles.pickerOption,
                  setSeverity === sev.value && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => {
                  setSetSeverity(sev.value);
                  setShowSeverityPicker(false);
                }}
              >
                <Text style={{ color: sev.color || colors.textMuted }}>{sev.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyButton: {
    marginTop: 24,
  },
  ruleCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ruleOrderBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleOrderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ruleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disabledChip: {
    borderRadius: 4,
  },
  conditionsPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionChip: {
    borderRadius: 6,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
    maxHeight: '85%',
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontWeight: '600',
  },
  matchTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  matchTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  conditionsSection: {
    marginBottom: 16,
  },
  conditionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conditionCard: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  conditionInput: {
    marginTop: 0,
  },
  removeConditionButton: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  actionPicker: {
    marginBottom: 12,
  },
  enabledRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  pickerModal: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    maxHeight: '60%',
  },
  pickerTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerOption: {
    padding: 14,
    borderRadius: 8,
  },
  customFieldInput: {
    marginTop: 12,
  },
});
