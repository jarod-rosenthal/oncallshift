import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Pressable,
  FlatList,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  TextInput,
  ActivityIndicator,
  Divider,
  Avatar,
  useTheme,
  Surface,
  Checkbox,
  IconButton,
  Portal,
  Modal,
  RadioButton,
  Searchbar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as apiService from '../services/apiService';
import * as runbookService from '../services/runbookService';
import type { Incident, IncidentEvent, User, AIDiagnosisResponse, UserProfile } from '../services/apiService';
import type { Runbook, RunbookStep, RunbookExecution } from '../services/runbookService';
import { severityColors, statusColors, colors } from '../theme';
import * as hapticService from '../services/hapticService';
import { RespondersSection, StickyActionBar, useToast, toastMessages, useConfetti, ResolveTemplatesModal, RelatedIncidents, OwnerAvatar, AIDiagnosisPanel } from '../components';

export default function AlertDetailScreen({ route, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useToast();
  const { showConfetti } = useConfetti();
  const { alert: initialIncident } = route.params as { alert: Incident };
  const [incident, setIncident] = useState<Incident>(initialIncident);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [runbook, setRunbook] = useState<Runbook | null>(null);
  const [runbookExecution, setRunbookExecution] = useState<RunbookExecution | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [showRunbook, setShowRunbook] = useState(true);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showResolveTemplates, setShowResolveTemplates] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reassignReason, setReassignReason] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<AIDiagnosisResponse | null>(null);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [sendingDiagnosisNote, setSendingDiagnosisNote] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);

  // Dynamic styles based on current theme
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    card: {
      margin: 16,
      marginBottom: 0,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center' as const,
    },
    reassignModalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 24,
    },
    noteInput: {
      marginBottom: 12,
      backgroundColor: theme.colors.surface,
    },
    modalInput: {
      width: '100%' as const,
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
    },
    // Timeline styles
    timelineLabel: {
      color: theme.colors.onSurface,
      fontWeight: '600' as const,
    },
    timelineUser: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    timelineMessage: {
      backgroundColor: theme.colors.surfaceVariant,
      padding: 8,
      borderRadius: 6,
      marginTop: 8,
    },
    timelineMessageText: {
      color: theme.colors.onSurface,
    },
    timelineTime: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 4,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: theme.colors.outlineVariant,
      marginVertical: 4,
    },
  };

  useEffect(() => {
    fetchIncidentDetails();
    // Load current user to check admin status
    apiService.getUserProfile()
      .then(setCurrentUserProfile)
      .catch(() => {}); // Ignore errors - admin features just won't show
  }, []);

  const fetchIncidentDetails = async () => {
    try {
      const data = await apiService.getIncidentDetails(incident.id);
      setIncident(data.incident);
      setEvents(data.events || []);

      // Fetch runbook for this service
      fetchRunbook(data.incident.service.id, data.incident.service.name, data.incident.severity);
    } catch (error) {
      console.error('Error fetching incident details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchRunbook = async (serviceId: string, serviceName: string, severity: string) => {
    try {
      console.log('[AlertDetail] Fetching runbook for service:', serviceId, 'severity:', severity);
      // Try to find runbook from API
      const rb = await runbookService.findRunbookForIncident(serviceId, severity);
      if (rb) {
        console.log('[AlertDetail] Found runbook from API:', rb.title, 'id:', rb.id);
        setRunbook(rb);

        // Try to load existing execution state
        const execution = await runbookService.getExecutionForIncident(incident.id);
        if (execution) {
          setRunbookExecution(execution);
          setCompletedSteps(execution.stepsCompleted || []);
        }
      } else {
        console.log('[AlertDetail] No runbook found for service, using mock');
        // Use mock runbook for demo
        setRunbook(runbookService.getMockRunbook(serviceId, serviceName));
      }
    } catch (error) {
      console.error('[AlertDetail] Error fetching runbook:', error);
      // Use mock runbook as fallback
      setRunbook(runbookService.getMockRunbook(serviceId, serviceName));
    }
  };

  const toggleStepCompleted = async (stepId: string) => {
    await hapticService.lightTap();
    const isCompleting = !completedSteps.includes(stepId);

    if (isCompleting) {
      const newCompletedSteps = [...completedSteps, stepId];
      setCompletedSteps(newCompletedSteps);

      // Try to persist to backend if we have an execution
      if (runbookExecution) {
        runbookService.completeRunbookStep(runbookExecution.id, stepId).catch(err => {
          console.error('Failed to persist step completion:', err);
        });
      } else if (runbook && !runbook.id.startsWith('rb-')) {
        // Start a new execution if we have a real runbook
        runbookService.startRunbookExecution(runbook.id, incident.id).then(execution => {
          if (execution) {
            setRunbookExecution(execution);
            // Complete the step in the new execution
            runbookService.completeRunbookStep(execution.id, stepId).catch(err => {
              console.error('Failed to persist step completion:', err);
            });
          }
        }).catch(err => {
          console.error('Failed to start runbook execution:', err);
        });
      }

      // If all required steps completed, show success
      const requiredSteps = runbook?.steps.filter(s => !s.isOptional) || [];
      const allRequiredComplete = requiredSteps.every(s => newCompletedSteps.includes(s.id));
      if (allRequiredComplete && requiredSteps.length > 0) {
        await hapticService.success();
      }
    } else {
      setCompletedSteps(completedSteps.filter(id => id !== stepId));
    }
  };

  const handleAcknowledge = async () => {
    setActionLoading(true);
    try {
      const result = await apiService.acknowledgeIncident(incident.id);
      setIncident(result.incident);
      await hapticService.success();
      showSuccess(toastMessages.acknowledge);
      fetchIncidentDetails();
    } catch (error: any) {
      await hapticService.error();
      showError(error.message || 'Failed to acknowledge incident');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (note?: string) => {
    setActionLoading(true);
    try {
      const result = await apiService.resolveIncident(incident.id, note);
      setIncident(result.incident);
      await hapticService.success();
      showConfetti();
      showSuccess(toastMessages.resolve);
      fetchIncidentDetails();
    } catch (error: any) {
      await hapticService.error();
      showError(error.message || 'Failed to resolve incident');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveWithTemplate = (note: string) => {
    setShowResolveTemplates(false);
    handleResolve(note);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;

    setAddingNote(true);
    try {
      await apiService.addIncidentNote(incident.id, noteText.trim());
      setNoteText('');
      fetchIncidentDetails();
      showSuccess(toastMessages.note_added);
    } catch (error: any) {
      showError(error.message || 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleEscalate = async () => {
    setShowEscalateModal(false);
    setActionLoading(true);
    await hapticService.warning();
    try {
      await apiService.escalateIncident(incident.id, escalateReason || undefined);
      await hapticService.success();
      showSuccess(toastMessages.escalate);
      setEscalateReason('');
      fetchIncidentDetails();
    } catch (error: any) {
      await hapticService.error();
      showError(error.message || 'Failed to escalate incident');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const userList = await apiService.getUsers();
      setUsers(userList.filter(u => u.status === 'active'));
    } catch (error) {
      console.error('Error fetching users:', error);
      showError('Failed to load team members');
    } finally {
      setLoadingUsers(false);
    }
  };

  const openReassignModal = () => {
    setShowReassignModal(true);
    fetchUsers();
  };

  const handleDiagnose = async () => {
    setDiagnosisLoading(true);
    setDiagnosisError(null);
    await hapticService.mediumTap();
    try {
      const result = await apiService.diagnoseIncident(incident.id);
      setDiagnosis(result);
      await hapticService.success();
    } catch (error: any) {
      await hapticService.error();
      const status = error.response?.status;
      const responseData = error.response?.data;

      // Check if this is a credential-related error
      const errorMsg = (responseData?.message || '').toLowerCase();
      const errorType = (responseData?.error || '').toLowerCase();
      const isCredentialError =
        status === 401 ||
        status === 503 ||
        responseData?.requiresCredentials ||
        errorMsg.includes('api key') ||
        errorMsg.includes('api-key') ||
        errorMsg.includes('x-api-key') ||
        errorMsg.includes('credential') ||
        errorMsg.includes('authentication_error') ||
        errorMsg.includes('invalid x-api-key') ||
        errorType.includes('api key') ||
        errorType.includes('authentication');

      if (isCredentialError) {
        // Show the API key modal instead of an error
        setShowApiKeyModal(true);
        setDiagnosisLoading(false);
        return;
      }

      // Extract error message from Axios error response or use fallback
      const errorMessage = responseData?.message
        || responseData?.error
        || error.message
        || 'Failed to analyze incident';
      console.error('AI diagnosis error details:', {
        status,
        data: responseData,
        message: error.message,
      });
      setDiagnosisError(errorMessage);
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;

    setSavingApiKey(true);
    try {
      await apiService.saveAnthropicCredential(apiKeyInput.trim());
      await hapticService.success();
      showSuccess('API key saved securely');
      setShowApiKeyModal(false);
      setApiKeyInput('');
      // Automatically retry the diagnosis
      handleDiagnose();
    } catch (error: any) {
      await hapticService.error();
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save API key';
      showError(errorMessage);
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleSendDiagnosisAsNote = async (noteText: string) => {
    setSendingDiagnosisNote(true);
    try {
      await apiService.addIncidentNote(incident.id, noteText);
      await hapticService.success();
      showSuccess('AI diagnosis added to notes');
      fetchIncidentDetails();
    } catch (error: any) {
      await hapticService.error();
      showError(error.message || 'Failed to add note');
    } finally {
      setSendingDiagnosisNote(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedUserId) return;

    setShowReassignModal(false);
    setActionLoading(true);
    await hapticService.mediumTap();
    try {
      await apiService.reassignIncident(
        incident.id,
        selectedUserId,
        reassignReason || undefined,
        true
      );
      await hapticService.success();
      showSuccess('Incident reassigned');
      setSelectedUserId(null);
      setReassignReason('');
      fetchIncidentDetails();
    } catch (error: any) {
      await hapticService.error();
      showError(error.message || 'Failed to reassign incident');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnacknowledge = async () => {
    Alert.alert(
      'Revert to Triggered',
      'This will move the incident back to triggered state. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiService.unacknowledgeIncident(incident.id);
              await hapticService.success();
              showSuccess('Incident reverted to triggered');
              fetchIncidentDetails();
            } catch (error: any) {
              await hapticService.error();
              showError(error.message || 'Failed to unacknowledge incident');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUnresolve = async () => {
    Alert.alert(
      'Reopen Incident',
      'This will reopen the incident and move it back to triggered state. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reopen',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiService.unresolveIncident(incident.id);
              await hapticService.success();
              showSuccess('Incident reopened');
              fetchIncidentDetails();
            } catch (error: any) {
              await hapticService.error();
              showError(error.message || 'Failed to reopen incident');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await hapticService.warning();
    try {
      await apiService.deleteIncident(incident.id);
      await hapticService.success();
      showSuccess(`Incident #${incident.incidentNumber} deleted`);
      navigation.goBack();
    } catch (error: any) {
      await hapticService.error();
      showError(error.message || 'Failed to delete incident');
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getSeverityColor = (severity: string) => {
    return severityColors[severity as keyof typeof severityColors] || severityColors.default;
  };

  const getStatusColor = (state: string) => {
    return statusColors[state as keyof typeof statusColors] || colors.textSecondary;
  };

  const getEventIcon = (type: string): { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string } => {
    switch (type) {
      case 'trigger':
        return { icon: 'alert-circle', color: colors.error };
      case 'acknowledge':
        return { icon: 'check-circle', color: colors.warning };
      case 'resolve':
        return { icon: 'check-circle-outline', color: colors.success };
      case 'note':
        return { icon: 'note-text', color: colors.info };
      case 'escalate':
        return { icon: 'arrow-up-circle', color: colors.accent };
      default:
        return { icon: 'help-circle', color: colors.textSecondary };
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'trigger':
        return 'Triggered';
      case 'acknowledge':
        return 'Acknowledged';
      case 'resolve':
        return 'Resolved';
      case 'note':
        return 'Note added';
      case 'escalate':
        return 'Escalated';
      default:
        return type;
    }
  };

  return (
    <KeyboardAvoidingView
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView style={styles.scrollView}>
        {/* Header Card */}
        <Card style={dynamicStyles.card} mode="elevated">
          <Card.Content>
            {/* Severity and Status */}
            <View style={styles.headerBadges}>
              <Chip
                style={[styles.severityChip, { backgroundColor: getSeverityColor(incident.severity) }]}
                textStyle={styles.severityChipText}
                icon={() => (
                  <MaterialCommunityIcons name="alert-octagon" size={16} color="#fff" />
                )}
              >
                {incident.severity.toUpperCase()}
              </Chip>
              <Chip
                mode="outlined"
                style={[styles.statusChip, { borderColor: getStatusColor(incident.state) }]}
                textStyle={[styles.statusChipText, { color: getStatusColor(incident.state) }]}
              >
                {incident.state}
              </Chip>
            </View>

            {/* Incident Number and Title */}
            <Text variant="labelMedium" style={styles.incidentNumber}>
              #{incident.incidentNumber}
            </Text>
            <Text variant="headlineSmall" style={styles.title}>
              {incident.summary}
            </Text>

            <Divider style={styles.divider} />

            {/* Meta Information */}
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="server" size={18} color={colors.textSecondary} />
              <Text variant="bodyMedium" style={styles.metaLabel}>Service</Text>
              <Text variant="bodyMedium" style={styles.metaValue}>{incident.service.name}</Text>
            </View>

            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={colors.textSecondary} />
              <Text variant="bodyMedium" style={styles.metaLabel}>Triggered</Text>
              <Text variant="bodyMedium" style={styles.metaValue}>{formatDate(incident.triggeredAt)}</Text>
            </View>

            {incident.acknowledgedAt && (
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="check" size={18} color={colors.warning} />
                <Text variant="bodyMedium" style={styles.metaLabel}>Acknowledged</Text>
                <Text variant="bodyMedium" style={styles.metaValue}>{formatDate(incident.acknowledgedAt)}</Text>
              </View>
            )}

            {incident.resolvedAt && (
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="check-all" size={18} color={colors.success} />
                <Text variant="bodyMedium" style={styles.metaLabel}>Resolved</Text>
                <Text variant="bodyMedium" style={styles.metaValue}>{formatDate(incident.resolvedAt)}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Details Card */}
        {incident.details && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="code-json" size={20} color={theme.colors.primary} />
                <Text variant="titleMedium" style={styles.sectionTitle}>Details</Text>
              </View>
              <Surface style={styles.detailSurface} elevation={0}>
                <Text variant="bodySmall" style={styles.detailText}>
                  {JSON.stringify(incident.details, null, 2)}
                </Text>
              </Surface>
            </Card.Content>
          </Card>
        )}

        {/* AI Diagnosis Section */}
        {!diagnosis && !diagnosisLoading && incident.state !== 'resolved' && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <View style={styles.diagnoseButtonContainer}>
                <View style={styles.diagnoseInfo}>
                  <MaterialCommunityIcons name="robot" size={24} color={colors.accent} />
                  <View style={styles.diagnoseTextContainer}>
                    <Text variant="titleSmall" style={styles.diagnoseTitle}>
                      Need help troubleshooting?
                    </Text>
                    <Text variant="bodySmall" style={styles.diagnoseSubtitle}>
                      AI can analyze logs, metrics, and history
                    </Text>
                  </View>
                </View>
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('AIChat', { incident })}
                  icon="robot-outline"
                  buttonColor={colors.accent}
                  style={styles.diagnoseButton}
                >
                  Chat with AI
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* AI Diagnosis Panel */}
        {(diagnosis || diagnosisLoading || diagnosisError) && (
          <AIDiagnosisPanel
            loading={diagnosisLoading}
            diagnosis={diagnosis}
            error={diagnosisError}
            onRetry={handleDiagnose}
            onSendAsNote={incident.state !== 'resolved' ? handleSendDiagnosisAsNote : undefined}
            sendingNote={sendingDiagnosisNote}
          />
        )}

        {/* Runbook Card */}
        {runbook && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <Pressable
                onPress={() => setShowRunbook(!showRunbook)}
                style={styles.runbookHeader}
              >
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="book-open-variant" size={20} color={colors.accent} />
                  <Text variant="titleMedium" style={styles.sectionTitle}>Runbook</Text>
                </View>
                <View style={styles.runbookProgress}>
                  <Text variant="labelSmall" style={styles.runbookProgressText}>
                    {completedSteps.length}/{runbook.steps.length}
                  </Text>
                  <MaterialCommunityIcons
                    name={showRunbook ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>

              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${(completedSteps.length / runbook.steps.length) * 100}%` },
                  ]}
                />
              </View>

              {showRunbook && (
                <>
                  <Text variant="bodySmall" style={styles.runbookDescription}>
                    {runbook.description}
                  </Text>

                  {/* Runbook Metadata */}
                  {(runbook.author || runbook.lastUpdated || (runbook.tags && runbook.tags.length > 0)) && (
                    <View style={styles.runbookMeta}>
                      {runbook.author && (
                        <View style={styles.runbookMetaItem}>
                          <MaterialCommunityIcons name="account" size={14} color={colors.textMuted} />
                          <Text variant="labelSmall" style={styles.runbookMetaText}>
                            {runbook.author.fullName}
                          </Text>
                        </View>
                      )}
                      {runbook.lastUpdated && (
                        <View style={styles.runbookMetaItem}>
                          <MaterialCommunityIcons name="update" size={14} color={colors.textMuted} />
                          <Text variant="labelSmall" style={styles.runbookMetaText}>
                            Updated {new Date(runbook.lastUpdated).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      {runbook.tags && runbook.tags.length > 0 && (
                        <View style={styles.runbookTagsRow}>
                          {runbook.tags.slice(0, 3).map((tag, idx) => (
                            <Chip key={idx} compact style={styles.runbookTag} textStyle={styles.runbookTagText}>
                              {tag}
                            </Chip>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Runbook Steps */}
                  <View style={styles.runbookSteps}>
                    {runbook.steps.map((step, index) => (
                      <Pressable
                        key={step.id}
                        style={styles.runbookStep}
                        onPress={() => incident.state !== 'resolved' && toggleStepCompleted(step.id)}
                        disabled={incident.state === 'resolved'}
                      >
                        <View style={styles.runbookStepCheckbox}>
                          <Checkbox
                            status={completedSteps.includes(step.id) ? 'checked' : 'unchecked'}
                            onPress={() => incident.state !== 'resolved' && toggleStepCompleted(step.id)}
                            color={colors.success}
                            disabled={incident.state === 'resolved'}
                          />
                        </View>
                        <View style={styles.runbookStepContent}>
                          <View style={styles.runbookStepTitleRow}>
                            <Text
                              variant="titleSmall"
                              style={[
                                styles.runbookStepTitle,
                                completedSteps.includes(step.id) && styles.runbookStepCompleted,
                              ]}
                            >
                              {index + 1}. {step.title}
                            </Text>
                            {step.isOptional && (
                              <Chip compact style={styles.optionalChip} textStyle={styles.optionalChipText}>
                                Optional
                              </Chip>
                            )}
                          </View>
                          <Text
                            variant="bodySmall"
                            style={[
                              styles.runbookStepDescription,
                              completedSteps.includes(step.id) && styles.runbookStepCompleted,
                            ]}
                          >
                            {step.description}
                          </Text>
                          {step.estimatedMinutes && (
                            <View style={styles.runbookStepMeta}>
                              <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textMuted} />
                              <Text variant="labelSmall" style={styles.runbookStepTime}>
                                ~{step.estimatedMinutes} min
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  {/* External Link */}
                  {runbook.externalUrl && (
                    <Button
                      mode="outlined"
                      icon="open-in-new"
                      onPress={() => Linking.openURL(runbook.externalUrl!)}
                      style={styles.externalLinkButton}
                    >
                      View Full Runbook
                    </Button>
                  )}
                </>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Responders Card */}
        <Card style={dynamicStyles.card} mode="elevated">
          <Card.Content>
            <RespondersSection
              responders={[]}
              acknowledgedBy={incident.acknowledgedBy}
            />
          </Card.Content>
        </Card>

        {/* Timeline Card */}
        <Card style={dynamicStyles.card} mode="elevated">
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="timeline-clock-outline" size={20} color={theme.colors.primary} />
              <Text variant="titleMedium" style={styles.sectionTitle}>Timeline</Text>
            </View>

            {loadingDetails ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : events.length > 0 ? (
              <View style={styles.timeline}>
                {events.map((event, index) => {
                  const { icon, color } = getEventIcon(event.type);
                  return (
                    <View key={event.id} style={styles.timelineItem}>
                      <View style={styles.timelineLeft}>
                        <View style={[styles.timelineIcon, { backgroundColor: color }]}>
                          <MaterialCommunityIcons name={icon} size={16} color="#fff" />
                        </View>
                        {index < events.length - 1 && <View style={dynamicStyles.timelineLine} />}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text variant="titleSmall" style={dynamicStyles.timelineLabel}>
                          {getEventLabel(event.type)}
                        </Text>
                        {event.user && (
                          <Text variant="bodySmall" style={dynamicStyles.timelineUser}>
                            by {event.user.fullName}
                          </Text>
                        )}
                        {event.message && (
                          <Surface style={dynamicStyles.timelineMessage} elevation={0}>
                            <Text variant="bodySmall" style={dynamicStyles.timelineMessageText}>{event.message}</Text>
                          </Surface>
                        )}
                        <Text variant="labelSmall" style={dynamicStyles.timelineTime}>
                          {formatDate(event.createdAt)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text variant="bodyMedium" style={styles.noEventsText}>
                No timeline events
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Add Note Card */}
        {incident.state !== 'resolved' && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="note-plus" size={20} color={theme.colors.primary} />
                <Text variant="titleMedium" style={styles.sectionTitle}>Add Note</Text>
              </View>
              <TextInput
                mode="outlined"
                placeholder="Add a note to this incident..."
                value={noteText}
                onChangeText={setNoteText}
                multiline
                numberOfLines={3}
                style={dynamicStyles.noteInput}
                outlineStyle={styles.noteInputOutline}
              />
              <Button
                mode="contained"
                onPress={handleAddNote}
                loading={addingNote}
                disabled={!noteText.trim() || addingNote}
                style={styles.noteButton}
                icon="send"
              >
                Add Note
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Resolved Notice */}
        {incident.state === 'resolved' && (
          <Surface style={styles.resolvedNotice} elevation={0}>
            <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
            <View style={styles.resolvedTextContainer}>
              <Text variant="titleSmall" style={styles.resolvedText}>
                This incident has been resolved
              </Text>
              {incident.resolvedBy && (
                <Text variant="bodySmall" style={styles.resolvedBy}>
                  By {incident.resolvedBy.fullName}
                </Text>
              )}
            </View>
          </Surface>
        )}

        {/* Related Incidents */}
        <RelatedIncidents
          currentIncident={incident}
          onIncidentPress={(relatedIncident) => {
            navigation.push('AlertDetail', { alert: relatedIncident });
          }}
        />

        {/* Admin Actions */}
        {currentUserProfile?.role === 'admin' && (
          <Card style={[dynamicStyles.card, styles.dangerCard]} mode="elevated">
            <Card.Content>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="shield-account" size={20} color={colors.error} />
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.error }]}>
                  Admin Actions
                </Text>
              </View>
              <Button
                mode="contained"
                buttonColor={colors.error}
                onPress={() => setShowDeleteModal(true)}
                icon="delete"
                style={styles.deleteButton}
              >
                Delete Incident
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Bottom padding to account for sticky action bar */}
        <View style={[styles.bottomPadding, incident.state !== 'resolved' && styles.bottomPaddingWithActions]} />
      </ScrollView>

      {/* Sticky Action Bar */}
      {incident.state === 'triggered' && (
        <StickyActionBar
          loading={actionLoading}
          actions={[
            {
              label: 'Acknowledge',
              icon: 'check',
              onPress: handleAcknowledge,
              color: colors.warning,
              loading: actionLoading,
            },
            {
              label: 'Resolve',
              icon: 'check-all',
              onPress: () => setShowResolveTemplates(true),
              color: colors.success,
              loading: actionLoading,
            },
          ]}
        />
      )}

      {incident.state === 'acknowledged' && (
        <StickyActionBar
          loading={actionLoading}
          actions={[
            {
              label: 'Reassign',
              icon: 'account-switch',
              onPress: openReassignModal,
              mode: 'outlined',
              color: theme.colors.onSurfaceVariant,
            },
            {
              label: 'Escalate',
              icon: 'arrow-up-circle',
              onPress: () => setShowEscalateModal(true),
              mode: 'outlined',
              color: theme.colors.secondary,
            },
            {
              label: 'Resolve',
              icon: 'check-all',
              onPress: () => setShowResolveTemplates(true),
              color: colors.success,
              loading: actionLoading,
            },
          ]}
        />
      )}

      {incident.state === 'resolved' && (
        <StickyActionBar
          loading={actionLoading}
          actions={[
            {
              label: 'Reopen',
              icon: 'refresh',
              onPress: handleUnresolve,
              mode: 'outlined',
              color: theme.colors.tertiary,
            },
          ]}
        />
      )}

      {/* Escalate Confirmation Modal */}
      <Portal>
        <Modal
          visible={showEscalateModal}
          onDismiss={() => { setShowEscalateModal(false); setEscalateReason(''); }}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <MaterialCommunityIcons name="arrow-up-circle" size={48} color={colors.accent} />
            <Text variant="titleLarge" style={styles.modalTitle}>
              Escalate Incident?
            </Text>
            <Text variant="bodyMedium" style={styles.modalDescription}>
              This will notify the next responder in the escalation policy for {incident.service.name}.
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Reason for escalation (optional)"
              value={escalateReason}
              onChangeText={setEscalateReason}
              style={dynamicStyles.modalInput}
              multiline
              numberOfLines={2}
            />
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => { setShowEscalateModal(false); setEscalateReason(''); }}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleEscalate}
                buttonColor={colors.accent}
                style={styles.modalButton}
              >
                Escalate
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Reassign Modal */}
      <Portal>
        <Modal
          visible={showReassignModal}
          onDismiss={() => { setShowReassignModal(false); setSelectedUserId(null); setReassignReason(''); }}
          contentContainerStyle={styles.reassignModalContainer}
        >
          <View style={dynamicStyles.reassignModalContent}>
            <View style={styles.reassignModalHeader}>
              <MaterialCommunityIcons name="account-switch" size={32} color={colors.accent} />
              <Text variant="titleLarge" style={styles.modalTitle}>
                Reassign Incident
              </Text>
            </View>

            <Text variant="bodyMedium" style={styles.reassignSubtitle}>
              Select a team member to reassign this incident to:
            </Text>

            {loadingUsers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={styles.userList}>
                {users.map((user) => (
                  <Pressable
                    key={user.id}
                    style={[
                      styles.userItem,
                      selectedUserId === user.id && styles.userItemSelected,
                    ]}
                    onPress={() => setSelectedUserId(user.id)}
                  >
                    <OwnerAvatar name={user.fullName} email={user.email} size={40} />
                    <View style={styles.userItemInfo}>
                      <Text variant="titleSmall" style={styles.userItemName}>
                        {user.fullName}
                      </Text>
                      <Text variant="bodySmall" style={styles.userItemEmail}>
                        {user.email}
                      </Text>
                    </View>
                    <RadioButton
                      value={user.id}
                      status={selectedUserId === user.id ? 'checked' : 'unchecked'}
                      onPress={() => setSelectedUserId(user.id)}
                      color={colors.accent}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <TextInput
              mode="outlined"
              placeholder="Reason for reassignment (optional)"
              value={reassignReason}
              onChangeText={setReassignReason}
              style={dynamicStyles.modalInput}
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => { setShowReassignModal(false); setSelectedUserId(null); setReassignReason(''); }}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleReassign}
                buttonColor={colors.accent}
                style={styles.modalButton}
                disabled={!selectedUserId}
              >
                Reassign
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Resolve Templates Modal */}
      <ResolveTemplatesModal
        visible={showResolveTemplates}
        onDismiss={() => setShowResolveTemplates(false)}
        onSelectTemplate={handleResolveWithTemplate}
      />

      {/* Delete Confirmation Modal */}
      <Portal>
        <Modal
          visible={showDeleteModal}
          onDismiss={() => setShowDeleteModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <MaterialCommunityIcons name="delete-alert" size={48} color={colors.error} />
            <Text variant="titleLarge" style={styles.modalTitle}>
              Delete Incident?
            </Text>
            <Text variant="bodyMedium" style={styles.modalDescription}>
              Are you sure you want to delete incident #{incident.incidentNumber}? This action cannot be undone and will remove all associated timeline events and notes.
            </Text>
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowDeleteModal(false)}
                style={styles.modalButton}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleDelete}
                buttonColor={colors.error}
                style={styles.modalButton}
                loading={isDeleting}
                disabled={isDeleting}
              >
                Delete
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* API Key Setup Modal */}
      <Portal>
        <Modal
          visible={showApiKeyModal}
          onDismiss={() => { setShowApiKeyModal(false); setApiKeyInput(''); }}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={dynamicStyles.reassignModalContent}>
            <View style={styles.reassignModalHeader}>
              <MaterialCommunityIcons name="key-variant" size={32} color={theme.colors.secondary} />
              <Text variant="titleLarge" style={styles.modalTitle}>
                Set Up AI Diagnosis
              </Text>
            </View>

            <Text variant="bodyMedium" style={styles.reassignSubtitle}>
              To use AI-powered incident diagnosis, you need to provide your Anthropic API key. Your key is stored securely and encrypted.
            </Text>

            <TextInput
              mode="outlined"
              label="Anthropic API Key"
              placeholder="sk-ant-..."
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              style={dynamicStyles.modalInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text variant="bodySmall" style={styles.apiKeyHint}>
              Get your API key from console.anthropic.com
            </Text>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => { setShowApiKeyModal(false); setApiKeyInput(''); }}
                style={styles.modalButton}
                disabled={savingApiKey}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveApiKey}
                buttonColor={theme.colors.secondary}
                style={styles.modalButton}
                loading={savingApiKey}
                disabled={!apiKeyInput.trim() || savingApiKey}
              >
                Save & Diagnose
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: `${colors.error}40`,
  },
  deleteButton: {
    borderRadius: 8,
    marginTop: 8,
  },
  headerBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  severityChip: {
    height: 28,
  },
  severityChipText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusChip: {
    height: 28,
    backgroundColor: 'transparent',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  incidentNumber: {
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: 'bold',
    lineHeight: 28,
  },
  divider: {
    marginVertical: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  metaLabel: {
    color: colors.textSecondary,
    width: 100,
  },
  metaValue: {
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  detailSurface: {
    backgroundColor: colors.surfaceSecondary,
    padding: 12,
    borderRadius: 8,
  },
  detailText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  timeline: {
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 60,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 40,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  timelineLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  timelineUser: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  timelineMessage: {
    backgroundColor: colors.surfaceSecondary,
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  timelineTime: {
    color: colors.textMuted,
    marginTop: 4,
  },
  noEventsText: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  noteInput: {
    backgroundColor: colors.surface,
    marginBottom: 12,
  },
  noteInputOutline: {
    borderRadius: 8,
  },
  noteButton: {
    borderRadius: 8,
  },
  resolvedNotice: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.successLight,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resolvedTextContainer: {
    flex: 1,
  },
  resolvedText: {
    color: colors.success,
    fontWeight: '500',
  },
  resolvedBy: {
    color: colors.success,
    marginTop: 2,
  },
  bottomPadding: {
    height: 40,
  },
  bottomPaddingWithActions: {
    height: 180,
  },
  modalContainer: {
    margin: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  modalDescription: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
  },
  modalInput: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  reassignModalContainer: {
    margin: 20,
    maxHeight: '80%',
  },
  reassignModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
  },
  reassignModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  reassignSubtitle: {
    color: colors.textSecondary,
    marginBottom: 16,
  },
  apiKeyHint: {
    color: colors.textMuted,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userList: {
    maxHeight: 250,
    marginBottom: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: colors.surfaceSecondary,
  },
  userItemSelected: {
    backgroundColor: colors.primaryLight + '20',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  userItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userItemName: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  userItemEmail: {
    color: colors.textSecondary,
  },
  // Runbook styles
  runbookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  runbookProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  runbookProgressText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  runbookMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  runbookMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  runbookMetaText: {
    color: colors.textMuted,
  },
  runbookTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  runbookTag: {
    backgroundColor: colors.surfaceSecondary,
    height: 24,
  },
  runbookTagText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  runbookDescription: {
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  runbookSteps: {
    gap: 0,
  },
  runbookStep: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    alignItems: 'flex-start',
  },
  runbookStepCheckbox: {
    marginRight: 8,
    marginTop: -4,
    width: 40,
  },
  runbookStepContent: {
    flex: 1,
    paddingRight: 4,
  },
  runbookStepTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  runbookStepTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
  },
  runbookStepDescription: {
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },
  runbookStepCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  runbookStepMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  runbookStepTime: {
    color: colors.textMuted,
  },
  optionalChip: {
    backgroundColor: colors.surfaceSecondary,
    height: 22,
    flexShrink: 0,
  },
  optionalChipText: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
  externalLinkButton: {
    marginTop: 16,
    borderRadius: 8,
  },
  // AI Diagnosis styles
  diagnoseButtonContainer: {
    gap: 12,
  },
  diagnoseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diagnoseTextContainer: {
    flex: 1,
  },
  diagnoseTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  diagnoseSubtitle: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  diagnoseButton: {
    borderRadius: 8,
  },
});
