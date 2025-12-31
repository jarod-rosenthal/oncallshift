import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Pressable,
  Clipboard,
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
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../context/ThemeContext';
import { colors as themeColors } from '../theme';
import { useToast } from '../components';
import * as apiService from '../services/apiService';
import type { Service, EscalationPolicy } from '../services/apiService';
import * as hapticService from '../services/hapticService';

export default function ManageServicesScreen() {
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const navigation = useNavigation<StackNavigationProp<any>>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Form state
  const [serviceName, setServiceName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [servicesData, policiesData] = await Promise.all([
        apiService.getServices(),
        apiService.getEscalationPolicies().catch(() => []),
      ]);
      setServices(servicesData);
      setPolicies(policiesData);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      showToast({ message: 'Failed to load services', type: 'error' });
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
    if (!serviceName.trim()) {
      showToast({ message: 'Service name is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.createService({
        name: serviceName.trim(),
        description: serviceDescription.trim() || undefined,
        escalationPolicyId: selectedPolicyId || undefined,
      });
      hapticService.success();
      showToast({ message: 'Service created', type: 'success' });
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Failed to create service:', error);
      showToast({ message: error.message || 'Failed to create service', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedService || !serviceName.trim()) return;

    setSaving(true);
    try {
      await apiService.updateService(selectedService.id, {
        name: serviceName.trim(),
        description: serviceDescription.trim() || undefined,
        escalationPolicyId: selectedPolicyId || undefined,
        status: alertsEnabled ? 'active' : 'inactive',
      });
      hapticService.success();
      showToast({ message: 'Service updated', type: 'success' });
      setShowEditModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Failed to update service:', error);
      showToast({ message: error.message || 'Failed to update service', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (service: Service) => {
    hapticService.warning();
    Alert.alert(
      'Delete Service',
      `Are you sure you want to delete "${service.name}"? All associated incidents will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteService(service.id);
              hapticService.success();
              showToast({ message: 'Service deleted', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: error.message || 'Failed to delete service', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleRegenerateApiKey = async () => {
    if (!selectedService) return;

    setSaving(true);
    try {
      const result = await apiService.regenerateServiceApiKey(selectedService.id);
      setApiKey(result.apiKey);
      hapticService.success();
      showToast({ message: 'API key regenerated', type: 'success' });
    } catch (error: any) {
      console.error('Failed to regenerate API key:', error);
      showToast({ message: error.message || 'Failed to regenerate API key', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const copyApiKey = () => {
    if (apiKey) {
      Clipboard.setString(apiKey);
      hapticService.lightTap();
      showToast({ message: 'API key copied to clipboard', type: 'success' });
    }
  };

  const openEditModal = (service: Service) => {
    setSelectedService(service);
    setServiceName(service.name);
    setServiceDescription(service.description || '');
    setSelectedPolicyId((service as any).escalationPolicyId || '');
    setAlertsEnabled((service as any).status !== 'disabled');
    setShowEditModal(true);
    setMenuVisible(null);
  };

  const openApiKeyModal = (service: Service) => {
    setSelectedService(service);
    setApiKey(null);
    setShowApiKeyModal(true);
    setMenuVisible(null);
  };

  const resetForm = () => {
    setServiceName('');
    setServiceDescription('');
    setSelectedPolicyId('');
    setAlertsEnabled(true);
    setSelectedService(null);
  };

  const getStatusColor = (service: Service) => {
    const status = (service as any).status || 'active';
    switch (status) {
      case 'active':
        return colors.success;
      case 'disabled':
        return colors.textMuted;
      case 'warning':
        return colors.warning;
      case 'critical':
        return colors.error;
      default:
        return colors.textMuted;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading services...
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
        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="server-security" size={64} color={colors.textMuted} />
            <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              No Services
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
              Create your first service to start receiving alerts.
            </Text>
          </View>
        ) : (
          services.map((service) => (
            <Card key={service.id} style={[styles.serviceCard, { backgroundColor: colors.surface }]}>
              <Card.Content>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceInfo}>
                    <View style={styles.serviceTitleRow}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(service) }]} />
                      <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                        {service.name}
                      </Text>
                    </View>
                    {service.description && (
                      <Text variant="bodySmall" style={{ color: colors.textSecondary, marginTop: 4 }}>
                        {service.description}
                      </Text>
                    )}
                    <View style={styles.serviceMeta}>
                      {(service as any).escalationPolicyName && (
                        <Chip
                          compact
                          icon="arrow-decision"
                          style={[styles.metaChip, { backgroundColor: `${colors.primary}15` }]}
                          textStyle={{ color: colors.primary, fontSize: 11 }}
                        >
                          {(service as any).escalationPolicyName}
                        </Chip>
                      )}
                      {(service as any).incidentCount !== undefined && (
                        <Chip
                          compact
                          icon="alert-circle"
                          style={[
                            styles.metaChip,
                            { backgroundColor: (service as any).incidentCount > 0 ? `${colors.error}15` : `${colors.success}15` },
                          ]}
                          textStyle={{
                            color: (service as any).incidentCount > 0 ? colors.error : colors.success,
                            fontSize: 11,
                          }}
                        >
                          {(service as any).incidentCount} open
                        </Chip>
                      )}
                    </View>
                  </View>
                  <Menu
                    visible={menuVisible === service.id}
                    onDismiss={() => setMenuVisible(null)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        size={20}
                        onPress={() => setMenuVisible(service.id)}
                      />
                    }
                  >
                    <Menu.Item
                      onPress={() => openEditModal(service)}
                      title="Edit"
                      leadingIcon="pencil"
                    />
                    <Menu.Item
                      onPress={() => openApiKeyModal(service)}
                      title="API Key"
                      leadingIcon="key"
                    />
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        navigation.navigate('ServiceSettings', {
                          serviceId: service.id,
                          serviceName: service.name,
                        });
                      }}
                      title="Alert Grouping"
                      leadingIcon="group"
                    />
                    <Divider />
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleDelete(service);
                      }}
                      title="Delete"
                      leadingIcon="delete"
                      titleStyle={{ color: colors.error }}
                    />
                  </Menu>
                </View>

                {/* Integration Info */}
                {(service as any).integrationKey && (
                  <View style={[styles.integrationInfo, { borderTopColor: colors.border }]}>
                    <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                      INTEGRATION KEY
                    </Text>
                    <View style={styles.integrationKey}>
                      <Text
                        variant="bodySmall"
                        style={[styles.keyText, { color: colors.textSecondary, backgroundColor: colors.surfaceVariant }]}
                        numberOfLines={1}
                      >
                        {(service as any).integrationKey}
                      </Text>
                      <IconButton
                        icon="content-copy"
                        size={16}
                        onPress={() => {
                          Clipboard.setString((service as any).integrationKey);
                          hapticService.lightTap();
                          showToast({ message: 'Integration key copied', type: 'success' });
                        }}
                      />
                    </View>
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
            Create Service
          </Text>
          <TextInput
            label="Service Name"
            value={serviceName}
            onChangeText={setServiceName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Description (optional)"
            value={serviceDescription}
            onChangeText={setServiceDescription}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.input}
          />
          {policies.length > 0 && (
            <>
              <Text variant="labelMedium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                Escalation Policy
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.policyPicker}>
                <Chip
                  selected={selectedPolicyId === ''}
                  onPress={() => setSelectedPolicyId('')}
                  style={styles.policyChip}
                >
                  None
                </Chip>
                {policies.map((policy) => (
                  <Chip
                    key={policy.id}
                    selected={selectedPolicyId === policy.id}
                    onPress={() => setSelectedPolicyId(policy.id)}
                    style={styles.policyChip}
                  >
                    {policy.name}
                  </Chip>
                ))}
              </ScrollView>
            </>
          )}
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
            Edit Service
          </Text>
          <TextInput
            label="Service Name"
            value={serviceName}
            onChangeText={setServiceName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Description (optional)"
            value={serviceDescription}
            onChangeText={setServiceDescription}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.input}
          />
          {policies.length > 0 && (
            <>
              <Text variant="labelMedium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                Escalation Policy
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.policyPicker}>
                <Chip
                  selected={selectedPolicyId === ''}
                  onPress={() => setSelectedPolicyId('')}
                  style={styles.policyChip}
                >
                  None
                </Chip>
                {policies.map((policy) => (
                  <Chip
                    key={policy.id}
                    selected={selectedPolicyId === policy.id}
                    onPress={() => setSelectedPolicyId(policy.id)}
                    style={styles.policyChip}
                  >
                    {policy.name}
                  </Chip>
                ))}
              </ScrollView>
            </>
          )}
          <View style={styles.switchRow}>
            <Text variant="bodyMedium" style={{ color: colors.textPrimary }}>
              Alerts Enabled
            </Text>
            <Switch value={alertsEnabled} onValueChange={setAlertsEnabled} />
          </View>
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

      {/* API Key Modal */}
      <Portal>
        <Modal
          visible={showApiKeyModal}
          onDismiss={() => {
            setShowApiKeyModal(false);
            setApiKey(null);
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            API Key
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
            {selectedService?.name}
          </Text>

          {apiKey ? (
            <View style={styles.apiKeyContainer}>
              <Text variant="labelSmall" style={{ color: colors.success, marginBottom: 8 }}>
                NEW API KEY (save this now - it won't be shown again)
              </Text>
              <Pressable onPress={copyApiKey}>
                <Text
                  variant="bodyMedium"
                  style={[styles.apiKeyText, { backgroundColor: colors.surfaceVariant, color: colors.textPrimary }]}
                  selectable
                >
                  {apiKey}
                </Text>
              </Pressable>
              <Button
                mode="outlined"
                icon="content-copy"
                onPress={copyApiKey}
                style={styles.copyButton}
              >
                Copy to Clipboard
              </Button>
            </View>
          ) : (
            <View style={styles.regenerateContainer}>
              <MaterialCommunityIcons name="alert" size={24} color={colors.warning} />
              <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                Regenerating the API key will invalidate the current key. Any integrations using it will stop working.
              </Text>
              <Button
                mode="contained"
                onPress={handleRegenerateApiKey}
                loading={saving}
                disabled={saving}
                style={styles.regenerateButton}
                buttonColor={colors.warning}
              >
                Regenerate API Key
              </Button>
            </View>
          )}

          <Button
            mode="text"
            onPress={() => {
              setShowApiKeyModal(false);
              setApiKey(null);
            }}
            style={styles.closeButton}
          >
            Close
          </Button>
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
  serviceCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  serviceMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  metaChip: {
    borderRadius: 6,
  },
  integrationInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  integrationKey: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  keyText: {
    flex: 1,
    fontFamily: 'monospace',
    padding: 8,
    borderRadius: 4,
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  policyPicker: {
    marginBottom: 16,
  },
  policyChip: {
    marginRight: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  apiKeyContainer: {
    marginBottom: 16,
  },
  apiKeyText: {
    padding: 12,
    borderRadius: 8,
    fontFamily: 'monospace',
  },
  copyButton: {
    marginTop: 12,
  },
  regenerateContainer: {
    alignItems: 'center',
    padding: 16,
  },
  regenerateButton: {
    marginTop: 16,
  },
  closeButton: {
    marginTop: 8,
  },
});
