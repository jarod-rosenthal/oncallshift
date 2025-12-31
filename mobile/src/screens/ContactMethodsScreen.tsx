import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Pressable,
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
  List,
  Switch,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import { useToast } from '../components';
import * as apiService from '../services/apiService';
import type {
  UserContactMethod,
  ContactMethodType,
  UserNotificationRule,
  NotificationUrgency,
} from '../services/apiService';
import * as hapticService from '../services/hapticService';

const CONTACT_TYPES: { value: ContactMethodType; label: string; icon: string }[] = [
  { value: 'email', label: 'Email', icon: 'email' },
  { value: 'sms', label: 'SMS', icon: 'message-text' },
  { value: 'phone', label: 'Phone', icon: 'phone' },
  { value: 'push', label: 'Push', icon: 'bell' },
];

const URGENCY_OPTIONS: { value: NotificationUrgency; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'any', label: 'Any' },
];

const getTypeIcon = (type: ContactMethodType): string => {
  return CONTACT_TYPES.find(t => t.value === type)?.icon || 'help';
};

export default function ContactMethodsScreen() {
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contactMethods, setContactMethods] = useState<UserContactMethod[]>([]);
  const [notificationRules, setNotificationRules] = useState<UserNotificationRule[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<UserContactMethod | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'methods' | 'rules'>('methods');

  // Add form state
  const [newType, setNewType] = useState<ContactMethodType>('email');
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');

  // Verify form state
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  // Rule form state
  const [ruleContactMethodId, setRuleContactMethodId] = useState('');
  const [ruleUrgency, setRuleUrgency] = useState<NotificationUrgency>('any');
  const [ruleDelayMinutes, setRuleDelayMinutes] = useState('0');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [methodsData, rulesData] = await Promise.all([
        apiService.getContactMethods(),
        apiService.getNotificationRules(),
      ]);
      setContactMethods(methodsData);
      setNotificationRules(rulesData);
    } catch (error: any) {
      console.error('Failed to fetch contact methods:', error);
      showToast({ message: 'Failed to load contact methods', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleAddContactMethod = async () => {
    if (!newAddress.trim()) {
      showToast({ message: 'Address is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.addContactMethod({
        type: newType,
        address: newAddress.trim(),
        label: newLabel.trim() || undefined,
      });
      hapticService.success();
      showToast({ message: 'Contact method added', type: 'success' });
      setShowAddModal(false);
      resetAddForm();
      fetchData();
    } catch (error: any) {
      console.error('Failed to add contact method:', error);
      showToast({ message: error.response?.data?.error || 'Failed to add contact method', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerification = async () => {
    if (!selectedMethod) return;

    setSaving(true);
    try {
      await apiService.sendVerificationCode(selectedMethod.id);
      hapticService.success();
      showToast({ message: 'Verification code sent', type: 'success' });
      setCodeSent(true);
    } catch (error: any) {
      console.error('Failed to send verification:', error);
      showToast({ message: error.response?.data?.error || 'Failed to send code', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!selectedMethod || !verificationCode.trim()) return;

    setSaving(true);
    try {
      const result = await apiService.verifyContactMethod(selectedMethod.id, verificationCode.trim());
      if (result.verified) {
        hapticService.success();
        showToast({ message: 'Contact method verified', type: 'success' });
        setShowVerifyModal(false);
        resetVerifyForm();
        fetchData();
      } else {
        showToast({ message: 'Invalid verification code', type: 'error' });
      }
    } catch (error: any) {
      console.error('Failed to verify:', error);
      showToast({ message: error.response?.data?.error || 'Failed to verify', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (method: UserContactMethod) => {
    try {
      await apiService.updateContactMethod(method.id, { isDefault: true });
      hapticService.lightTap();
      showToast({ message: 'Set as default', type: 'success' });
      fetchData();
    } catch (error: any) {
      showToast({ message: 'Failed to update', type: 'error' });
    }
  };

  const handleDeleteMethod = (method: UserContactMethod) => {
    hapticService.warning();
    Alert.alert(
      'Delete Contact Method',
      `Are you sure you want to delete this ${method.type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteContactMethod(method.id);
              hapticService.success();
              showToast({ message: 'Contact method deleted', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: error.response?.data?.error || 'Failed to delete', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleCreateRule = async () => {
    if (!ruleContactMethodId) {
      showToast({ message: 'Select a contact method', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.createNotificationRule({
        contactMethodId: ruleContactMethodId,
        urgency: ruleUrgency,
        startDelayMinutes: parseInt(ruleDelayMinutes, 10) || 0,
      });
      hapticService.success();
      showToast({ message: 'Notification rule created', type: 'success' });
      setShowRuleModal(false);
      resetRuleForm();
      fetchData();
    } catch (error: any) {
      console.error('Failed to create rule:', error);
      showToast({ message: error.response?.data?.error || 'Failed to create rule', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRule = async (rule: UserNotificationRule) => {
    try {
      await apiService.updateNotificationRule(rule.id, { enabled: !rule.enabled });
      hapticService.lightTap();
      fetchData();
    } catch (error: any) {
      showToast({ message: 'Failed to update rule', type: 'error' });
    }
  };

  const handleDeleteRule = (rule: UserNotificationRule) => {
    hapticService.warning();
    Alert.alert(
      'Delete Notification Rule',
      'Are you sure you want to delete this rule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteNotificationRule(rule.id);
              hapticService.success();
              showToast({ message: 'Rule deleted', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: 'Failed to delete rule', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const openVerifyModal = (method: UserContactMethod) => {
    setSelectedMethod(method);
    setShowVerifyModal(true);
    setMenuVisible(null);
  };

  const resetAddForm = () => {
    setNewType('email');
    setNewAddress('');
    setNewLabel('');
  };

  const resetVerifyForm = () => {
    setSelectedMethod(null);
    setVerificationCode('');
    setCodeSent(false);
  };

  const resetRuleForm = () => {
    setRuleContactMethodId('');
    setRuleUrgency('any');
    setRuleDelayMinutes('0');
  };

  const getAddressPlaceholder = (type: ContactMethodType): string => {
    switch (type) {
      case 'email': return 'email@example.com';
      case 'sms': return '+1234567890';
      case 'phone': return '+1234567890';
      case 'push': return 'Device token';
      default: return '';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading contact methods...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'methods' | 'rules')}
          buttons={[
            { value: 'methods', label: `Contact Methods (${contactMethods.length})` },
            { value: 'rules', label: `Rules (${notificationRules.length})` },
          ]}
          style={styles.tabs}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {activeTab === 'methods' ? (
          <>
            {contactMethods.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="card-account-phone" size={64} color={colors.textMuted} />
                <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                  No Contact Methods
                </Text>
                <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
                  Add contact methods to receive notifications.
                </Text>
                <Button
                  mode="contained"
                  onPress={() => {
                    hapticService.lightTap();
                    setShowAddModal(true);
                  }}
                  style={styles.emptyButton}
                >
                  Add Contact Method
                </Button>
              </View>
            ) : (
              contactMethods.map((method) => (
                <Card key={method.id} style={[styles.methodCard, { backgroundColor: colors.surface }]}>
                  <Card.Content style={styles.methodContent}>
                    <View style={[styles.methodIcon, { backgroundColor: `${colors.primary}15` }]}>
                      <MaterialCommunityIcons
                        name={getTypeIcon(method.type) as any}
                        size={24}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.methodInfo}>
                      <View style={styles.methodTitleRow}>
                        <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '500' }}>
                          {method.label || method.type.toUpperCase()}
                        </Text>
                        {method.isDefault && (
                          <Chip
                            compact
                            style={{ backgroundColor: `${colors.primary}20`, marginLeft: 8 }}
                            textStyle={{ color: colors.primary, fontSize: 10 }}
                          >
                            Default
                          </Chip>
                        )}
                      </View>
                      <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
                        {method.address}
                      </Text>
                      <View style={styles.methodStatus}>
                        {method.verified ? (
                          <Chip
                            compact
                            icon="check-circle"
                            style={{ backgroundColor: `${colors.success}20` }}
                            textStyle={{ color: colors.success, fontSize: 10 }}
                          >
                            Verified
                          </Chip>
                        ) : (
                          <Chip
                            compact
                            icon="alert-circle"
                            style={{ backgroundColor: `${colors.warning}20` }}
                            textStyle={{ color: colors.warning, fontSize: 10 }}
                          >
                            Not Verified
                          </Chip>
                        )}
                      </View>
                    </View>
                    <Menu
                      visible={menuVisible === method.id}
                      onDismiss={() => setMenuVisible(null)}
                      anchor={
                        <IconButton
                          icon="dots-vertical"
                          size={20}
                          onPress={() => setMenuVisible(method.id)}
                        />
                      }
                    >
                      {!method.verified && method.type !== 'push' && (
                        <Menu.Item
                          onPress={() => openVerifyModal(method)}
                          title="Verify"
                          leadingIcon="check-circle"
                        />
                      )}
                      {!method.isDefault && method.verified && (
                        <Menu.Item
                          onPress={() => {
                            setMenuVisible(null);
                            handleSetDefault(method);
                          }}
                          title="Set as Default"
                          leadingIcon="star"
                        />
                      )}
                      <Divider />
                      <Menu.Item
                        onPress={() => {
                          setMenuVisible(null);
                          handleDeleteMethod(method);
                        }}
                        title="Delete"
                        leadingIcon="delete"
                        titleStyle={{ color: colors.error }}
                      />
                    </Menu>
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        ) : (
          <>
            {notificationRules.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="bell-ring-outline" size={64} color={colors.textMuted} />
                <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                  No Notification Rules
                </Text>
                <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
                  Create rules to configure how you receive notifications.
                </Text>
                <Button
                  mode="contained"
                  onPress={() => {
                    hapticService.lightTap();
                    setShowRuleModal(true);
                  }}
                  style={styles.emptyButton}
                  disabled={contactMethods.filter(m => m.verified).length === 0}
                >
                  Create Rule
                </Button>
              </View>
            ) : (
              notificationRules.map((rule) => (
                <Card key={rule.id} style={[styles.ruleCard, { backgroundColor: colors.surface }]}>
                  <Card.Content style={styles.ruleContent}>
                    <View style={styles.ruleInfo}>
                      <View style={styles.ruleTitleRow}>
                        <MaterialCommunityIcons
                          name={getTypeIcon(rule.contactMethod?.type || 'email') as any}
                          size={20}
                          color={colors.primary}
                        />
                        <Text
                          variant="bodyLarge"
                          style={{ color: colors.textPrimary, marginLeft: 8, fontWeight: '500' }}
                        >
                          {rule.contactMethod?.label || rule.contactMethod?.address || 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.ruleDetails}>
                        <Chip
                          compact
                          style={{ backgroundColor: `${colors.primary}15` }}
                          textStyle={{ color: colors.primary, fontSize: 10 }}
                        >
                          {rule.urgency === 'any' ? 'All alerts' : `${rule.urgency} urgency`}
                        </Chip>
                        {rule.startDelayMinutes > 0 && (
                          <Chip
                            compact
                            icon="clock-outline"
                            style={{ backgroundColor: `${colors.textMuted}15`, marginLeft: 8 }}
                            textStyle={{ color: colors.textMuted, fontSize: 10 }}
                          >
                            {rule.startDelayMinutes}min delay
                          </Chip>
                        )}
                      </View>
                    </View>
                    <Switch
                      value={rule.enabled}
                      onValueChange={() => handleToggleRule(rule)}
                      color={colors.primary}
                    />
                    <IconButton
                      icon="delete"
                      size={18}
                      onPress={() => handleDeleteRule(rule)}
                      iconColor={colors.error}
                    />
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color="#fff"
        onPress={() => {
          hapticService.lightTap();
          if (activeTab === 'methods') {
            setShowAddModal(true);
          } else {
            setShowRuleModal(true);
          }
        }}
      />

      {/* Add Contact Method Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => {
            setShowAddModal(false);
            resetAddForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Add Contact Method
          </Text>

          <Text variant="labelMedium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
            Type
          </Text>
          <View style={styles.typeSelector}>
            {CONTACT_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.typeButton,
                  { borderColor: newType === type.value ? colors.primary : colors.border },
                  newType === type.value && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => setNewType(type.value)}
              >
                <MaterialCommunityIcons
                  name={type.icon as any}
                  size={24}
                  color={newType === type.value ? colors.primary : colors.textMuted}
                />
                <Text
                  style={{
                    color: newType === type.value ? colors.primary : colors.textSecondary,
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            label="Address"
            value={newAddress}
            onChangeText={setNewAddress}
            mode="outlined"
            style={styles.input}
            placeholder={getAddressPlaceholder(newType)}
            keyboardType={newType === 'email' ? 'email-address' : newType === 'sms' || newType === 'phone' ? 'phone-pad' : 'default'}
          />

          <TextInput
            label="Label (optional)"
            value={newLabel}
            onChangeText={setNewLabel}
            mode="outlined"
            style={styles.input}
            placeholder="e.g., Work, Personal"
          />

          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowAddModal(false);
                resetAddForm();
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleAddContactMethod}
              loading={saving}
              disabled={saving}
            >
              Add
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Verify Modal */}
      <Portal>
        <Modal
          visible={showVerifyModal}
          onDismiss={() => {
            setShowVerifyModal(false);
            resetVerifyForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Verify Contact Method
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
            Verify {selectedMethod?.address}
          </Text>

          {!codeSent ? (
            <>
              <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
                Click below to receive a 6-digit verification code.
              </Text>
              <Button
                mode="contained"
                onPress={handleSendVerification}
                loading={saving}
                disabled={saving}
              >
                Send Verification Code
              </Button>
            </>
          ) : (
            <>
              <TextInput
                label="Verification Code"
                value={verificationCode}
                onChangeText={setVerificationCode}
                mode="outlined"
                style={styles.input}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="Enter 6-digit code"
              />
              <View style={styles.modalActions}>
                <Button mode="text" onPress={handleSendVerification} disabled={saving}>
                  Resend Code
                </Button>
                <Button
                  mode="contained"
                  onPress={handleVerifyCode}
                  loading={saving}
                  disabled={saving || verificationCode.length !== 6}
                >
                  Verify
                </Button>
              </View>
            </>
          )}
        </Modal>
      </Portal>

      {/* Create Rule Modal */}
      <Portal>
        <Modal
          visible={showRuleModal}
          onDismiss={() => {
            setShowRuleModal(false);
            resetRuleForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Create Notification Rule
          </Text>

          <Text variant="labelMedium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
            Contact Method
          </Text>
          <View style={styles.methodPicker}>
            {contactMethods.filter(m => m.verified).map((method) => (
              <Pressable
                key={method.id}
                style={[
                  styles.methodOption,
                  { borderColor: ruleContactMethodId === method.id ? colors.primary : colors.border },
                  ruleContactMethodId === method.id && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => setRuleContactMethodId(method.id)}
              >
                <MaterialCommunityIcons
                  name={getTypeIcon(method.type) as any}
                  size={20}
                  color={ruleContactMethodId === method.id ? colors.primary : colors.textMuted}
                />
                <Text
                  style={{
                    color: ruleContactMethodId === method.id ? colors.primary : colors.textPrimary,
                    marginLeft: 8,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {method.label || method.address}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text variant="labelMedium" style={{ color: colors.textSecondary, marginBottom: 8, marginTop: 16 }}>
            Urgency
          </Text>
          <SegmentedButtons
            value={ruleUrgency}
            onValueChange={(value) => setRuleUrgency(value as NotificationUrgency)}
            buttons={URGENCY_OPTIONS}
            style={styles.segmentedButtons}
          />

          <TextInput
            label="Delay (minutes)"
            value={ruleDelayMinutes}
            onChangeText={setRuleDelayMinutes}
            mode="outlined"
            style={styles.input}
            keyboardType="number-pad"
            placeholder="0"
          />
          <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: -8, marginBottom: 16 }}>
            Wait this many minutes before sending notification (for escalation)
          </Text>

          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowRuleModal(false);
                resetRuleForm();
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleCreateRule}
              loading={saving}
              disabled={saving || !ruleContactMethodId}
            >
              Create Rule
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
  tabContainer: {
    padding: 16,
    paddingBottom: 0,
  },
  tabs: {
    marginBottom: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
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
  methodCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  methodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodStatus: {
    marginTop: 6,
  },
  ruleCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  ruleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleInfo: {
    flex: 1,
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleDetails: {
    flexDirection: 'row',
    marginTop: 8,
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
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  methodPicker: {
    gap: 8,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
