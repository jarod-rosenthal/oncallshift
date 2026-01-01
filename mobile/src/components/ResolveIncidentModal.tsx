import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, Modal, Portal, Button, TextInput, Switch, RadioButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

// Root cause options for categorization
export const ROOT_CAUSE_OPTIONS = [
  { id: 'configuration', label: 'Configuration Change', icon: 'cog' as const },
  { id: 'deployment', label: 'Deployment/Release', icon: 'rocket-launch' as const },
  { id: 'capacity', label: 'Capacity/Scaling', icon: 'arrow-expand-all' as const },
  { id: 'external_dependency', label: 'External Dependency', icon: 'cloud-outline' as const },
  { id: 'infrastructure', label: 'Infrastructure Issue', icon: 'server' as const },
  { id: 'code_bug', label: 'Code Bug', icon: 'bug' as const },
  { id: 'false_alarm', label: 'False Alarm', icon: 'shield-check' as const },
  { id: 'transient', label: 'Transient/Self-Resolved', icon: 'lightning-bolt' as const },
  { id: 'unknown', label: 'Unknown/Under Investigation', icon: 'help-circle' as const },
];

export interface ResolutionData {
  rootCause: string;
  resolutionSummary: string;
  followUpRequired: boolean;
  followUpUrl?: string;
}

interface ResolveIncidentModalProps {
  visible: boolean;
  onDismiss: () => void;
  onResolve: (data: ResolutionData) => void;
  loading?: boolean;
  incidentTitle?: string;
}

