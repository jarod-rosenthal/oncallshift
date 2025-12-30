import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Surface,
  Chip,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as hapticService from '../services/hapticService';
import { colors } from '../theme';
import type { AIDiagnosisResponse, SuggestedAction } from '../services/apiService';

interface AIDiagnosisPanelProps {
  loading: boolean;
  diagnosis: AIDiagnosisResponse | null;
  error: string | null;
  onRetry: () => void;
  onActionPress?: (action: SuggestedAction) => void;
  onSendAsNote?: (noteText: string) => void;
  sendingNote?: boolean;
}

const getRiskColor = (risk: SuggestedAction['risk']) => {
  switch (risk) {
    case 'low':
      return colors.success;
    case 'medium':
      return colors.warning;
    case 'high':
      return colors.error;
    default:
      return colors.textSecondary;
  }
};

const getRiskIcon = (risk: SuggestedAction['risk']): keyof typeof MaterialCommunityIcons.glyphMap => {
  switch (risk) {
    case 'low':
      return 'shield-check';
    case 'medium':
      return 'shield-alert';
    case 'high':
      return 'shield-alert-outline';
    default:
      return 'shield';
  }
};

export const AIDiagnosisPanel: React.FC<AIDiagnosisPanelProps> = ({
  loading,
  diagnosis,
  error,
  onRetry,
  onActionPress,
  onSendAsNote,
  sendingNote = false,
}) => {
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const formatDiagnosisAsNote = (): string => {
    if (!diagnosis) return '';

    let note = `🤖 AI Diagnosis:\n\n${diagnosis.analysis}`;

    if (diagnosis.suggestedActions.length > 0) {
      note += '\n\n📋 Suggested Actions:';
      diagnosis.suggestedActions.forEach((action, index) => {
        note += `\n${index + 1}. ${action.action} (${action.risk} risk)`;
        note += `\n   Command: ${action.command}`;
      });
    }

    return note;
  };

  const handleSendAsNote = async () => {
    if (onSendAsNote && diagnosis) {
      await hapticService.mediumTap();
      onSendAsNote(formatDiagnosisAsNote());
    }
  };

  const handleCopyCommand = async (command: string) => {
    await Clipboard.setStringAsync(command);
    await hapticService.lightTap();
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const handleActionPress = async (action: SuggestedAction) => {
    await hapticService.mediumTap();
    if (onActionPress) {
      onActionPress(action);
    } else {
      await handleCopyCommand(action.command);
    }
  };

  if (loading) {
    return (
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text variant="titleMedium" style={styles.loadingTitle}>
              Analyzing Incident
            </Text>
            <Text variant="bodySmall" style={styles.loadingSubtitle}>
              AI is examining logs, metrics, and historical data...
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={48} color={colors.error} />
            <Text variant="titleMedium" style={styles.errorTitle}>
              Analysis Failed
            </Text>
            <Text variant="bodyMedium" style={styles.errorMessage}>
              {error}
            </Text>
            <Button mode="outlined" onPress={onRetry} style={styles.retryButton}>
              Try Again
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  }

  if (!diagnosis) {
    return null;
  }

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        {/* Header */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="robot" size={20} color={colors.accent} />
          <Text variant="titleMedium" style={styles.sectionTitle}>AI Diagnosis</Text>
          <Chip compact style={styles.betaChip} textStyle={styles.betaChipText}>
            Beta
          </Chip>
        </View>

        {/* Analysis */}
        <Surface style={styles.analysisSurface} elevation={0}>
          <Text variant="bodyMedium" style={styles.analysisText}>
            {diagnosis.analysis}
          </Text>
        </Surface>

        {/* Suggested Actions */}
        {diagnosis.suggestedActions.length > 0 && (
          <View style={styles.actionsSection}>
            <Text variant="titleSmall" style={styles.subSectionTitle}>
              Suggested Actions
            </Text>
            {diagnosis.suggestedActions.map((action, index) => (
              <Pressable
                key={index}
                style={styles.actionItem}
                onPress={() => handleActionPress(action)}
              >
                <View style={styles.actionHeader}>
                  <View style={styles.actionTitleRow}>
                    <MaterialCommunityIcons
                      name={getRiskIcon(action.risk)}
                      size={18}
                      color={getRiskColor(action.risk)}
                    />
                    <Text variant="titleSmall" style={styles.actionTitle}>
                      {action.action}
                    </Text>
                  </View>
                  <Chip
                    compact
                    style={[styles.riskChip, { backgroundColor: getRiskColor(action.risk) + '20' }]}
                    textStyle={[styles.riskChipText, { color: getRiskColor(action.risk) }]}
                  >
                    {action.risk}
                  </Chip>
                </View>
                <View style={styles.commandContainer}>
                  <Surface style={styles.commandSurface} elevation={0}>
                    <Text variant="bodySmall" style={styles.commandText}>
                      {action.command}
                    </Text>
                  </Surface>
                  <Pressable
                    onPress={() => handleCopyCommand(action.command)}
                    style={styles.copyButton}
                  >
                    <MaterialCommunityIcons
                      name={copiedCommand === action.command ? 'check' : 'content-copy'}
                      size={16}
                      color={copiedCommand === action.command ? colors.success : colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Relevant Logs */}
        {diagnosis.relevantLogs.length > 0 && (
          <View style={styles.logsSection}>
            <Pressable
              style={styles.logsSectionHeader}
              onPress={() => setExpandedLogs(!expandedLogs)}
            >
              <Text variant="titleSmall" style={styles.subSectionTitle}>
                Relevant Logs
              </Text>
              <View style={styles.logsToggle}>
                <Text variant="labelSmall" style={styles.logsCount}>
                  {diagnosis.relevantLogs.length} entries
                </Text>
                <MaterialCommunityIcons
                  name={expandedLogs ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
            </Pressable>
            {expandedLogs && (
              <Surface style={styles.logsSurface} elevation={0}>
                {diagnosis.relevantLogs.map((log, index) => (
                  <Text key={index} variant="bodySmall" style={styles.logEntry}>
                    {log}
                  </Text>
                ))}
              </Surface>
            )}
          </View>
        )}

        {/* Send as Note Button */}
        {onSendAsNote && (
          <Button
            mode="outlined"
            icon="note-plus"
            onPress={handleSendAsNote}
            loading={sendingNote}
            disabled={sendingNote}
            style={styles.sendNoteButton}
          >
            Add to Incident Notes
          </Button>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    backgroundColor: colors.surface,
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
    flex: 1,
  },
  betaChip: {
    backgroundColor: colors.accent + '20',
    height: 22,
  },
  betaChipText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 16,
  },
  loadingSubtitle: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 12,
  },
  errorMessage: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  retryButton: {
    borderRadius: 8,
  },
  analysisSurface: {
    backgroundColor: colors.surfaceSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  analysisText: {
    color: colors.textPrimary,
    lineHeight: 22,
  },
  actionsSection: {
    marginBottom: 16,
  },
  subSectionTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
  },
  actionItem: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  actionTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  riskChip: {
    height: 22,
  },
  riskChipText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  commandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commandSurface: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: 6,
  },
  commandText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.textSecondary,
    fontSize: 12,
  },
  copyButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  logsSection: {
    marginTop: 4,
  },
  logsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logsCount: {
    color: colors.textSecondary,
  },
  logsSurface: {
    backgroundColor: colors.surfaceSecondary,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  logEntry: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 4,
  },
  sendNoteButton: {
    marginTop: 16,
    borderRadius: 8,
    borderColor: colors.accent,
  },
});

export default AIDiagnosisPanel;
