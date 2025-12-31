import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import {
  Text,
  Card,
  Portal,
  Modal,
  Button,
  TextInput,
  ActivityIndicator,
  Chip,
  IconButton,
  List,
  Switch,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../context/ThemeContext';
import { useToast } from '../components';
import * as apiService from '../services/apiService';
import type { Integration, IntegrationEvent, Service, UserProfile } from '../services/apiService';
import * as hapticService from '../services/hapticService';

type RouteParams = {
  IntegrationDetail: { integrationId: string };
};

type NavigationProp = StackNavigationProp<any>;

const getStatusColor = (status: string, colors: any): string => {
  switch (status) {
    case 'active':
    case 'success':
      return colors.success;
    case 'pending':
    case 'retrying':
      return colors.warning;
    case 'error':
    case 'failed':
      return colors.error;
    case 'disabled':
      return colors.textMuted;
    default:
      return colors.textMuted;
  }
};

export default function IntegrationDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'IntegrationDetail'>>();
  const navigation = useNavigation<NavigationProp>();
  const { integrationId } = route.params;
  const { colors } = useAppTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [linkedServices, setLinkedServices] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLinkServiceModal, setShowLinkServiceModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Form state
  const [integrationName, setIntegrationName] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [integrationId]);

  const fetchData = async () => {
    try {
      const [integrationData, eventsData, servicesData, linkedServicesData, profile] = await Promise.all([
        apiService.getIntegration(integrationId),
        apiService.getIntegrationEvents(integrationId, 20),
        apiService.getServices(),
        apiService.getIntegrationServices(integrationId),
        apiService.getUserProfile(),
      ]);
      setIntegration(integrationData);
      setEvents(eventsData);
      setAllServices(servicesData);
      setLinkedServices(linkedServicesData);
      setCurrentUser(profile);
      setIntegrationName(integrationData.name);
    } catch (error: any) {
      console.error('Failed to fetch integration:', error);
      showToast({ message: 'Failed to load integration', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [integrationId]);

  const handleUpdateIntegration = async () => {
    if (!integrationName.trim()) {
      showToast({ message: 'Integration name is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.updateIntegration(integrationId, {
        name: integrationName.trim(),
      });
      hapticService.success();
      showToast({ message: 'Integration updated', type: 'success' });
      setShowEditModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Failed to update integration:', error);
      showToast({ message: error.response?.data?.error || 'Failed to update', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!integration) return;
    const newStatus = integration.status === 'active' ? 'disabled' : 'active';

    try {
      await apiService.updateIntegration(integrationId, { status: newStatus });
      hapticService.success();
      showToast({ message: `Integration ${newStatus === 'active' ? 'enabled' : 'disabled'}`, type: 'success' });
      fetchData();
    } catch (error: any) {
      showToast({ message: error.response?.data?.error || 'Failed to update', type: 'error' });
    }
  };

  const handleTestSlack = async () => {
    if (!integration?.slackDefaultChannelId) {
      showToast({ message: 'No default channel configured', type: 'error' });
      return;
    }

    setTesting(true);
    try {
      await apiService.testSlackIntegration(integrationId, integration.slackDefaultChannelId);
      hapticService.success();
      showToast({ message: 'Test message sent!', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.response?.data?.error || 'Test failed', type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const handleLinkService = async () => {
    if (!selectedServiceId) {
      showToast({ message: 'Please select a service', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.linkServiceToIntegration(integrationId, selectedServiceId);
      hapticService.success();
      showToast({ message: 'Service linked', type: 'success' });
      setShowLinkServiceModal(false);
      setSelectedServiceId('');
      fetchData();
    } catch (error: any) {
      console.error('Failed to link service:', error);
      showToast({ message: error.response?.data?.error || 'Failed to link service', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkService = (serviceId: string, serviceName: string) => {
    hapticService.warning();
    Alert.alert(
      'Unlink Service',
      `Remove "${serviceName}" from this integration?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.unlinkServiceFromIntegration(integrationId, serviceId);
              hapticService.success();
              showToast({ message: 'Service unlinked', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: 'Failed to unlink service', type: 'error' });
            }
          },
        },
      ]
    );
  };

  // Available services (not yet linked)
  const availableServices = allServices.filter(
    (s) => !linkedServices.some((ls) => ls.id === s.id)
  );

  const isAdmin = currentUser?.role === 'admin';

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading integration...
        </Text>
      </View>
    );
  }

  if (!integration) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="alert-circle" size={64} color={colors.error} />
        <Text variant="titleMedium" style={{ color: colors.textPrimary, marginTop: 16 }}>
          Integration not found
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
        {/* Header Card */}
        <Card style={[styles.headerCard, { backgroundColor: colors.surface }]}>
          <Card.Content>
            <View style={styles.headerRow}>
              <View style={[styles.typeIcon, { backgroundColor: `${colors.primary}15` }]}>
                <MaterialCommunityIcons
                  name={integration.type === 'slack' ? 'slack' : 'webhook'}
                  size={32}
                  color={colors.primary}
                />
              </View>
              <View style={styles.headerInfo}>
                <Text variant="titleLarge" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                  {integration.name}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                  {integration.type.charAt(0).toUpperCase() + integration.type.slice(1)}
                </Text>
              </View>
              {isAdmin && (
                <IconButton icon="pencil" size={20} onPress={() => setShowEditModal(true)} />
              )}
            </View>

            <View style={styles.statusRow}>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(integration.status, colors) }]} />
                <Text variant="bodyMedium" style={{ color: colors.textPrimary }}>
                  {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
                </Text>
              </View>
              {isAdmin && (
                <Switch
                  value={integration.status === 'active'}
                  onValueChange={handleToggleStatus}
                  color={colors.primary}
                />
              )}
            </View>

            {integration.lastError && (
              <View style={[styles.errorBox, { backgroundColor: `${colors.error}15` }]}>
                <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text variant="labelMedium" style={{ color: colors.error }}>
                    Last Error
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                    {integration.lastError}
                  </Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Slack-specific section */}
        {integration.type === 'slack' && (
          <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <Card.Content>
              <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Slack Configuration
              </Text>

              {integration.slackWorkspaceName ? (
                <>
                  <List.Item
                    title="Workspace"
                    description={integration.slackWorkspaceName}
                    left={(props) => <List.Icon {...props} icon="domain" />}
                  />
                  {integration.slackDefaultChannelId && (
                    <List.Item
                      title="Default Channel"
                      description={integration.slackDefaultChannelId}
                      left={(props) => <List.Icon {...props} icon="pound" />}
                    />
                  )}
                  {isAdmin && (
                    <Button
                      mode="outlined"
                      icon="send"
                      onPress={handleTestSlack}
                      loading={testing}
                      disabled={testing}
                      style={styles.testButton}
                    >
                      Send Test Message
                    </Button>
                  )}
                </>
              ) : (
                <View style={styles.oauthPrompt}>
                  <MaterialCommunityIcons name="link-variant" size={32} color={colors.textMuted} />
                  <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginTop: 8 }}>
                    Slack not connected
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
                    Connect to Slack using OAuth from the web app
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Webhook-specific section */}
        {integration.type === 'webhook' && integration.webhookUrl && (
          <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <Card.Content>
              <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Webhook Configuration
              </Text>
              <List.Item
                title="Webhook URL"
                description={integration.webhookUrl}
                descriptionNumberOfLines={2}
                left={(props) => <List.Icon {...props} icon="link" />}
              />
            </Card.Content>
          </Card>
        )}

        {/* Linked Services */}
        <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                Linked Services
              </Text>
              {isAdmin && availableServices.length > 0 && (
                <Button
                  mode="text"
                  compact
                  onPress={() => setShowLinkServiceModal(true)}
                >
                  Link Service
                </Button>
              )}
            </View>

            {linkedServices.length === 0 ? (
              <View style={styles.emptyServices}>
                <MaterialCommunityIcons name="link-variant-off" size={32} color={colors.textMuted} />
                <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginTop: 8 }}>
                  No services linked
                </Text>
              </View>
            ) : (
              linkedServices.map((service) => (
                <List.Item
                  key={service.id}
                  title={service.name}
                  description={service.status}
                  left={(props) => <List.Icon {...props} icon="cog" />}
                  right={(props) =>
                    isAdmin && (
                      <IconButton
                        icon="link-off"
                        size={20}
                        onPress={() => handleUnlinkService(service.id, service.name)}
                      />
                    )
                  }
                />
              ))
            )}
          </Card.Content>
        </Card>

        {/* Recent Activity */}
        <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
          <Card.Content>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Recent Activity
            </Text>

            {events.length === 0 ? (
              <View style={styles.emptyEvents}>
                <MaterialCommunityIcons name="history" size={32} color={colors.textMuted} />
                <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginTop: 8 }}>
                  No recent activity
                </Text>
              </View>
            ) : (
              events.map((event) => (
                <View key={event.id} style={styles.eventItem}>
                  <View style={styles.eventRow}>
                    <MaterialCommunityIcons
                      name={event.direction === 'inbound' ? 'arrow-down' : 'arrow-up'}
                      size={16}
                      color={colors.textMuted}
                    />
                    <Text variant="bodyMedium" style={{ color: colors.textPrimary, marginLeft: 8, flex: 1 }}>
                      {event.eventType}
                    </Text>
                    <Chip
                      compact
                      style={{
                        backgroundColor: `${getStatusColor(event.status, colors)}15`,
                      }}
                      textStyle={{ color: getStatusColor(event.status, colors), fontSize: 10 }}
                    >
                      {event.status}
                    </Chip>
                  </View>
                  <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 4 }}>
                    {new Date(event.createdAt).toLocaleString()}
                  </Text>
                  {event.errorMessage && (
                    <Text variant="bodySmall" style={{ color: colors.error, marginTop: 2 }}>
                      {event.errorMessage}
                    </Text>
                  )}
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Edit Modal */}
      <Portal>
        <Modal
          visible={showEditModal}
          onDismiss={() => setShowEditModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Edit Integration
          </Text>
          <TextInput
            label="Integration Name"
            value={integrationName}
            onChangeText={setIntegrationName}
            mode="outlined"
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleUpdateIntegration} loading={saving} disabled={saving}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Link Service Modal */}
      <Portal>
        <Modal
          visible={showLinkServiceModal}
          onDismiss={() => {
            setShowLinkServiceModal(false);
            setSelectedServiceId('');
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Link Service
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
            Select a service to link to this integration:
          </Text>
          <ScrollView style={styles.serviceList}>
            {availableServices.map((service) => (
              <Card
                key={service.id}
                style={[
                  styles.serviceCard,
                  {
                    backgroundColor: selectedServiceId === service.id ? `${colors.primary}15` : colors.background,
                    borderColor: selectedServiceId === service.id ? colors.primary : 'transparent',
                    borderWidth: selectedServiceId === service.id ? 1 : 0,
                  },
                ]}
                onPress={() => setSelectedServiceId(service.id)}
              >
                <Card.Content style={styles.serviceCardContent}>
                  <MaterialCommunityIcons name="cog" size={24} color={colors.primary} />
                  <Text variant="bodyMedium" style={{ color: colors.textPrimary, marginLeft: 12, flex: 1 }}>
                    {service.name}
                  </Text>
                  {selectedServiceId === service.id && (
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.primary} />
                  )}
                </Card.Content>
              </Card>
            ))}
          </ScrollView>
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowLinkServiceModal(false);
                setSelectedServiceId('');
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleLinkService}
              loading={saving}
              disabled={saving || !selectedServiceId}
            >
              Link
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
    paddingBottom: 32,
  },
  headerCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  testButton: {
    marginTop: 12,
  },
  oauthPrompt: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyServices: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyEvents: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  eventItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  serviceList: {
    maxHeight: 250,
  },
  serviceCard: {
    marginBottom: 8,
    borderRadius: 8,
  },
  serviceCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
});