export default function ResolveIncidentModal({
  visible,
  onDismiss,
  onResolve,
  loading = false,
  incidentTitle,
}: ResolveIncidentModalProps) {
  const { colors } = useAppTheme();

  // Form state
  const [rootCause, setRootCause] = useState<string>('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpUrl, setFollowUpUrl] = useState('');
  const [step, setStep] = useState<'root_cause' | 'details'>('root_cause');

  const resetForm = () => {
    setRootCause('');
    setResolutionSummary('');
    setFollowUpRequired(false);
    setFollowUpUrl('');
    setStep('root_cause');
  };

  const handleDismiss = () => {
    resetForm();
    onDismiss();
  };

  const handleRootCauseSelect = (causeId: string) => {
    setRootCause(causeId);
    setStep('details');
  };

  const handleBack = () => {
    setStep('root_cause');
  };

  const handleSubmit = () => {
    if (!rootCause || !resolutionSummary.trim()) return;

    onResolve({
      rootCause,
      resolutionSummary: resolutionSummary.trim(),
      followUpRequired,
      followUpUrl: followUpRequired ? followUpUrl.trim() : undefined,
    });
    resetForm();
  };

  const isValid = rootCause && resolutionSummary.trim().length >= 10;
  const selectedCause = ROOT_CAUSE_OPTIONS.find(c => c.id === rootCause);

  const themedStyles = {
    modalContainer: {
      ...styles.modalContainer,
      backgroundColor: colors.surface,
    },
    header: {
      ...styles.header,
      borderBottomColor: colors.border,
    },
    stepIndicator: {
      ...styles.stepIndicator,
      backgroundColor: colors.surfaceSecondary,
    },
    activeStep: {
      backgroundColor: colors.primary,
    },
    causeItem: {
      ...styles.causeItem,
      borderBottomColor: colors.border,
    },
    causeItemSelected: {
      backgroundColor: colors.primaryLight || colors.primary + '15',
    },
    causeIcon: {
      ...styles.causeIcon,
      backgroundColor: colors.surfaceSecondary,
    },
    causeIconSelected: {
      backgroundColor: colors.primary + '30',
    },
    selectedBadge: {
      ...styles.selectedBadge,
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    infoBox: {
      ...styles.infoBox,
      backgroundColor: colors.warningLight || colors.warning + '15',
      borderLeftColor: colors.warning,
    },
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={themedStyles.modalContainer}
      >
        {/* Header */}
        <View style={themedStyles.header}>
          <MaterialCommunityIcons name="check-decagram" size={28} color={colors.success} />
          <Text variant="titleLarge" style={[styles.title, { color: colors.textPrimary }]}>
            Resolve Incident
          </Text>
          {incidentTitle && (
            <Text variant="bodySmall" style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {incidentTitle}
            </Text>
          )}

          {/* Step indicator */}
          <View style={styles.stepRow}>
            <View style={[themedStyles.stepIndicator, step === 'root_cause' && themedStyles.activeStep]}>
              <Text style={{ color: step === 'root_cause' ? 'white' : colors.textMuted, fontSize: 12, fontWeight: '600' }}>1</Text>
            </View>
            <View style={[styles.stepLine, { backgroundColor: colors.border }]} />
            <View style={[themedStyles.stepIndicator, step === 'details' && themedStyles.activeStep]}>
              <Text style={{ color: step === 'details' ? 'white' : colors.textMuted, fontSize: 12, fontWeight: '600' }}>2</Text>
            </View>
          </View>
          <Text variant="bodySmall" style={{ color: colors.textSecondary, marginTop: 4 }}>
            {step === 'root_cause' ? 'What caused this incident?' : 'How was it resolved?'}
          </Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {step === 'root_cause' ? (
            /* Step 1: Root Cause Selection */
            <View style={styles.causeList}>
              {ROOT_CAUSE_OPTIONS.map((cause) => (
                <Pressable
                  key={cause.id}
                  style={[
                    themedStyles.causeItem,
                    rootCause === cause.id && themedStyles.causeItemSelected,
                  ]}
                  onPress={() => handleRootCauseSelect(cause.id)}
                >
                  <View style={[
                    themedStyles.causeIcon,
                    rootCause === cause.id && themedStyles.causeIconSelected,
                  ]}>
                    <MaterialCommunityIcons
                      name={cause.icon}
                      size={20}
                      color={rootCause === cause.id ? colors.primary : colors.textSecondary}
                    />
                  </View>
                  <Text
                    variant="bodyLarge"
                    style={{
                      flex: 1,
                      color: colors.textPrimary,
                      fontWeight: rootCause === cause.id ? '600' : '400',
                    }}
                  >
                    {cause.label}
                  </Text>
                  <RadioButton
                    value={cause.id}
                    status={rootCause === cause.id ? 'checked' : 'unchecked'}
                    onPress={() => handleRootCauseSelect(cause.id)}
                    color={colors.primary}
                  />
                </Pressable>
              ))}
            </View>
          ) : (
            /* Step 2: Resolution Details */
            <View style={styles.detailsForm}>
              {/* Selected root cause badge */}
              {selectedCause && (
                <View style={themedStyles.selectedBadge}>
                  <MaterialCommunityIcons name={selectedCause.icon} size={16} color={colors.primary} />
                  <Text variant="bodyMedium" style={{ color: colors.primary, marginLeft: 8 }}>
                    {selectedCause.label}
                  </Text>
                  <Pressable onPress={handleBack} style={styles.changeBadge}>
                    <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Change</Text>
                  </Pressable>
                </View>
              )}

              {/* Resolution Summary - Required */}
              <Text variant="labelLarge" style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                How was it resolved? <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <TextInput
                mode="outlined"
                placeholder="Describe what fixed the issue (min 10 characters)..."
                value={resolutionSummary}
                onChangeText={setResolutionSummary}
                multiline
                numberOfLines={4}
                style={styles.textInput}
                error={resolutionSummary.length > 0 && resolutionSummary.length < 10}
              />
              {resolutionSummary.length > 0 && resolutionSummary.length < 10 && (
                <Text variant="bodySmall" style={{ color: colors.error, marginTop: 4 }}>
                  Please provide at least 10 characters
                </Text>
              )}

              {/* Follow-up toggle */}
              <View style={styles.followUpRow}>
                <View style={styles.followUpLabel}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={colors.textSecondary} />
                  <Text variant="bodyLarge" style={{ color: colors.textPrimary, marginLeft: 8 }}>
                    Follow-up needed?
                  </Text>
                </View>
                <Switch
                  value={followUpRequired}
                  onValueChange={setFollowUpRequired}
                  color={colors.primary}
                />
              </View>

              {followUpRequired && (
                <>
                  <TextInput
                    mode="outlined"
                    label="Ticket/Issue URL (optional)"
                    placeholder="https://jira.example.com/browse/..."
                    value={followUpUrl}
                    onChangeText={setFollowUpUrl}
                    style={styles.textInput}
                    left={<TextInput.Icon icon="link" />}
                  />
                  <View style={themedStyles.infoBox}>
                    <MaterialCommunityIcons name="information" size={16} color={colors.warning} />
                    <Text variant="bodySmall" style={{ color: colors.textSecondary, marginLeft: 8, flex: 1 }}>
                      Creating a follow-up ticket helps prevent recurring incidents
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* Actions */}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          {step === 'details' && (
            <Button
              mode="outlined"
              onPress={handleBack}
              style={styles.actionButton}
              icon="arrow-left"
            >
              Back
            </Button>
          )}
          <Button
            mode="text"
            onPress={handleDismiss}
            textColor={colors.textSecondary}
            style={styles.actionButton}
          >
            Cancel
          </Button>
          {step === 'details' && (
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!isValid || loading}
              loading={loading}
              buttonColor={colors.success}
              style={[styles.actionButton, { flex: 1 }]}
              icon="check"
            >
              Resolve
            </Button>
          )}
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    borderRadius: 16,
    maxHeight: '85%',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontWeight: '600',
    marginTop: 8,
  },
  subtitle: {
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  stepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
  },
  scrollView: {
    maxHeight: 400,
  },
  causeList: {
    paddingVertical: 8,
  },
  causeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  causeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailsForm: {
    padding: 16,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  changeBadge: {
    marginLeft: 'auto',
    paddingLeft: 12,
  },
  fieldLabel: {
    marginBottom: 8,
    fontWeight: '600',
  },
  textInput: {
    marginBottom: 16,
  },
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  followUpLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    borderRadius: 8,
  },
});
