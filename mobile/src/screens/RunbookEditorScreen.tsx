import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  Chip,
  IconButton,
  Menu,
  Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import { useToast } from '../components';
import * as runbookService from '../services/runbookService';
import type { Runbook, RunbookStep, ScriptLanguage, AutomationMode } from '../services/runbookService';
import * as apiService from '../services/apiService';
import * as hapticService from '../services/hapticService';

interface StepFormData {
  id: string;
  title: string;
  description: string;
  isOptional: boolean;
  estimatedMinutes: string;
  stepType: 'manual' | 'script' | 'ai';
  scriptLanguage: ScriptLanguage;
  scriptCode: string;
  timeout: string;
  requiresApproval: boolean;
}

const createEmptyStep = (order: number): StepFormData => ({
  id: `new-${Date.now()}-${order}`,
  title: '',
  description: '',
  isOptional: false,
  estimatedMinutes: '',
  stepType: 'manual',
  scriptLanguage: 'bash',
  scriptCode: '',
  timeout: '60',
  requiresApproval: false,
});

export default function RunbookEditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useAppTheme();
  const { showToast } = useToast();

  const runbookId = route.params?.runbookId;
  const isEditing = !!runbookId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [steps, setSteps] = useState<StepFormData[]>([createEmptyStep(1)]);

  // UI state
  const [serviceMenuVisible, setServiceMenuVisible] = useState(false);
  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(0);

  const severityOptions = ['critical', 'error', 'warning', 'info'];

  useEffect(() => {
    fetchServices();
    if (isEditing) {
      fetchRunbook();
    }
  }, [runbookId]);

  const fetchServices = async () => {
    try {
      const data = await apiService.getServices();
      setServices(data.map(s => ({ id: s.id, name: s.name })));
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchRunbook = async () => {
    try {
      const runbook = await runbookService.getRunbook(runbookId);
      if (runbook) {
        setTitle(runbook.title);
        setDescription(runbook.description || '');
        setServiceId(runbook.serviceId);
        setExternalUrl(runbook.externalUrl || '');
        setSelectedSeverities(runbook.severity || []);
        setTags(runbook.tags || []);
        setSteps(runbook.steps.map(step => transformStepToForm(step)));
      }
    } catch (error: any) {
      showToast({ message: 'Failed to load runbook', type: 'error' });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const transformStepToForm = (step: RunbookStep): StepFormData => {
    let stepType: 'manual' | 'script' | 'ai' = 'manual';
    let scriptLanguage: ScriptLanguage = 'bash';
    let scriptCode = '';
    let timeout = '60';
    let requiresApproval = false;

    if (step.type === 'automated' && step.automation) {
      if (step.automation.mode === 'claude_code_api' || step.automation.script?.language === 'natural_language') {
        stepType = 'ai';
        scriptLanguage = 'natural_language';
      } else {
        stepType = 'script';
        scriptLanguage = step.automation.script?.language || 'bash';
      }
      scriptCode = step.automation.script?.code || '';
      timeout = String(step.automation.timeout || 60);
      requiresApproval = step.automation.requiresApproval || false;
    }

    return {
      id: step.id,
      title: step.title,
      description: step.description,
      isOptional: step.isOptional,
      estimatedMinutes: step.estimatedMinutes ? String(step.estimatedMinutes) : '',
      stepType,
      scriptLanguage,
      scriptCode,
      timeout,
      requiresApproval,
    };
  };

  const transformFormToStep = (form: StepFormData, order: number): Omit<RunbookStep, 'id'> => {
    const baseStep = {
      order,
      title: form.title,
      description: form.description,
      isOptional: form.isOptional,
      estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes, 10) : undefined,
    };

    if (form.stepType === 'manual') {
      return {
        ...baseStep,
        type: 'manual' as const,
      };
    }

    const mode: AutomationMode = form.stepType === 'ai' ? 'claude_code_api' : 'server_sandbox';
    const language: ScriptLanguage = form.stepType === 'ai' ? 'natural_language' : form.scriptLanguage;

    return {
      ...baseStep,
      type: 'automated' as const,
      automation: {
        mode,
        script: {
          language,
          code: form.scriptCode,
          version: 1,
        },
        timeout: parseInt(form.timeout, 10) || 60,
        requiresApproval: form.requiresApproval,
      },
    };
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      showToast({ message: 'Title is required', type: 'error' });
      return;
    }
    if (!serviceId) {
      showToast({ message: 'Please select a service', type: 'error' });
      return;
    }
    if (steps.length === 0) {
      showToast({ message: 'Add at least one step', type: 'error' });
      return;
    }
    const invalidSteps = steps.filter(s => !s.title.trim());
    if (invalidSteps.length > 0) {
      showToast({ message: 'All steps must have a title', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const stepsData = steps.map((s, idx) => transformFormToStep(s, idx + 1));

      if (isEditing) {
        await runbookService.updateRunbook(runbookId, {
          title: title.trim(),
          description: description.trim() || undefined,
          externalUrl: externalUrl.trim() || undefined,
          severity: selectedSeverities.length > 0 ? selectedSeverities : undefined,
          tags: tags.length > 0 ? tags : undefined,
          steps: stepsData.map((s, idx) => ({
            ...s,
            id: steps[idx].id.startsWith('new-') ? `step-${Date.now()}-${idx}` : steps[idx].id,
          })) as RunbookStep[],
        });
        hapticService.success();
        showToast({ message: 'Runbook updated', type: 'success' });
      } else {
        await runbookService.createRunbook({
          serviceId,
          title: title.trim(),
          description: description.trim() || undefined,
          externalUrl: externalUrl.trim() || undefined,
          severity: selectedSeverities.length > 0 ? selectedSeverities : undefined,
          tags: tags.length > 0 ? tags : undefined,
          steps: stepsData,
        });
        hapticService.success();
        showToast({ message: 'Runbook created', type: 'success' });
      }
      navigation.goBack();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to save runbook', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const addStep = () => {
    hapticService.lightTap();
    const newStep = createEmptyStep(steps.length + 1);
    setSteps([...steps, newStep]);
    setExpandedStepIndex(steps.length);
  };

  const removeStep = (index: number) => {
    hapticService.warning();
    Alert.alert(
      'Remove Step',
      'Are you sure you want to remove this step?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setSteps(steps.filter((_, i) => i !== index));
            if (expandedStepIndex === index) {
              setExpandedStepIndex(null);
            } else if (expandedStepIndex && expandedStepIndex > index) {
              setExpandedStepIndex(expandedStepIndex - 1);
            }
          },
        },
      ]
    );
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    hapticService.lightTap();
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);

    if (expandedStepIndex === index) {
      setExpandedStepIndex(newIndex);
    } else if (expandedStepIndex === newIndex) {
      setExpandedStepIndex(index);
    }
  };

  const updateStep = (index: number, updates: Partial<StepFormData>) => {
    setSteps(steps.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const toggleSeverity = (severity: string) => {
    if (selectedSeverities.includes(severity)) {
      setSelectedSeverities(selectedSeverities.filter(s => s !== severity));
    } else {
      setSelectedSeverities([...selectedSeverities, severity]);
    }
  };

  const selectedService = services.find(s => s.id === serviceId);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading runbook...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Service Selection */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={[styles.label, { color: colors.textPrimary }]}>
            Service *
          </Text>
          <Menu
            visible={serviceMenuVisible}
            onDismiss={() => setServiceMenuVisible(false)}
            anchor={
              <Pressable
                style={[styles.serviceSelector, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => !isEditing && setServiceMenuVisible(true)}
                disabled={isEditing}
              >
                <MaterialCommunityIcons name="server" size={20} color={colors.textSecondary} />
                <Text style={{ color: selectedService ? colors.textPrimary : colors.textMuted, flex: 1 }}>
                  {selectedService?.name || 'Select a service...'}
                </Text>
                {!isEditing && (
                  <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                )}
              </Pressable>
            }
          >
            {loadingServices ? (
              <Menu.Item title="Loading..." disabled />
            ) : services.length === 0 ? (
              <Menu.Item title="No services available" disabled />
            ) : (
              services.map(service => (
                <Menu.Item
                  key={service.id}
                  title={service.name}
                  onPress={() => {
                    setServiceId(service.id);
                    setServiceMenuVisible(false);
                  }}
                />
              ))
            )}
          </Menu>
          {isEditing && (
            <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 4 }}>
              Service cannot be changed after creation
            </Text>
          )}
        </View>

        {/* Title */}
        <View style={styles.section}>
          <TextInput
            label="Title *"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            placeholder="e.g., API Service Incident Response"
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            numberOfLines={3}
            placeholder="Brief description of this runbook..."
          />
        </View>

        {/* External URL */}
        <View style={styles.section}>
          <TextInput
            label="External Documentation URL"
            value={externalUrl}
            onChangeText={setExternalUrl}
            mode="outlined"
            placeholder="https://..."
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* Severity Filter */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={[styles.label, { color: colors.textPrimary }]}>
            Severity Filter
          </Text>
          <Text variant="bodySmall" style={[styles.hint, { color: colors.textMuted }]}>
            Leave empty to apply to all severities
          </Text>
          <View style={styles.severityRow}>
            {severityOptions.map(severity => (
              <Chip
                key={severity}
                selected={selectedSeverities.includes(severity)}
                onPress={() => toggleSeverity(severity)}
                style={[
                  styles.severityChip,
                  selectedSeverities.includes(severity) && { backgroundColor: getSeverityColor(severity) + '30' },
                ]}
                textStyle={{
                  color: selectedSeverities.includes(severity) ? getSeverityColor(severity) : colors.textSecondary,
                  fontSize: 12,
                }}
              >
                {severity}
              </Chip>
            ))}
          </View>
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={[styles.label, { color: colors.textPrimary }]}>
            Tags
          </Text>
          <View style={styles.tagInputRow}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              mode="outlined"
              placeholder="Add tag..."
              style={styles.tagInput}
              dense
            />
            <IconButton icon="plus" onPress={addTag} disabled={!tagInput.trim()} />
          </View>
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map(tag => (
                <Chip
                  key={tag}
                  onClose={() => removeTag(tag)}
                  style={styles.tagChip}
                  textStyle={{ fontSize: 12 }}
                >
                  #{tag}
                </Chip>
              ))}
            </View>
          )}
        </View>

        <Divider style={styles.divider} />

        {/* Steps */}
        <View style={styles.section}>
          <View style={styles.stepsHeader}>
            <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
              Steps ({steps.length})
            </Text>
            <Button mode="contained-tonal" onPress={addStep} icon="plus" compact>
              Add Step
            </Button>
          </View>

          {steps.map((step, index) => (
            <View key={step.id} style={[styles.stepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Step Header */}
              <Pressable
                style={styles.stepHeader}
                onPress={() => setExpandedStepIndex(expandedStepIndex === index ? null : index)}
              >
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.stepHeaderInfo}>
                  <Text variant="titleSmall" style={{ color: colors.textPrimary }} numberOfLines={1}>
                    {step.title || 'Untitled Step'}
                  </Text>
                  <View style={styles.stepTypeBadges}>
                    <Chip compact style={styles.typeBadge} textStyle={{ fontSize: 9 }}>
                      {step.stepType === 'ai' ? 'AI' : step.stepType === 'script' ? 'SCRIPT' : 'MANUAL'}
                    </Chip>
                    {step.isOptional && (
                      <Text style={{ color: colors.textMuted, fontSize: 10, fontStyle: 'italic' }}>Optional</Text>
                    )}
                  </View>
                </View>
                <View style={styles.stepActions}>
                  <IconButton
                    icon="arrow-up"
                    size={16}
                    onPress={() => moveStep(index, 'up')}
                    disabled={index === 0}
                  />
                  <IconButton
                    icon="arrow-down"
                    size={16}
                    onPress={() => moveStep(index, 'down')}
                    disabled={index === steps.length - 1}
                  />
                  <IconButton
                    icon="delete"
                    size={16}
                    iconColor={colors.error}
                    onPress={() => removeStep(index)}
                  />
                  <MaterialCommunityIcons
                    name={expandedStepIndex === index ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>

              {/* Expanded Step Content */}
              {expandedStepIndex === index && (
                <View style={styles.stepContent}>
                  <TextInput
                    label="Step Title *"
                    value={step.title}
                    onChangeText={(v) => updateStep(index, { title: v })}
                    mode="outlined"
                    style={styles.stepInput}
                    dense
                  />

                  <TextInput
                    label="Description"
                    value={step.description}
                    onChangeText={(v) => updateStep(index, { description: v })}
                    mode="outlined"
                    multiline
                    numberOfLines={2}
                    style={styles.stepInput}
                    dense
                  />

                  <View style={styles.stepRow}>
                    <TextInput
                      label="Est. Minutes"
                      value={step.estimatedMinutes}
                      onChangeText={(v) => updateStep(index, { estimatedMinutes: v })}
                      mode="outlined"
                      keyboardType="number-pad"
                      style={[styles.stepInput, { flex: 1 }]}
                      dense
                    />
                    <View style={styles.optionalToggle}>
                      <Chip
                        selected={step.isOptional}
                        onPress={() => updateStep(index, { isOptional: !step.isOptional })}
                        style={step.isOptional ? { backgroundColor: colors.primary + '20' } : {}}
                      >
                        Optional
                      </Chip>
                    </View>
                  </View>

                  {/* Step Type Selection */}
                  <Text variant="labelMedium" style={[styles.stepLabel, { color: colors.textSecondary }]}>
                    Step Type
                  </Text>
                  <SegmentedButtons
                    value={step.stepType}
                    onValueChange={(v) => updateStep(index, { stepType: v as 'manual' | 'script' | 'ai' })}
                    buttons={[
                      { value: 'manual', label: 'Manual', icon: 'checkbox-marked-outline' },
                      { value: 'script', label: 'Script', icon: 'code-tags' },
                      { value: 'ai', label: 'AI Action', icon: 'robot' },
                    ]}
                    style={styles.segmented}
                  />

                  {/* Script/AI Configuration */}
                  {step.stepType !== 'manual' && (
                    <View style={styles.automationConfig}>
                      {step.stepType === 'script' && (
                        <>
                          <Text variant="labelMedium" style={[styles.stepLabel, { color: colors.textSecondary }]}>
                            Language
                          </Text>
                          <SegmentedButtons
                            value={step.scriptLanguage}
                            onValueChange={(v) => updateStep(index, { scriptLanguage: v as ScriptLanguage })}
                            buttons={[
                              { value: 'bash', label: 'Bash' },
                              { value: 'python', label: 'Python' },
                              { value: 'javascript', label: 'JS' },
                            ]}
                            style={styles.segmented}
                          />
                        </>
                      )}

                      <TextInput
                        label={step.stepType === 'ai' ? 'AI Instructions (natural language)' : 'Script Code'}
                        value={step.scriptCode}
                        onChangeText={(v) => updateStep(index, { scriptCode: v })}
                        mode="outlined"
                        multiline
                        numberOfLines={6}
                        style={[styles.stepInput, styles.codeInput]}
                        placeholder={step.stepType === 'ai'
                          ? 'Describe what the AI should do...\ne.g., "Check CloudWatch logs for errors in the last 30 minutes"'
                          : '#!/bin/bash\n# Your script here'
                        }
                      />

                      <View style={styles.stepRow}>
                        <TextInput
                          label="Timeout (seconds)"
                          value={step.timeout}
                          onChangeText={(v) => updateStep(index, { timeout: v })}
                          mode="outlined"
                          keyboardType="number-pad"
                          style={[styles.stepInput, { flex: 1 }]}
                          dense
                        />
                        <View style={styles.approvalToggle}>
                          <Chip
                            selected={step.requiresApproval}
                            onPress={() => updateStep(index, { requiresApproval: !step.requiresApproval })}
                            icon={step.requiresApproval ? 'shield-check' : 'shield-outline'}
                            style={step.requiresApproval ? { backgroundColor: colors.warning + '20' } : {}}
                          >
                            Requires Approval
                          </Chip>
                        </View>
                      </View>

                      {step.stepType === 'ai' && (
                        <Text variant="bodySmall" style={[styles.hint, { color: colors.textMuted }]}>
                          AI steps always require approval for safety
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}

          {steps.length === 0 && (
            <View style={styles.noSteps}>
              <MaterialCommunityIcons name="format-list-bulleted" size={48} color={colors.textMuted} />
              <Text variant="bodyMedium" style={{ color: colors.textMuted, marginTop: 8 }}>
                No steps yet. Add your first step above.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.footerButton}>
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.footerButton}
        >
          {isEditing ? 'Save Changes' : 'Create Runbook'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'critical': return '#C53030';
    case 'error': return '#DD6B20';
    case 'warning': return '#D69E2E';
    case 'info': return '#3182CE';
    default: return '#718096';
  }
};

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
  section: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
  },
  hint: {
    marginBottom: 8,
    fontSize: 12,
  },
  serviceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  severityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  severityChip: {
    borderRadius: 6,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagInput: {
    flex: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tagChip: {
    borderRadius: 6,
  },
  divider: {
    marginVertical: 16,
  },
  stepsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  stepHeaderInfo: {
    flex: 1,
  },
  stepTypeBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  typeBadge: {
    borderRadius: 4,
    height: 20,
  },
  stepActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepContent: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  stepInput: {
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  optionalToggle: {
    marginLeft: 8,
  },
  approvalToggle: {
    marginLeft: 8,
  },
  stepLabel: {
    marginBottom: 8,
    marginTop: 4,
  },
  segmented: {
    marginBottom: 12,
  },
  automationConfig: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  codeInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  noSteps: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
  },
});
