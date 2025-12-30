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
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as apiService from '../services/apiService';
import * as runbookService from '../services/runbookService';
import type { Incident, IncidentEvent } from '../services/apiService';
import type { Runbook, RunbookStep } from '../services/runbookService';
import { severityColors, statusColors, colors } from '../theme';
import * as hapticService from '../services/hapticService';
import { RespondersSection, StickyActionBar, useToast, toastMessages } from '../components';

export default function AlertDetailScreen({ route, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useToast();
  const { alert: initialIncident } = route.params as { alert: Incident };
  const [incident, setIncident] = useState<Incident>(initialIncident);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [runbook, setRunbook] = useState<Runbook | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [showRunbook, setShowRunbook] = useState(true);
  const [showEscalateModal, setShowEscalateModal] = useState(false);

  useEffect(() => {
    fetchIncidentDetails();
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
      // Try to find runbook from API
      const rb = await runbookService.findRunbookForIncident(serviceId, severity);
      if (rb) {
        setRunbook(rb);
      } else {
        // Use mock runbook for demo
        setRunbook(runbookService.getMockRunbook(serviceId, serviceName));
      }
    } catch (error) {
      console.error('Error fetching runbook:', error);
      // Use mock runbook as fallback
      setRunbook(runbookService.getMockRunbook(serviceId, serviceName));
    }
  };

  const toggleStepCompleted = async (stepId: string) => {
    await hapticService.lightTap();
    if (completedSteps.includes(stepId)) {
      setCompletedSteps(completedSteps.filter(id => id !== stepId));
    } else {
      setCompletedSteps([...completedSteps, stepId]);
      // If all required steps completed, show success
      const requiredSteps = runbook?.steps.filter(s => !s.isOptional) || [];
      const newCompletedSteps = [...completedSteps, stepId];
      const allRequiredComplete = requiredSteps.every(s => newCompletedSteps.includes(s.id));
      if (allRequiredComplete && requiredSteps.length > 0) {
        await hapticService.success();
      }
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

  const handleResolve = async () => {
    setActionLoading(true);
    try {
      const result = await apiService.resolveIncident(incident.id);
      setIncident(result.incident);
      await hapticService.success();
      showSuccess(toastMessages.resolve);
      fetchIncidentDetails();
    } catch (error: any) {
      await hapticService.error();
      showError(error.message || 'Failed to resolve incident');
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
      // For now, escalation adds a note - in a full implementation this would call an escalate API
      await apiService.addIncidentNote(incident.id, 'Escalated to next responder');
      await hapticService.success();
      showSuccess(toastMessages.escalate);
      fetchIncidentDetails();
    } catch (error: any) {
      await hapticService.error();
      showError(error.message || 'Failed to escalate incident');
    } finally {
      setActionLoading(false);
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView style={styles.scrollView}>
        {/* Header Card */}
        <Card style={styles.card} mode="elevated">
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
          <Card style={styles.card} mode="elevated">
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

        {/* Runbook Card */}
        {runbook && (
          <Card style={styles.card} mode="elevated">
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
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <RespondersSection
              responders={[]}
              acknowledgedBy={incident.acknowledgedBy}
            />
          </Card.Content>
        </Card>

        {/* Timeline Card */}
        <Card style={styles.card} mode="elevated">
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
                        {index < events.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text variant="titleSmall" style={styles.timelineLabel}>
                          {getEventLabel(event.type)}
                        </Text>
                        {event.user && (
                          <Text variant="bodySmall" style={styles.timelineUser}>
                            by {event.user.fullName}
                          </Text>
                        )}
                        {event.message && (
                          <Surface style={styles.timelineMessage} elevation={0}>
                            <Text variant="bodySmall">{event.message}</Text>
                          </Surface>
                        )}
                        <Text variant="labelSmall" style={styles.timelineTime}>
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
          <Card style={styles.card} mode="elevated">
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
                style={styles.noteInput}
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
              onPress: handleResolve,
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
              label: 'Escalate',
              icon: 'arrow-up-circle',
              onPress: () => setShowEscalateModal(true),
              mode: 'outlined',
              color: colors.accent,
            },
            {
              label: 'Resolve',
              icon: 'check-all',
              onPress: handleResolve,
              color: colors.success,
              loading: actionLoading,
            },
          ]}
        />
      )}

      {/* Escalate Confirmation Modal */}
      <Portal>
        <Modal
          visible={showEscalateModal}
          onDismiss={() => setShowEscalateModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="arrow-up-circle" size={48} color={colors.accent} />
            <Text variant="titleLarge" style={styles.modalTitle}>
              Escalate Incident?
            </Text>
            <Text variant="bodyMedium" style={styles.modalDescription}>
              This will notify the next responder in the escalation policy for {incident.service.name}.
            </Text>
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowEscalateModal(false)}
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
    height: 120,
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
  runbookDescription: {
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  runbookSteps: {
    gap: 4,
  },
  runbookStep: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  runbookStepCheckbox: {
    marginRight: 4,
    marginTop: -8,
  },
  runbookStepContent: {
    flex: 1,
  },
  runbookStepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  runbookStepTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  runbookStepDescription: {
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
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
    height: 20,
  },
  optionalChipText: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 12,
  },
  externalLinkButton: {
    marginTop: 16,
    borderRadius: 8,
  },
});
