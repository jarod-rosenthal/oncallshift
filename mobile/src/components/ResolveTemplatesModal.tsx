import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, Modal, Portal, Button, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

export interface ResolveTemplate {
  id: string;
  label: string;
  note: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

export const defaultResolveTemplates: ResolveTemplate[] = [
  {
    id: 'restart',
    label: 'Service Restart',
    note: 'Resolved by restarting the affected service. Root cause under investigation.',
    icon: 'restart',
  },
  {
    id: 'config',
    label: 'Config Update',
    note: 'Configuration issue identified and corrected. Monitoring for recurrence.',
    icon: 'cog',
  },
  {
    id: 'scaling',
    label: 'Auto-Scaling',
    note: 'System auto-scaled to handle increased load. Performance restored.',
    icon: 'arrow-expand-all',
  },
  {
    id: 'deployment',
    label: 'Deployment Fix',
    note: 'Fixed in latest deployment. Issue should not recur.',
    icon: 'rocket-launch',
  },
  {
    id: 'false_positive',
    label: 'False Positive',
    note: 'Alert triggered incorrectly. No actual issue detected. Alert threshold adjusted.',
    icon: 'shield-check',
  },
  {
    id: 'third_party',
    label: 'Third-Party Issue',
    note: 'Issue caused by external dependency. Has been resolved upstream.',
    icon: 'cloud-outline',
  },
  {
    id: 'transient',
    label: 'Transient Error',
    note: 'Transient issue self-resolved. No action required.',
    icon: 'lightning-bolt',
  },
  {
    id: 'manual_fix',
    label: 'Manual Fix',
    note: 'Issue manually remediated. Follow-up ticket created for permanent fix.',
    icon: 'wrench',
  },
];

interface ResolveTemplatesModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectTemplate: (note: string) => void;
  templates?: ResolveTemplate[];
}

export default function ResolveTemplatesModal({
  visible,
  onDismiss,
  onSelectTemplate,
  templates = defaultResolveTemplates,
}: ResolveTemplatesModalProps) {
  const { colors } = useAppTheme();
  const [customNote, setCustomNote] = React.useState('');
  const [showCustom, setShowCustom] = React.useState(false);

  const handleTemplateSelect = (template: ResolveTemplate) => {
    onSelectTemplate(template.note);
    onDismiss();
  };

  const handleCustomSubmit = () => {
    if (customNote.trim()) {
      onSelectTemplate(customNote.trim());
      setCustomNote('');
      setShowCustom(false);
      onDismiss();
    }
  };

  // Dynamic styles with theme colors
  const themedStyles = {
    modalContainer: {
      ...styles.modalContainer,
      backgroundColor: colors.surface,
    },
    header: {
      ...styles.header,
      borderBottomColor: colors.border,
    },
    title: {
      ...styles.title,
      color: colors.textPrimary,
    },
    subtitle: {
      ...styles.subtitle,
      color: colors.textSecondary,
    },
    templateItem: {
      ...styles.templateItem,
      borderBottomColor: colors.border,
    },
    templateIcon: {
      ...styles.templateIcon,
      backgroundColor: colors.accent + '20',
    },
    templateLabel: {
      ...styles.templateLabel,
      color: colors.textPrimary,
    },
    templateNote: {
      ...styles.templateNote,
      color: colors.textSecondary,
    },
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={themedStyles.modalContainer}
      >
        <View style={themedStyles.header}>
          <MaterialCommunityIcons name="check-all" size={28} color={colors.success} />
          <Text variant="titleLarge" style={themedStyles.title}>
            Resolve with Note
          </Text>
          <Text variant="bodyMedium" style={themedStyles.subtitle}>
            Choose a template or write a custom note
          </Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {!showCustom ? (
            <>
              {templates.map((template) => (
                <Pressable
                  key={template.id}
                  style={themedStyles.templateItem}
                  onPress={() => handleTemplateSelect(template)}
                >
                  <View style={themedStyles.templateIcon}>
                    <MaterialCommunityIcons
                      name={template.icon}
                      size={20}
                      color={colors.accent}
                    />
                  </View>
                  <View style={styles.templateContent}>
                    <Text variant="titleSmall" style={themedStyles.templateLabel}>
                      {template.label}
                    </Text>
                    <Text variant="bodySmall" style={themedStyles.templateNote} numberOfLines={2}>
                      {template.note}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              ))}

              <Pressable
                style={[themedStyles.templateItem, styles.customItem]}
                onPress={() => setShowCustom(true)}
              >
                <View style={[themedStyles.templateIcon, { backgroundColor: colors.surfaceSecondary }]}>
                  <MaterialCommunityIcons
                    name="pencil"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
                <View style={styles.templateContent}>
                  <Text variant="titleSmall" style={themedStyles.templateLabel}>
                    Custom Note
                  </Text>
                  <Text variant="bodySmall" style={themedStyles.templateNote}>
                    Write your own resolution note
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </>
          ) : (
            <View style={styles.customForm}>
              <TextInput
                mode="outlined"
                label="Resolution note"
                placeholder="Describe how the incident was resolved..."
                value={customNote}
                onChangeText={setCustomNote}
                multiline
                numberOfLines={4}
                style={styles.customInput}
              />
              <View style={styles.customActions}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setShowCustom(false);
                    setCustomNote('');
                  }}
                  style={styles.customButton}
                >
                  Back
                </Button>
                <Button
                  mode="contained"
                  onPress={handleCustomSubmit}
                  disabled={!customNote.trim()}
                  buttonColor={colors.success}
                  style={styles.customButton}
                >
                  Resolve
                </Button>
              </View>
            </View>
          )}
        </ScrollView>

        {!showCustom && (
          <Button
            mode="text"
            onPress={onDismiss}
            textColor={colors.textSecondary}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        )}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontWeight: '600',
    marginTop: 8,
  },
  subtitle: {
    marginTop: 4,
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 400,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  customItem: {
    borderBottomWidth: 0,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  templateContent: {
    flex: 1,
    marginRight: 8,
  },
  templateLabel: {
    fontWeight: '600',
  },
  templateNote: {
    marginTop: 2,
    lineHeight: 18,
  },
  customForm: {
    padding: 16,
  },
  customInput: {
    marginBottom: 16,
  },
  customActions: {
    flexDirection: 'row',
    gap: 12,
  },
  customButton: {
    flex: 1,
    borderRadius: 8,
  },
  cancelButton: {
    marginTop: 8,
    marginBottom: 16,
  },
});
