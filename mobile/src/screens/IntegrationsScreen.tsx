import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
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
  SegmentedButtons,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../context/ThemeContext';
import { useToast } from '../components';
import * as apiService from '../services/apiService';
import type { Integration, IntegrationType, UserProfile } from '../services/apiService';
import * as hapticService from '../services/hapticService';

type NavigationProp = StackNavigationProp<any>;

const INTEGRATION_TYPES: { value: IntegrationType; label: string; icon: string; available: boolean }[] = [
  { value: 'slack', label: 'Slack', icon: 'slack', available: true },
  { value: 'webhook', label: 'Webhook', icon: 'webhook', available: true },
  { value: 'teams', label: 'MS Teams', icon: 'microsoft-teams', available: false },
  { value: 'jira', label: 'Jira', icon: 'jira', available: false },
  { value: 'servicenow', label: 'ServiceNow', icon: 'cloud', available: false },
];

const getIntegrationIcon = (type: IntegrationType): string => {
  const found = INTEGRATION_TYPES.find((t) => t.value === type);
  return found?.icon || 'connection';
};

const getStatusColor = (status: string, colors: any): string => {
  switch (status) {
    case 'active':
      return colors.success;
    case 'pending':
      return colors.warning;
    case 'error':
      return colors.error;
    case 'disabled':
      return colors.textMuted;
    default:
      return colors.textMuted;
  }
};

