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
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import { useToast } from '../components';
import * as apiService from '../services/apiService';
import type { EscalationPolicy, EscalationStep, EscalationTarget } from '../services/apiService';
import * as hapticService from '../services/hapticService';

export default function EscalationPoliciesScreen() {
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStepModal, setShowStepModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<EscalationPolicy | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [policyName, setPolicyName] = useState('');
  const [policyDescription, setPolicyDescription] = useState('');
  const [stepDelay, setStepDelay] = useState('5');
  const [stepTargetType, setStepTargetType] = useState<'user' | 'schedule'>('user');
  const [stepTargetId, setStepTargetId] = useState('');

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const data = await apiService.getEscalationPolicies();
      setPolicies(data);
    } catch (error: any) {
      showToast({ message: 'Failed to load escalation policies', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPolicies();
  }, []);

  const handleCreate = async () => {
    if (!policyName.trim()) {
      showToast({ message: 'Policy name is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.createEscalationPolicy({
        name: policyName.trim(),
        description: policyDescription.trim() || undefined,
      });
      hapticService.success();
      showToast({ message: 'Escalation policy created', type: 'success' });
      setShowCreateModal(false);
      resetForm();
      fetchPolicies();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to create policy', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedPolicy || !policyName.trim()) return;

    setSaving(true);
    try {
      await apiService.updateEscalationPolicy(selectedPolicy.id, {
        name: policyName.trim(),
        description: policyDescription.trim() || undefined,
      });
      hapticService.success();
      showToast({ message: 'Escalation policy updated', type: 'success' });
      setShowEditModal(false);
      resetForm();
      fetchPolicies();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to update policy', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (policy: EscalationPolicy) => {
    hapticService.warning();
    Alert.alert(
      'Delete Escalation Policy',
      `Are you sure you want to delete "${policy.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteEscalationPolicy(policy.id);
              hapticService.success();
              showToast({ message: 'Escalation policy deleted', type: 'success' });
              fetchPolicies();
            } catch (error: any) {
              showToast({ message: error.message || 'Failed to delete policy', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleAddStep = async () => {
    if (!selectedPolicy || !stepTargetId.trim()) {
      showToast({ message: 'Target is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.addEscalationStep(selectedPolicy.id, {
        delayMinutes: parseInt(stepDelay, 10) || 5,
        targetType: stepTargetType,
        targetId: stepTargetId.trim(),
      });
      hapticService.success();
      showToast({ message: 'Escalation rule added', type: 'success' });
      setShowStepModal(false);
      resetStepForm();
      fetchPolicies();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to add rule', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStep = async (policy: EscalationPolicy, step: EscalationStep) => {
    hapticService.warning();
    Alert.alert(
      'Remove Rule',
      `Remove rule ${step.escalationLevel || step.stepOrder || 1} from "${policy.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteEscalationStep(policy.id, step.id);
              hapticService.success();
              showToast({ message: 'Rule removed', type: 'success' });
              fetchPolicies();
            } catch (error: any) {
              showToast({ message: error.message || 'Failed to remove rule', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const openEditModal = (policy: EscalationPolicy) => {
    setSelectedPolicy(policy);
    setPolicyName(policy.name);
    setPolicyDescription(policy.description || '');
    setShowEditModal(true);
    setMenuVisible(null);
  };

  const openStepModal = (policy: EscalationPolicy) => {
    setSelectedPolicy(policy);
    setShowStepModal(true);
    setMenuVisible(null);
  };

  const resetForm = () => {
    setPolicyName('');
    setPolicyDescription('');
    setSelectedPolicy(null);
  };

  const resetStepForm = () => {
    setStepDelay('5');
    setStepTargetType('user');
    setStepTargetId('');
  };

  // Helper to get step target description for display
  const getStepTargetDescription = (step: EscalationStep): string => {
    // Check for new multi-target format first
    if (step.targets && step.targets.length > 0) {
      return step.targets.map(target => {
        if (target.targetType === 'user') {
          return target.user?.fullName || 'Unknown User';
        } else {
          return target.schedule?.name || 'Unknown Schedule';
        }
      }).join(', ');
    }

    // Use resolved user info from backend
    if (step.targetType === 'schedule') {
      if (step.resolvedOncallUser) {
        return `${step.resolvedOncallUser.fullName} (on-call)`;
      }
      if (step.schedule?.name) return step.schedule.name;
    } else {
      // Use resolved users if available
      if (step.resolvedUsers && step.resolvedUsers.length > 0) {
        return step.resolvedUsers.map(u => u.fullName).join(', ');
      }
    }

    // Fall back to old format
    if (step.targetName) return step.targetName;
    return step.targetId;
  };

  // Helper to get delay in minutes (handle both old delayMinutes and new timeoutSeconds)
  const getStepDelayMinutes = (step: EscalationStep): number => {
    if (step.delayMinutes) return step.delayMinutes;
    if (step.timeoutSeconds) return Math.round(step.timeoutSeconds / 60);
    return 0;
  };

  // Helper to get step level (handle both old escalationLevel and new stepOrder)
  const getStepLevel = (step: EscalationStep): number => {
    return step.escalationLevel || step.stepOrder || 1;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading policies...
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
        {policies.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="arrow-decision" size={64} color={colors.textMuted} />
            <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              No Escalation Policies
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
              Create your first escalation policy to define how alerts are routed.
            </Text>
          </View>
        ) : (
          policies.map((policy) => (
            <Card key={policy.id} style={[styles.policyCard, { backgroundColor: colors.surface }]}>
              <Card.Content>
                <View style={styles.policyHeader}>
                  <View style={styles.policyInfo}>
                    <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                      {policy.name}
                    </Text>
                    {policy.description && (
                      <Text variant="bodySmall" style={{ color: colors.textSecondary, marginTop: 2 }}>
                        {policy.description}
                      </Text>
                    )}
                    <View style={styles.policyMeta}>
                      <Chip
                        compact
                        style={[styles.metaChip, { backgroundColor: `${colors.primary}15` }]}
                        textStyle={{ color: colors.primary, fontSize: 11 }}
                      >
                        {policy.steps?.length || 0} {policy.steps?.length === 1 ? 'rule' : 'rules'}
                      </Chip>
                      {policy.repeatEnabled && (
                        <Chip
                          compact
                          icon="repeat"
                          style={[styles.metaChip, { backgroundColor: `${colors.info || colors.primary}15` }]}
                          textStyle={{ color: colors.info || colors.primary, fontSize: 11 }}
                        >
                          {policy.repeatCount === 0 ? 'Repeats' : `${policy.repeatCount}x`}
                        </Chip>
                      )}
                      {policy.servicesCount !== undefined && policy.servicesCount > 0 && (
                        <Chip
                          compact
                          style={[styles.metaChip, { backgroundColor: `${colors.success}15` }]}
                          textStyle={{ color: colors.success, fontSize: 11 }}
                        >
                          {policy.servicesCount} services
                        </Chip>
                      )}
                    </View>
                  </View>
                  <Menu
                    visible={menuVisible === policy.id}
                    onDismiss={() => setMenuVisible(null)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        size={20}
                        onPress={() => setMenuVisible(policy.id)}
                      />
                    }
                  >
                    <Menu.Item
                      onPress={() => openEditModal(policy)}
                      title="Edit"
                      leadingIcon="pencil"
                    />
                    <Menu.Item
                      onPress={() => openStepModal(policy)}
                      title="Add Rule"
                      leadingIcon="plus"
                    />
                    <Divider />
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleDelete(policy);
                      }}
                      title="Delete"
                      leadingIcon="delete"
                      titleStyle={{ color: colors.error }}
                    />
                  </Menu>
                </View>

                {/* Escalation Steps */}
                {policy.steps && policy.steps.length > 0 && (
                  <View style={styles.stepsContainer}>
                    <Text variant="labelMedium" style={[styles.stepsLabel, { color: colors.textMuted }]}>
                      ESCALATION PATH
                    </Text>
                    {policy.steps
                      .sort((a, b) => getStepLevel(a) - getStepLevel(b))
                      .map((step, index) => (
                        <View key={step.id} style={styles.stepRow}>
                          <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                            <Text style={styles.stepNumberText}>{getStepLevel(step)}</Text>
                          </View>
                          <View style={styles.stepInfo}>
                            <Text variant="bodyMedium" style={{ color: colors.textPrimary }}>
                              {getStepTargetDescription(step)}
                            </Text>
                            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                              {step.targets && step.targets.length > 1
                                ? `${step.targets.length} targets`
                                : step.targetType === 'user' ? 'User' : 'Schedule'
                              } • {getStepDelayMinutes(step)}min delay
                            </Text>
                          </View>
                          <IconButton
                            icon="close"
                            size={16}
                            onPress={() => handleRemoveStep(policy, step)}
                          />
                          {index < (policy.steps?.length || 0) - 1 && (
                            <View style={[styles.stepConnector, { backgroundColor: colors.border }]} />
                          )}
                        </View>
                      ))}
                  </View>
                )}
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

      {/* Create Modal */}
      <Portal>
        <Modal
          visible={showCreateModal}
          onDismiss={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Create Escalation Policy
          </Text>
          <TextInput
            label="Policy Name"
            value={policyName}
            onChangeText={setPolicyName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Description (optional)"
            value={policyDescription}
            onChangeText={setPolicyDescription}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={handleCreate} loading={saving} disabled={saving}>
              Create
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Edit Modal */}
      <Portal>
        <Modal
          visible={showEditModal}
          onDismiss={() => {
            setShowEditModal(false);
            resetForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Edit Escalation Policy
          </Text>
          <TextInput
            label="Policy Name"
            value={policyName}
            onChangeText={setPolicyName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Description (optional)"
            value={policyDescription}
            onChangeText={setPolicyDescription}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowEditModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={handleUpdate} loading={saving} disabled={saving}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Add Step Modal */}
      <Portal>
        <Modal
          visible={showStepModal}
          onDismiss={() => {
            setShowStepModal(false);
            resetStepForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Add Escalation Rule
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
            Adding to: {selectedPolicy?.name}
          </Text>
          <TextInput
            label="Wait before next rule (minutes)"
            value={stepDelay}
            onChangeText={setStepDelay}
            mode="outlined"
            keyboardType="number-pad"
            style={styles.input}
          />
          <View style={styles.targetTypeRow}>
            <Pressable
              style={[
                styles.targetTypeButton,
                { borderColor: stepTargetType === 'user' ? colors.primary : colors.border },
                stepTargetType === 'user' && { backgroundColor: `${colors.primary}10` },
              ]}
              onPress={() => setStepTargetType('user')}
            >
              <MaterialCommunityIcons
                name="account"
                size={20}
                color={stepTargetType === 'user' ? colors.primary : colors.textSecondary}
              />
              <Text style={{ color: stepTargetType === 'user' ? colors.primary : colors.textSecondary }}>
                User
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.targetTypeButton,
                { borderColor: stepTargetType === 'schedule' ? colors.primary : colors.border },
                stepTargetType === 'schedule' && { backgroundColor: `${colors.primary}10` },
              ]}
              onPress={() => setStepTargetType('schedule')}
            >
              <MaterialCommunityIcons
                name="calendar-clock"
                size={20}
                color={stepTargetType === 'schedule' ? colors.primary : colors.textSecondary}
              />
              <Text style={{ color: stepTargetType === 'schedule' ? colors.primary : colors.textSecondary }}>
                Schedule
              </Text>
            </Pressable>
          </View>
          <TextInput
            label={stepTargetType === 'user' ? 'User ID or Email' : 'Schedule ID'}
            value={stepTargetId}
            onChangeText={setStepTargetId}
            mode="outlined"
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowStepModal(false);
                resetStepForm();
              }}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={handleAddStep} loading={saving} disabled={saving}>
              Add Rule
            </Button>
          </View>
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
  },
  policyCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  policyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  policyInfo: {
    flex: 1,
  },
  policyMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metaChip: {
    borderRadius: 6,
  },
  stepsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  stepsLabel: {
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  stepInfo: {
    flex: 1,
    marginLeft: 12,
  },
  stepConnector: {
    position: 'absolute',
    left: 11,
    top: 28,
    width: 2,
    height: 20,
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
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  targetTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  targetTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
