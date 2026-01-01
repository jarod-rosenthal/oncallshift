import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import * as apiService from '../services/apiService';
import * as runbookService from '../services/runbookService';
import { getAccessToken } from '../services/authService';
import { config } from '../config';
import type { Incident, IncidentEvent, User, LegacyAIDiagnosisResponse, UserProfile, UserNotification, NotificationSummary, SimilarIncident } from '../services/apiService';
import type { Runbook, RunbookStep, RunbookExecution, RunbookStepAction } from '../services/runbookService';
import { severityColors, statusColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import * as hapticService from '../services/hapticService';
import { RespondersSection, StickyActionBar, useToast, toastMessages, useConfetti, ResolveTemplatesModal, ResolveIncidentModal, RelatedIncidents, OwnerAvatar, AIDiagnosisPanel, ServiceHealthBadge, SimilarIncidentHint } from '../components';
import type { ResolutionData } from '../components';

// Skeleton placeholder component for loading states
const SkeletonBox = ({ width, height, style, bgColor }: { width: number | string; height: number; style?: any; bgColor: string }) => (
  <View
    style={[
      {
        width,
        height,
        backgroundColor: bgColor,
        borderRadius: 6,
        opacity: 0.5,
      },
      style,
    ]}
  />
);

export default function AlertDetailScreen({ route, navigation }: any) {
  const theme = useTheme();
  const { colors } = useAppTheme();
  const themedStyles = styles(colors);
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
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reassignReason, setReassignReason] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<LegacyAIDiagnosisResponse | null>(null);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [sendingDiagnosisNote, setSendingDiagnosisNote] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, { status: 'idle' | 'confirming' | 'executing' | 'success' | 'error'; message?: string }>>({});
  const [confirmingAction, setConfirmingAction] = useState<{ stepId: string; action: RunbookStepAction } | null>(null);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notificationSummary, setNotificationSummary] = useState<NotificationSummary | null>(null);
  const [showNotifications, setShowNotifications] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const isInitialMount = useRef(true);

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

  // Auto-refresh when screen comes back into focus (e.g., returning from AI Chat)
  useFocusEffect(
    useCallback(() => {
      // Skip initial mount - the useEffect above handles that
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      // Refresh incident details when returning to this screen
      console.log('[AlertDetail] Screen refocused, refreshing data...');
      fetchIncidentDetails();
    }, [incident.id])
  );

  const fetchIncidentDetails = async () => {
    try {
      const data = await apiService.getIncidentDetails(incident.id);
      setIncident(data.incident);
      setEvents(data.events || []);

      // Fetch runbook for this service
      fetchRunbook(data.incident.service.id, data.incident.service.name, data.incident.severity);

      // Fetch notification statuses
      fetchNotifications();
    } catch (error) {
      console.error('Error fetching incident details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const data = await apiService.getIncidentNotifications(incident.id);
      setNotifications(data.notifications || []);
      setNotificationSummary(data.summary || null);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // Don't show error - notifications are optional
    } finally {
      setLoadingNotifications(false);
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
    console.log('[AlertDetail] Toggling step:', stepId);
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

  const executeAction = async (stepId: string, action: RunbookStepAction) => {
    // If action has confirm message and we're not already confirming, show confirmation
    if (action.confirmMessage && actionStates[stepId]?.status !== 'confirming') {
      setConfirmingAction({ stepId, action });
      setActionStates(prev => ({
        ...prev,
        [stepId]: { status: 'confirming', message: action.confirmMessage }
      }));
      return;
    }

    // Execute the action
    setActionStates(prev => ({
      ...prev,
      [stepId]: { status: 'executing' }
    }));
    setConfirmingAction(null);
    await hapticService.mediumTap();

    try {
      // Build full URL - action.url may be relative (e.g., /api/v1/actions/kill-queries)
      const fullUrl = action.url.startsWith('http')
        ? action.url
        : `${config.apiUrl}${action.url.replace('/api', '')}`;

      // Get auth token
      const accessToken = await getAccessToken();

      const response = await fetch(fullUrl, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: action.body ? JSON.stringify(action.body) : undefined,
      });

      // Try to parse response as JSON, but handle non-JSON responses
      let data: any = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          // JSON parse failed, use empty object
        }
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || `Request failed: ${response.status}`);
      }

      const successMessage = data.message || 'Action completed successfully';

      setActionStates(prev => ({
        ...prev,
        [stepId]: { status: 'success', message: successMessage }
      }));

      // Mark step as completed
      if (!completedSteps.includes(stepId)) {
        const newCompletedSteps = [...completedSteps, stepId];
        setCompletedSteps(newCompletedSteps);
      }

      // Add note to incident timeline
      try {
        const noteContent = `**Runbook Action Executed:** ${action.label}\n\n` +
          `- **Endpoint:** \`${action.method} ${action.url}\`\n` +
          (action.body ? `- **Parameters:** \`${JSON.stringify(action.body)}\`\n` : '') +
          `- **Result:** ${successMessage}`;

        await apiService.addIncidentNote(incident.id, noteContent);
        // Refresh to show the new note
        fetchIncidentDetails();
      } catch (noteError) {
        console.warn('Failed to add action note to incident:', noteError);
        // Don't fail the action if note fails
      }

      await hapticService.success();
      showSuccess(successMessage);

      // Clear success state after 3 seconds
      setTimeout(() => {
        setActionStates(prev => ({
          ...prev,
          [stepId]: { status: 'idle' }
        }));
      }, 3000);
    } catch (error: any) {
      console.error('Action execution error:', error);
      const errorMessage = error.message || 'Action failed';

      setActionStates(prev => ({
        ...prev,
        [stepId]: { status: 'error', message: errorMessage }
      }));

      // Add note about failed action attempt
      try {
        const noteContent = `**Runbook Action Failed:** ${action.label}\n\n` +
          `- **Endpoint:** \`${action.method} ${action.url}\`\n` +
          (action.body ? `- **Parameters:** \`${JSON.stringify(action.body)}\`\n` : '') +
          `- **Error:** ${errorMessage}`;

        await apiService.addIncidentNote(incident.id, noteContent);
        fetchIncidentDetails();
      } catch (noteError) {
        console.warn('Failed to add error note to incident:', noteError);
      }

      await hapticService.error();
      showError(errorMessage);

      // Clear error state after 5 seconds
      setTimeout(() => {
        setActionStates(prev => ({
          ...prev,
          [stepId]: { status: 'idle' }
        }));
      }, 5000);
    }
  };

  const cancelActionConfirmation = (stepId: string) => {
    setConfirmingAction(null);
    setActionStates(prev => ({
      ...prev,
      [stepId]: { status: 'idle' }
    }));
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

  const handleResolveWithData = async (data: ResolutionData) => {
    setShowResolveModal(false);
    setActionLoading(true);
    try {
      const result = await apiService.resolveIncident(incident.id, data);
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

  const handleFalseAlarm = async () => {
    setActionLoading(true);
    try {
      const result = await apiService.resolveIncident(incident.id, {
        rootCause: 'false_alarm',
        resolutionSummary: 'Alert triggered incorrectly. No actual issue detected.',
        followUpRequired: false,
      });
      setIncident(result.incident);
      await hapticService.success();
      showSuccess('Dismissed as false alarm');
      fetchIncidentDetails();
    } catch (error: any) {
      await hapticService.error();
      showError(error.message || 'Failed to dismiss incident');
    } finally {
      setActionLoading(false);
    }
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
      'Revert to Active',
      'This will move the incident back to active state. Are you sure?',
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
              showSuccess('Incident reverted to active');
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
      'This will reopen the incident and move it back to active state. Are you sure?',
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

  // Format duration from a timestamp to now (e.g., "2h 15m", "3d 4h")
  const formatDuration = (startDate: string) => {
    const start = new Date(startDate).getTime();
    const now = Date.now();
    const diffMs = now - start;

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Get the relevant timestamp for duration based on state
  const getStateDuration = () => {
    switch (incident.state) {
      case 'resolved':
        return incident.resolvedAt ? formatDuration(incident.triggeredAt) : null;
      case 'acknowledged':
        return incident.acknowledgedAt ? formatDuration(incident.acknowledgedAt) : null;
      default:
        return formatDuration(incident.triggeredAt);
    }
  };

  // Get status display config
  const getStatusConfig = (state: string) => {
    switch (state) {
      case 'triggered':
        return { label: 'Active', color: colors.error, bgColor: colors.error + '15', icon: 'alert-circle' as const };
      case 'acknowledged':
        return { label: 'Acknowledged', color: colors.warning, bgColor: colors.warning + '15', icon: 'clock-outline' as const };
      case 'resolved':
        return { label: 'Resolved', color: colors.success, bgColor: colors.success + '15', icon: 'check-circle' as const };
      default:
        return { label: state, color: colors.textSecondary, bgColor: colors.surfaceSecondary, icon: 'help-circle' as const };
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'trigger':
        return 'Created';
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
      <ScrollView style={themedStyles.scrollView}>
        {/* Header Card */}
        <Card style={dynamicStyles.card} mode="elevated">
          <Card.Content>
            {/* Severity and Status with Duration */}
            <View style={themedStyles.headerBadges}>
              <Chip
                style={[themedStyles.severityChip, { backgroundColor: getSeverityColor(incident.severity) }]}
                textStyle={themedStyles.severityChipText}
                icon={() => (
                  <MaterialCommunityIcons name="alert-octagon" size={16} color="#fff" />
                )}
              >
                {incident.severity.toUpperCase()}
              </Chip>
              {/* Enhanced status badge with duration */}
              {(() => {
                const statusConfig = getStatusConfig(incident.state);
                const duration = getStateDuration();
                return (
                  <View style={[themedStyles.statusBadgeEnhanced, { backgroundColor: statusConfig.bgColor, borderColor: statusConfig.color }]}>
                    <MaterialCommunityIcons name={statusConfig.icon} size={14} color={statusConfig.color} />
                    <Text style={[themedStyles.statusBadgeLabel, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                    {duration && (
                      <Text style={[themedStyles.statusBadgeDuration, { color: statusConfig.color }]}>
                        ({duration})
                      </Text>
                    )}
                  </View>
                );
              })()}
            </View>

            {/* Incident Number and Title */}
            <Text variant="labelMedium" style={themedStyles.incidentNumber}>
              #{incident.incidentNumber}
            </Text>
            <Text variant="headlineSmall" style={themedStyles.title}>
              {incident.summary}
            </Text>

            {/* Owner Section - shows who is handling the incident */}
            <View style={themedStyles.ownerSection}>
              {incident.acknowledgedBy ? (
                <View style={themedStyles.ownerContainer}>
                  <View style={[themedStyles.ownerAvatarRing, { borderColor: colors.warning }]}>
                    <OwnerAvatar
                      name={incident.acknowledgedBy.fullName || ''}
                      email={incident.acknowledgedBy.email || ''}
                      size={36}
                    />
                  </View>
                  <View style={themedStyles.ownerInfo}>
                    <Text variant="bodyMedium" style={themedStyles.ownerName}>
                      {incident.acknowledgedBy.fullName}
                    </Text>
                    <Text variant="bodySmall" style={themedStyles.ownerLabel}>
                      Owner
                    </Text>
                  </View>
                </View>
              ) : incident.state === 'triggered' ? (
                <View style={themedStyles.unassignedContainer}>
                  <MaterialCommunityIcons name="account-alert" size={20} color={colors.error} />
                  <Text style={[themedStyles.unassignedText, { color: colors.error }]}>
                    Unassigned - Needs attention
                  </Text>
                </View>
              ) : null}
            </View>

            <Divider style={themedStyles.divider} />

            {/* Meta Information */}
            <View style={themedStyles.metaRow}>
              <MaterialCommunityIcons name="server" size={18} color={colors.textSecondary} />
              <Text variant="bodyMedium" style={themedStyles.metaLabel}>Service</Text>
              <Text variant="bodyMedium" style={themedStyles.metaValue}>{incident.service.name}</Text>
            </View>

            {/* Service Health Context */}
            <ServiceHealthBadge
              serviceId={incident.service.id}
              serviceName={incident.service.name}
            />

            <View style={themedStyles.metaRow}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={colors.textSecondary} />
              <Text variant="bodyMedium" style={themedStyles.metaLabel}>Created</Text>
              <Text variant="bodyMedium" style={themedStyles.metaValue}>{formatDate(incident.triggeredAt)}</Text>
            </View>

            {incident.acknowledgedAt && (
              <View style={themedStyles.metaRow}>
                <MaterialCommunityIcons name="check" size={18} color={colors.warning} />
                <Text variant="bodyMedium" style={themedStyles.metaLabel}>Acknowledged</Text>
                <Text variant="bodyMedium" style={themedStyles.metaValue}>{formatDate(incident.acknowledgedAt)}</Text>
              </View>
            )}

            {incident.resolvedAt && (
              <View style={themedStyles.metaRow}>
                <MaterialCommunityIcons name="check-all" size={18} color={colors.success} />
                <Text variant="bodyMedium" style={themedStyles.metaLabel}>Resolved</Text>
                <Text variant="bodyMedium" style={themedStyles.metaValue}>{formatDate(incident.resolvedAt)}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Similar Incident Hint - Prominent, above the fold */}
        {!loadingDetails && incident.state !== 'resolved' && (
          <SimilarIncidentHint
            currentIncident={incident}
            onViewIncident={(similar) => {
              // Navigate to the similar incident
              navigation.push('AlertDetail', {
                alert: {
                  id: similar.id,
                  incidentNumber: similar.incidentNumber,
                  summary: similar.summary,
                  severity: similar.severity,
                  state: similar.state,
                  triggeredAt: similar.triggeredAt,
                  service: incident.service, // Same service
                } as any,
              });
            }}
          />
        )}

        {/* Loading Skeletons */}
        {loadingDetails && (
          <>
            {/* Owner/Responders Skeleton */}
            <Card style={dynamicStyles.card} mode="elevated">
              <Card.Content>
                <View style={themedStyles.sectionHeader}>
                  <SkeletonBox width={20} height={20} bgColor={colors.border} />
                  <SkeletonBox width={100} height={18} style={{ marginLeft: 8 }} bgColor={colors.border} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                  <SkeletonBox width={40} height={40} style={{ borderRadius: 20 }} bgColor={colors.border} />
                  <View style={{ marginLeft: 12 }}>
                    <SkeletonBox width={120} height={16} bgColor={colors.border} />
                    <SkeletonBox width={80} height={12} style={{ marginTop: 4 }} bgColor={colors.border} />
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Timeline Skeleton */}
            <Card style={dynamicStyles.card} mode="elevated">
              <Card.Content>
                <View style={themedStyles.sectionHeader}>
                  <SkeletonBox width={20} height={20} bgColor={colors.border} />
                  <SkeletonBox width={80} height={18} style={{ marginLeft: 8 }} bgColor={colors.border} />
                </View>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={{ flexDirection: 'row', marginTop: 16 }}>
                    <SkeletonBox width={32} height={32} style={{ borderRadius: 16 }} bgColor={colors.border} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <SkeletonBox width={100} height={14} bgColor={colors.border} />
                      <SkeletonBox width={150} height={12} style={{ marginTop: 6 }} bgColor={colors.border} />
                      <SkeletonBox width={80} height={10} style={{ marginTop: 6 }} bgColor={colors.border} />
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>

            {/* Runbook Skeleton */}
            <Card style={dynamicStyles.card} mode="elevated">
              <Card.Content>
                <View style={themedStyles.sectionHeader}>
                  <SkeletonBox width={20} height={20} bgColor={colors.border} />
                  <SkeletonBox width={120} height={18} style={{ marginLeft: 8 }} bgColor={colors.border} />
                </View>
                {[1, 2].map((i) => (
                  <View key={i} style={{ marginTop: 12, padding: 12, backgroundColor: colors.surfaceSecondary, borderRadius: 8 }}>
                    <SkeletonBox width="80%" height={16} bgColor={colors.border} />
                    <SkeletonBox width="60%" height={12} style={{ marginTop: 8 }} bgColor={colors.border} />
                  </View>
                ))}
              </Card.Content>
            </Card>
          </>
        )}

        {/* Details Card */}
        {!loadingDetails && incident.details && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <View style={themedStyles.sectionHeader}>
                <MaterialCommunityIcons name="code-json" size={20} color={theme.colors.primary} />
                <Text variant="titleMedium" style={themedStyles.sectionTitle}>Details</Text>
              </View>
              <Surface style={themedStyles.detailSurface} elevation={0}>
                <Text variant="bodySmall" style={themedStyles.detailText}>
                  {JSON.stringify(incident.details, null, 2)}
                </Text>
              </Surface>
            </Card.Content>
          </Card>
        )}

        {/* AI Diagnosis Section */}
        {!loadingDetails && !diagnosis && !diagnosisLoading && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <View style={themedStyles.diagnoseButtonContainer}>
                <View style={themedStyles.diagnoseInfo}>
                  <MaterialCommunityIcons name="robot" size={24} color={colors.accent} />
                  <View style={themedStyles.diagnoseTextContainer}>
                    <Text variant="titleSmall" style={themedStyles.diagnoseTitle}>
                      Need help troubleshooting?
                    </Text>
                    <Text variant="bodySmall" style={themedStyles.diagnoseSubtitle}>
                      AI can analyze logs, metrics, and history
                    </Text>
                  </View>
                </View>
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('AIChat', { incident })}
                  icon="robot-outline"
                  buttonColor={colors.accent}
                  style={themedStyles.diagnoseButton}
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
            onSendAsNote={handleSendDiagnosisAsNote}
            sendingNote={sendingDiagnosisNote}
          />
        )}

        {/* Runbook Card */}
        {runbook && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <Pressable
                onPress={() => setShowRunbook(!showRunbook)}
                style={themedStyles.runbookHeader}
              >
                <View style={themedStyles.sectionHeader}>
                  <MaterialCommunityIcons name="book-open-variant" size={20} color={colors.accent} />
                  <Text variant="titleMedium" style={themedStyles.sectionTitle}>Runbook</Text>
                </View>
                <View style={themedStyles.runbookProgress}>
                  <Text variant="labelSmall" style={themedStyles.runbookProgressText}>
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
              <View style={themedStyles.progressBarContainer}>
                <View
                  style={[
                    themedStyles.progressBar,
                    { width: `${(completedSteps.length / runbook.steps.length) * 100}%` },
                  ]}
                />
              </View>

              {showRunbook && (
                <>
                  <Text variant="bodySmall" style={themedStyles.runbookDescription}>
                    {runbook.description}
                  </Text>

                  {/* Runbook Metadata */}
                  {(runbook.author || runbook.lastUpdated || (runbook.tags && runbook.tags.length > 0)) && (
                    <View style={themedStyles.runbookMeta}>
                      <View style={themedStyles.runbookMetaRow}>
                        {runbook.author && (
                          <Text variant="bodySmall" style={themedStyles.runbookMetaText}>
                            By {runbook.author.fullName}
                          </Text>
                        )}
                        {runbook.author && runbook.lastUpdated && (
                          <Text style={themedStyles.runbookMetaSeparator}> • </Text>
                        )}
                        {runbook.lastUpdated && (
                          <Text variant="bodySmall" style={themedStyles.runbookMetaText}>
                            Updated {new Date(runbook.lastUpdated).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                      {runbook.tags && runbook.tags.length > 0 && (
                        <View style={themedStyles.runbookTagsRow}>
                          {runbook.tags.slice(0, 5).map((tag, idx) => (
                            <Text key={idx} style={themedStyles.runbookTagText}>#{tag}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Runbook Steps */}
                  <View style={themedStyles.runbookSteps}>
                    {runbook.steps.map((step, index) => {
                      const isCompleted = completedSteps.includes(step.id);
                      const canToggle = incident.state !== 'resolved';
                      const hasAction = !!step.action;
                      const actionState = actionStates[step.id];

                      return (
                        <View
                          key={step.id}
                          style={[
                            themedStyles.runbookStep,
                            actionState?.status === 'success' && themedStyles.runbookStepSuccess,
                            actionState?.status === 'error' && themedStyles.runbookStepError,
                          ]}
                        >
                          <View style={themedStyles.runbookStepHeader}>
                            {/* Checkbox for non-action steps */}
                            {!hasAction && (
                              <Pressable
                                style={themedStyles.runbookStepCheckbox}
                                onPress={() => canToggle && toggleStepCompleted(step.id)}
                                disabled={!canToggle}
                              >
                                <Checkbox
                                  status={isCompleted ? 'checked' : 'unchecked'}
                                  color={colors.success}
                                  onPress={() => canToggle && toggleStepCompleted(step.id)}
                                  disabled={!canToggle}
                                />
                              </Pressable>
                            )}

                            {/* Step content */}
                            <View style={[themedStyles.runbookStepContent, hasAction && themedStyles.runbookStepContentWithAction]}>
                              <Text
                                variant="titleSmall"
                                style={[
                                  themedStyles.runbookStepTitle,
                                  isCompleted && themedStyles.runbookStepCompleted,
                                ]}
                              >
                                {index + 1}. {step.title}
                                {step.isOptional && (
                                  <Text style={themedStyles.optionalBadgeInline}> (Optional)</Text>
                                )}
                              </Text>
                              <Text
                                variant="bodySmall"
                                style={[
                                  themedStyles.runbookStepDescription,
                                  isCompleted && themedStyles.runbookStepCompleted,
                                ]}
                              >
                                {step.description}
                              </Text>
                              {step.estimatedMinutes != null && !isCompleted && (
                                <View style={themedStyles.runbookStepMeta}>
                                  <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textMuted} />
                                  <Text variant="labelSmall" style={themedStyles.runbookStepTime}>
                                    ~{step.estimatedMinutes} min
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* Action button or completed check for action steps */}
                            {hasAction && step.action && (
                              <View style={themedStyles.runbookActionContainer}>
                                {actionState?.status === 'executing' ? (
                                  <Button
                                    mode="contained"
                                    disabled
                                    loading
                                    compact
                                    style={themedStyles.runbookActionButton}
                                  >
                                    Running
                                  </Button>
                                ) : actionState?.status === 'success' ? (
                                  <Button
                                    mode="outlined"
                                    disabled
                                    compact
                                    icon="check"
                                    style={themedStyles.runbookActionButton}
                                    textColor={colors.success}
                                  >
                                    Done
                                  </Button>
                                ) : isCompleted ? (
                                  <Button
                                    mode="outlined"
                                    compact
                                    icon="check"
                                    style={themedStyles.runbookActionButton}
                                    textColor={colors.success}
                                    onPress={() => canToggle && executeAction(step.id, step.action!)}
                                    disabled={!canToggle}
                                  >
                                    Redo
                                  </Button>
                                ) : (
                                  <Button
                                    mode="contained"
                                    compact
                                    icon="play"
                                    style={themedStyles.runbookActionButton}
                                    buttonColor={colors.accent}
                                    onPress={() => canToggle && executeAction(step.id, step.action!)}
                                    disabled={!canToggle}
                                  >
                                    {step.action.label}
                                  </Button>
                                )}
                              </View>
                            )}
                          </View>

                          {/* Confirmation prompt */}
                          {actionState?.status === 'confirming' && step.action && (
                            <View style={themedStyles.runbookConfirmContainer}>
                              <Text variant="bodySmall" style={themedStyles.runbookConfirmText}>
                                {actionState.message}
                              </Text>
                              <View style={themedStyles.runbookConfirmButtons}>
                                <Button
                                  mode="contained"
                                  compact
                                  buttonColor="#C53030"
                                  onPress={() => executeAction(step.id, step.action!)}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  mode="outlined"
                                  compact
                                  onPress={() => cancelActionConfirmation(step.id)}
                                >
                                  Cancel
                                </Button>
                              </View>
                            </View>
                          )}

                          {/* Error message */}
                          {actionState?.status === 'error' && (
                            <View style={themedStyles.runbookErrorContainer}>
                              <Text variant="bodySmall" style={themedStyles.runbookErrorText}>
                                {actionState.message}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* External Link */}
                  {runbook.externalUrl && (
                    <Button
                      mode="outlined"
                      icon="open-in-new"
                      onPress={() => Linking.openURL(runbook.externalUrl!)}
                      style={themedStyles.externalLinkButton}
                    >
                      View Full Runbook
                    </Button>
                  )}
                </>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Related Incidents - right after Runbooks */}
        <RelatedIncidents
          currentIncident={incident}
          onIncidentPress={(relatedIncident) => {
            navigation.push('AlertDetail', { alert: relatedIncident });
          }}
        />

        {/* Responders Card - only show if there's content */}
        {!loadingDetails && incident.acknowledgedBy && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <RespondersSection
                responders={[]}
                acknowledgedBy={incident.acknowledgedBy}
              />
            </Card.Content>
          </Card>
        )}

        {/* Notification Status Card */}
        {!loadingDetails && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <Pressable
                onPress={() => setShowNotifications(!showNotifications)}
                style={themedStyles.notificationHeader}
              >
                <View style={themedStyles.sectionHeader}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={20} color={theme.colors.primary} />
                  <Text variant="titleMedium" style={themedStyles.sectionTitle}>Notification Status</Text>
                </View>
                <View style={themedStyles.notificationHeaderRight}>
                  {notificationSummary && (
                    <View style={themedStyles.notificationSummaryChips}>
                      {notificationSummary.delivered > 0 && (
                        <Chip
                          compact
                          style={[themedStyles.summaryChip, { backgroundColor: colors.successLight }]}
                          textStyle={[themedStyles.summaryChipText, { color: colors.success }]}
                        >
                          {notificationSummary.delivered} delivered
                        </Chip>
                      )}
                      {notificationSummary.sent > 0 && (
                        <Chip
                          compact
                          style={[themedStyles.summaryChip, { backgroundColor: colors.infoLight }]}
                          textStyle={[themedStyles.summaryChipText, { color: colors.info }]}
                        >
                          {notificationSummary.sent} sent
                        </Chip>
                      )}
                      {notificationSummary.pending > 0 && (
                        <Chip
                          compact
                          style={[themedStyles.summaryChip, { backgroundColor: colors.warningLight }]}
                          textStyle={[themedStyles.summaryChipText, { color: colors.warning }]}
                        >
                          {notificationSummary.pending} pending
                        </Chip>
                      )}
                      {notificationSummary.failed > 0 && (
                        <Chip
                          compact
                          style={[themedStyles.summaryChip, { backgroundColor: '#FED7D7' }]}
                          textStyle={[themedStyles.summaryChipText, { color: '#C53030' }]}
                        >
                          {notificationSummary.failed} failed
                        </Chip>
                      )}
                    </View>
                  )}
                  <MaterialCommunityIcons
                    name={showNotifications ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>

              {showNotifications && (
                <>
                  {loadingNotifications ? (
                    <View style={themedStyles.notificationLoading}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text variant="bodySmall" style={themedStyles.notificationLoadingText}>
                        Loading notification status...
                      </Text>
                    </View>
                  ) : notifications.length === 0 ? (
                    <Text variant="bodyMedium" style={themedStyles.noNotificationsText}>
                      No notifications sent yet
                    </Text>
                  ) : (
                    <View style={themedStyles.notificationsList}>
                      {notifications.map((userNotif) => (
                        <View key={userNotif.userId} style={themedStyles.notificationUserCard}>
                          <View style={themedStyles.notificationUserHeader}>
                            <View style={themedStyles.notificationUserAvatar}>
                              <Text style={themedStyles.notificationUserAvatarText}>
                                {userNotif.userName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={themedStyles.notificationUserInfo}>
                              <Text variant="titleSmall" style={themedStyles.notificationUserName}>
                                {userNotif.userName}
                              </Text>
                              <Text variant="bodySmall" style={themedStyles.notificationUserEmail}>
                                {userNotif.userEmail}
                              </Text>
                            </View>
                          </View>
                          <View style={themedStyles.notificationChannels}>
                            {userNotif.channels.map((channel, idx) => {
                              const getChannelIcon = (ch: string): keyof typeof MaterialCommunityIcons.glyphMap => {
                                switch (ch) {
                                  case 'push': return 'cellphone';
                                  case 'email': return 'email-outline';
                                  case 'sms': return 'message-text-outline';
                                  case 'voice': return 'phone-outline';
                                  default: return 'bell-outline';
                                }
                              };
                              const getStatusStyle = (status: string) => {
                                switch (status) {
                                  case 'delivered': return { bg: colors.successLight, text: colors.success, icon: 'check' };
                                  case 'sent': return { bg: colors.infoLight, text: colors.info, icon: 'arrow-top-right' };
                                  case 'pending': return { bg: colors.warningLight, text: colors.warning, icon: 'clock-outline' };
                                  case 'failed': return { bg: '#FED7D7', text: '#C53030', icon: 'close' };
                                  default: return { bg: colors.surfaceSecondary, text: colors.textSecondary, icon: 'help' };
                                }
                              };
                              const statusStyle = getStatusStyle(channel.status);
                              return (
                                <View
                                  key={idx}
                                  style={[themedStyles.notificationChannel, { backgroundColor: statusStyle.bg }]}
                                >
                                  <MaterialCommunityIcons
                                    name={getChannelIcon(channel.channel)}
                                    size={14}
                                    color={statusStyle.text}
                                  />
                                  <Text style={[themedStyles.notificationChannelText, { color: statusStyle.text }]}>
                                    {channel.channel}
                                  </Text>
                                  <MaterialCommunityIcons
                                    name={statusStyle.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                                    size={14}
                                    color={statusStyle.text}
                                  />
                                </View>
                              );
                            })}
                          </View>
                          {/* Show error messages */}
                          {userNotif.channels.some(c => c.errorMessage) && (
                            <View style={themedStyles.notificationErrors}>
                              {userNotif.channels
                                .filter(c => c.errorMessage)
                                .map((c, idx) => (
                                  <Text key={idx} variant="bodySmall" style={themedStyles.notificationErrorText}>
                                    {c.channel}: {c.errorMessage}
                                  </Text>
                                ))}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Timeline Card */}
        {!loadingDetails && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <View style={themedStyles.sectionHeader}>
                <MaterialCommunityIcons name="timeline-clock-outline" size={20} color={theme.colors.primary} />
                <Text variant="titleMedium" style={themedStyles.sectionTitle}>Timeline</Text>
              </View>

            {events.length > 0 ? (
              <View style={themedStyles.timeline}>
                {events.map((event, index) => {
                  const { icon, color } = getEventIcon(event.type);
                  return (
                    <View key={event.id} style={themedStyles.timelineItem}>
                      <View style={themedStyles.timelineLeft}>
                        <View style={[themedStyles.timelineIcon, { backgroundColor: color }]}>
                          <MaterialCommunityIcons name={icon} size={16} color="#fff" />
                        </View>
                        {index < events.length - 1 && <View style={dynamicStyles.timelineLine} />}
                      </View>
                      <View style={themedStyles.timelineContent}>
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
              <Text variant="bodyMedium" style={themedStyles.noEventsText}>
                No timeline events
              </Text>
            )}
            </Card.Content>
          </Card>
        )}

        {/* Add Note Card */}
        {!loadingDetails && incident.state !== 'resolved' && (
          <Card style={dynamicStyles.card} mode="elevated">
            <Card.Content>
              <View style={themedStyles.sectionHeader}>
                <MaterialCommunityIcons name="note-plus" size={20} color={theme.colors.primary} />
                <Text variant="titleMedium" style={themedStyles.sectionTitle}>Add Note</Text>
              </View>
              <TextInput
                mode="outlined"
                placeholder="Add a note to this incident..."
                value={noteText}
                onChangeText={setNoteText}
                multiline
                numberOfLines={3}
                style={dynamicStyles.noteInput}
                outlineStyle={themedStyles.noteInputOutline}
              />
              <Button
                mode="contained"
                onPress={handleAddNote}
                loading={addingNote}
                disabled={!noteText.trim() || addingNote}
                style={themedStyles.noteButton}
                icon="send"
              >
                Add Note
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Resolved Notice */}
        {incident.state === 'resolved' && (
          <Surface style={themedStyles.resolvedNotice} elevation={0}>
            <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
            <View style={themedStyles.resolvedTextContainer}>
              <Text variant="titleSmall" style={themedStyles.resolvedText}>
                This incident has been resolved
              </Text>
              {incident.resolvedBy && (
                <Text variant="bodySmall" style={themedStyles.resolvedBy}>
                  By {incident.resolvedBy.fullName}
                </Text>
              )}
            </View>
          </Surface>
        )}

        {/* Admin Actions */}
        {currentUserProfile?.role === 'admin' && (
          <Card style={[dynamicStyles.card, themedStyles.dangerCard]} mode="elevated">
            <Card.Content>
              <View style={themedStyles.sectionHeader}>
                <MaterialCommunityIcons name="shield-account" size={20} color="#C53030" />
                <Text variant="titleMedium" style={[themedStyles.sectionTitle, { color: '#C53030' }]}>
                  Admin Actions
                </Text>
              </View>
              <Button
                mode="contained"
                buttonColor="#C53030"
                onPress={() => setShowDeleteModal(true)}
                icon="delete"
                style={themedStyles.deleteButton}
              >
                Delete Incident
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Bottom padding to account for sticky action bar - always show since all states have actions */}
        <View style={themedStyles.bottomPaddingWithActions} />
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
              label: 'False Alarm',
              icon: 'shield-check',
              onPress: handleFalseAlarm,
              mode: 'outlined',
              color: colors.textSecondary,
              loading: actionLoading,
            },
            {
              label: 'Resolve',
              icon: 'check-all',
              onPress: () => setShowResolveModal(true),
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
              onPress: () => setShowResolveModal(true),
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
          contentContainerStyle={themedStyles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <MaterialCommunityIcons name="arrow-up-circle" size={48} color={colors.accent} />
            <Text variant="titleLarge" style={themedStyles.modalTitle}>
              Escalate Incident?
            </Text>
            <Text variant="bodyMedium" style={themedStyles.modalDescription}>
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
            <View style={themedStyles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => { setShowEscalateModal(false); setEscalateReason(''); }}
                style={themedStyles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleEscalate}
                buttonColor={colors.accent}
                style={themedStyles.modalButton}
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
          contentContainerStyle={themedStyles.reassignModalContainer}
        >
          <View style={dynamicStyles.reassignModalContent}>
            <View style={themedStyles.reassignModalHeader}>
              <MaterialCommunityIcons name="account-switch" size={32} color={colors.accent} />
              <Text variant="titleLarge" style={themedStyles.modalTitle}>
                Reassign Incident
              </Text>
            </View>

            <Text variant="bodyMedium" style={themedStyles.reassignSubtitle}>
              Select a team member to reassign this incident to:
            </Text>

            {loadingUsers ? (
              <View style={themedStyles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={themedStyles.userList}>
                {users.map((user) => (
                  <Pressable
                    key={user.id}
                    style={[
                      themedStyles.userItem,
                      selectedUserId === user.id && themedStyles.userItemSelected,
                    ]}
                    onPress={() => setSelectedUserId(user.id)}
                  >
                    <OwnerAvatar name={user.fullName} email={user.email} size={40} />
                    <View style={themedStyles.userItemInfo}>
                      <Text variant="titleSmall" style={themedStyles.userItemName}>
                        {user.fullName}
                      </Text>
                      <Text variant="bodySmall" style={themedStyles.userItemEmail}>
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

            <View style={themedStyles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => { setShowReassignModal(false); setSelectedUserId(null); setReassignReason(''); }}
                style={themedStyles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleReassign}
                buttonColor={colors.accent}
                style={themedStyles.modalButton}
                disabled={!selectedUserId}
              >
                Reassign
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Resolve Templates Modal (Legacy) */}
      <ResolveTemplatesModal
        visible={showResolveTemplates}
        onDismiss={() => setShowResolveTemplates(false)}
        onSelectTemplate={handleResolveWithTemplate}
      />

      {/* Enhanced Resolve Modal with Required Fields */}
      <ResolveIncidentModal
        visible={showResolveModal}
        onDismiss={() => setShowResolveModal(false)}
        onResolve={handleResolveWithData}
        loading={actionLoading}
        incidentTitle={incident.summary}
      />

      {/* Delete Confirmation Modal */}
      <Portal>
        <Modal
          visible={showDeleteModal}
          onDismiss={() => setShowDeleteModal(false)}
          contentContainerStyle={themedStyles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <MaterialCommunityIcons name="delete-alert" size={48} color="#C53030" />
            <Text variant="titleLarge" style={themedStyles.modalTitle}>
              Delete Incident?
            </Text>
            <Text variant="bodyMedium" style={themedStyles.modalDescription}>
              Are you sure you want to delete incident #{incident.incidentNumber}? This action cannot be undone and will remove all associated timeline events and notes.
            </Text>
            <View style={themedStyles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowDeleteModal(false)}
                style={themedStyles.modalButton}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleDelete}
                buttonColor="#C53030"
                style={themedStyles.modalButton}
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
          contentContainerStyle={themedStyles.modalContainer}
        >
          <View style={dynamicStyles.reassignModalContent}>
            <View style={themedStyles.reassignModalHeader}>
              <MaterialCommunityIcons name="key-variant" size={32} color={theme.colors.secondary} />
              <Text variant="titleLarge" style={themedStyles.modalTitle}>
                Set Up AI Diagnosis
              </Text>
            </View>

            <Text variant="bodyMedium" style={themedStyles.reassignSubtitle}>
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

            <Text variant="bodySmall" style={themedStyles.apiKeyHint}>
              Get your API key from console.anthropic.com
            </Text>

            <View style={themedStyles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => { setShowApiKeyModal(false); setApiKeyInput(''); }}
                style={themedStyles.modalButton}
                disabled={savingApiKey}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveApiKey}
                buttonColor={theme.colors.secondary}
                style={themedStyles.modalButton}
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

const styles = (colors: any) => StyleSheet.create({
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
    borderColor: '#C5303040',
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
  statusBadgeEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  statusBadgeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeDuration: {
    fontSize: 11,
    opacity: 0.8,
  },
  ownerSection: {
    marginTop: 12,
    marginBottom: 4,
  },
  ownerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ownerAvatarRing: {
    borderWidth: 2,
    borderRadius: 22,
    padding: 2,
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  ownerLabel: {
    color: colors.textSecondary,
    marginTop: 1,
  },
  unassignedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.error + '10',
    borderRadius: 8,
  },
  unassignedText: {
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  runbookMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  runbookMetaText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  runbookMetaSeparator: {
    color: colors.textMuted,
    fontSize: 13,
  },
  runbookTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  runbookTagText: {
    fontSize: 12,
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
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    borderRadius: 8,
    marginBottom: 4,
  },
  runbookStepSuccess: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  runbookStepError: {
    backgroundColor: '#FED7D7',
    borderColor: '#C53030',
  },
  runbookStepHeader: {
    flexDirection: 'row',
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
  runbookStepContentWithAction: {
    paddingRight: 8,
  },
  runbookActionContainer: {
    flexShrink: 0,
    marginLeft: 8,
  },
  runbookActionButton: {
    minWidth: 90,
  },
  runbookConfirmContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FAF089',
    borderRadius: 8,
  },
  runbookConfirmText: {
    color: colors.textPrimary,
    marginBottom: 8,
  },
  runbookConfirmButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  runbookErrorContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FED7D7',
    borderRadius: 6,
  },
  runbookErrorText: {
    color: '#C53030',
  },
  runbookStepTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
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
  optionalBadgeInline: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '400',
    fontStyle: 'italic',
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
  // Notification Status styles
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationSummaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  summaryChip: {
    height: 24,
  },
  summaryChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  notificationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  notificationLoadingText: {
    color: colors.textSecondary,
  },
  noNotificationsText: {
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  notificationsList: {
    marginTop: 12,
    gap: 12,
  },
  notificationUserCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: 12,
  },
  notificationUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  notificationUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationUserAvatarText: {
    color: colors.info,
    fontSize: 14,
    fontWeight: '600',
  },
  notificationUserInfo: {
    marginLeft: 10,
    flex: 1,
  },
  notificationUserName: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  notificationUserEmail: {
    color: colors.textSecondary,
  },
  notificationChannels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  notificationChannel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  notificationChannelText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  notificationErrors: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  notificationErrorText: {
    color: '#C53030',
    fontSize: 12,
  },
});