export default function IntegrationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Form state
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);
  const [integrationName, setIntegrationName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [integrationsData, profile] = await Promise.all([
        apiService.getIntegrations(),
        apiService.getUserProfile(),
      ]);
      setIntegrations(integrationsData);
      setCurrentUser(profile);
    } catch (error: any) {
      console.error('Failed to fetch integrations:', error);
      showToast({ message: 'Failed to load integrations', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleSelectType = (type: IntegrationType) => {
    setSelectedType(type);
    setIntegrationName(`My ${type.charAt(0).toUpperCase() + type.slice(1)} Integration`);
    setShowTypeModal(false);
    setShowCreateModal(true);
  };

  const handleCreateIntegration = async () => {
    if (!integrationName.trim()) {
      showToast({ message: 'Integration name is required', type: 'error' });
      return;
    }

    if (selectedType === 'webhook' && !webhookUrl.trim()) {
      showToast({ message: 'Webhook URL is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const config: Record<string, unknown> = {};
      if (selectedType === 'webhook') {
        config.webhookUrl = webhookUrl.trim();
      }

      const integration = await apiService.createIntegration({
        type: selectedType!,
        name: integrationName.trim(),
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      hapticService.success();
      showToast({ message: 'Integration created', type: 'success' });
      setShowCreateModal(false);
      resetForm();
      fetchData();

      // Navigate to detail for Slack to complete OAuth
      if (selectedType === 'slack') {
        navigation.navigate('IntegrationDetail', { integrationId: integration.id });
      }
    } catch (error: any) {
      console.error('Failed to create integration:', error);
      showToast({ message: error.response?.data?.error || 'Failed to create integration', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIntegration = (integration: Integration) => {
    hapticService.warning();
    Alert.alert(
      'Delete Integration',
      `Are you sure you want to delete "${integration.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteIntegration(integration.id);
              hapticService.success();
              showToast({ message: 'Integration deleted', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: error.response?.data?.error || 'Failed to delete integration', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (integration: Integration) => {
    const newStatus = integration.status === 'active' ? 'disabled' : 'active';
    try {
      await apiService.updateIntegration(integration.id, { status: newStatus });
      hapticService.success();
      showToast({ message: `Integration ${newStatus === 'active' ? 'enabled' : 'disabled'}`, type: 'success' });
      fetchData();
    } catch (error: any) {
      showToast({ message: error.response?.data?.error || 'Failed to update integration', type: 'error' });
    }
  };

  const resetForm = () => {
    setSelectedType(null);
    setIntegrationName('');
    setWebhookUrl('');
  };

  const isAdmin = currentUser?.role === 'admin';

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading integrations...
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
        {integrations.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="connection" size={64} color={colors.textMuted} />
            <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              No Integrations
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
              Connect external tools like Slack or webhooks.
            </Text>
            {isAdmin && (
              <Button
                mode="contained"
                onPress={() => {
                  hapticService.lightTap();
                  setShowTypeModal(true);
                }}
                style={styles.emptyButton}
              >
                Add Integration
              </Button>
            )}
          </View>
        ) : (
          integrations.map((integration) => (
            <Card
              key={integration.id}
              style={[styles.integrationCard, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('IntegrationDetail', { integrationId: integration.id })}
            >
              <Card.Content style={styles.integrationContent}>
                <View style={[styles.typeIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <MaterialCommunityIcons
                    name={getIntegrationIcon(integration.type) as any}
                    size={28}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.integrationInfo}>
                  <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                    {integration.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    {integration.type.charAt(0).toUpperCase() + integration.type.slice(1)}
                    {integration.slackWorkspaceName && ` • ${integration.slackWorkspaceName}`}
                  </Text>
                  <View style={styles.integrationMeta}>
                    <View style={styles.statusBadge}>
                      <View
                        style={[styles.statusDot, { backgroundColor: getStatusColor(integration.status, colors) }]}
                      />
                      <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                        {integration.status}
                      </Text>
                    </View>
                    {integration.lastError && (
                      <Chip
                        compact
                        icon="alert-circle"
                        style={[styles.errorChip, { backgroundColor: `${colors.error}15` }]}
                        textStyle={{ color: colors.error, fontSize: 10 }}
                      >
                        Error
                      </Chip>
                    )}
                  </View>
                </View>
                {isAdmin && (
                  <Menu
                    visible={menuVisible === integration.id}
                    onDismiss={() => setMenuVisible(null)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        size={20}
                        onPress={() => setMenuVisible(integration.id)}
                      />
                    }
                  >
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        navigation.navigate('IntegrationDetail', { integrationId: integration.id });
                      }}
                      title="Configure"
                      leadingIcon="cog"
                    />
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleToggleStatus(integration);
                      }}
                      title={integration.status === 'active' ? 'Disable' : 'Enable'}
                      leadingIcon={integration.status === 'active' ? 'toggle-switch-off' : 'toggle-switch'}
                    />
                    <Divider />
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleDeleteIntegration(integration);
                      }}
                      title="Delete"
                      leadingIcon="delete"
                      titleStyle={{ color: colors.error }}
                    />
                  </Menu>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {isAdmin && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: colors.primary }]}
          color="#fff"
          onPress={() => {
            hapticService.lightTap();
            setShowTypeModal(true);
          }}
        />
      )}

      {/* Select Type Modal */}
      <Portal>
        <Modal
          visible={showTypeModal}
          onDismiss={() => setShowTypeModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Add Integration
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
            Select an integration type:
          </Text>
          {INTEGRATION_TYPES.map((type) => (
            <Card
              key={type.value}
              style={[
                styles.typeCard,
                {
                  backgroundColor: type.available ? colors.background : `${colors.textMuted}10`,
                  opacity: type.available ? 1 : 0.6,
                },
              ]}
              onPress={() => type.available && handleSelectType(type.value)}
            >
              <Card.Content style={styles.typeCardContent}>
                <MaterialCommunityIcons
                  name={type.icon as any}
                  size={32}
                  color={type.available ? colors.primary : colors.textMuted}
                />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text variant="titleMedium" style={{ color: type.available ? colors.textPrimary : colors.textMuted }}>
                    {type.label}
                  </Text>
                  {!type.available && (
                    <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                      Coming soon
                    </Text>
                  )}
                </View>
                {type.available && (
                  <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
                )}
              </Card.Content>
            </Card>
          ))}
          <Button mode="text" onPress={() => setShowTypeModal(false)} style={{ marginTop: 8 }}>
            Cancel
          </Button>
        </Modal>
      </Portal>

      {/* Create Integration Modal */}
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
            Create {selectedType?.charAt(0).toUpperCase()}{selectedType?.slice(1)} Integration
          </Text>
          <TextInput
            label="Integration Name"
            value={integrationName}
            onChangeText={setIntegrationName}
            mode="outlined"
            style={styles.input}
          />
          {selectedType === 'webhook' && (
            <TextInput
              label="Webhook URL"
              value={webhookUrl}
              onChangeText={setWebhookUrl}
              mode="outlined"
              style={styles.input}
              placeholder="https://..."
              autoCapitalize="none"
              keyboardType="url"
            />
          )}
          {selectedType === 'slack' && (
            <View style={[styles.infoBox, { backgroundColor: `${colors.info}15` }]}>
              <MaterialCommunityIcons name="information" size={20} color={colors.info} />
              <Text variant="bodySmall" style={{ color: colors.textSecondary, marginLeft: 8, flex: 1 }}>
                After creating, you'll need to connect to Slack via OAuth.
              </Text>
            </View>
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
            <Button mode="contained" onPress={handleCreateIntegration} loading={saving} disabled={saving}>
              Create
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
  emptyButton: {
    marginTop: 24,
  },
  integrationCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  integrationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  integrationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  integrationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  errorChip: {
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
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  typeCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  typeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  input: {
    marginBottom: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
