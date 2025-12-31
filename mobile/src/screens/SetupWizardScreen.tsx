import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Checkbox,
  ActivityIndicator,
  ProgressBar,
  Chip,
  IconButton,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import { useToast } from '../components';
import {
  SERVICE_TEMPLATES,
  AVAILABLE_ACTIONS,
  buildRunbookSteps,
  type ServiceTemplate,
} from '../data/service-templates';
import * as apiService from '../services/apiService';

const { width } = Dimensions.get('window');

// Wizard state types
interface SelectedService {
  templateId: string;
  customName: string;
  selectedActionIds: string[];
}

interface WizardState {
  aiApiKey: string;
  skipAI: boolean;
  services: SelectedService[];
  teamEmails: string;
  createRotation: boolean;
}

const INITIAL_STATE: WizardState = {
  aiApiKey: '',
  skipAI: false,
  services: [],
  teamEmails: '',
  createRotation: true,
};

const STORAGE_KEY = 'mobile_setupWizardProgress';

interface SetupWizardScreenProps {
  navigation: any;
  onComplete?: () => void;
}

// Icon mapping for service templates
const getIconName = (icon: string): keyof typeof MaterialCommunityIcons.glyphMap => {
  const iconMap: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
    api: 'api',
    web: 'web',
    database: 'database',
    'tray-full': 'tray-full',
    'shield-lock': 'shield-lock',
    'credit-card': 'credit-card',
    // Action icons
    aws: 'aws',
    restart: 'restart',
    'arrow-up-bold': 'arrow-up-bold',
    'undo-variant': 'undo-variant',
    'delete-sweep': 'delete-sweep',
    'shield-check': 'shield-check',
    connection: 'connection',
    'lightning-bolt': 'lightning-bolt',
    'traffic-cone': 'traffic-cone',
  };
  return iconMap[icon] || 'help-circle';
};

export default function SetupWizardScreen({ navigation, onComplete }: SetupWizardScreenProps) {
  const { colors } = useAppTheme();
  const { showSuccess, showError } = useToast();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const totalSteps = 5;
  const progress = step / totalSteps;

  // Load saved progress
  useEffect(() => {
    loadProgress();
  }, []);

  // Auto-save progress
  useEffect(() => {
    if (!isLoading) {
      saveProgress();
    }
  }, [step, state, isLoading]);

  const loadProgress = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { step: savedStep, state: savedState } = JSON.parse(saved);
        setStep(savedStep);
        setState(savedState);
      }
    } catch (error) {
      console.log('Failed to load wizard progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProgress = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ step, state }));
    } catch (error) {
      console.log('Failed to save wizard progress:', error);
    }
  };

  const clearProgress = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.log('Failed to clear wizard progress:', error);
    }
  };

  const goNext = () => setStep(s => Math.min(s + 1, totalSteps + 1));
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const addService = (template: ServiceTemplate) => {
    const newService: SelectedService = {
      templateId: template.id,
      customName: template.name,
      selectedActionIds: template.defaultActions.map(a => a.id),
    };
    updateState({ services: [...state.services, newService] });
  };

  const removeService = (index: number) => {
    const updated = [...state.services];
    updated.splice(index, 1);
    updateState({ services: updated });
    if (currentServiceIndex >= updated.length && updated.length > 0) {
      setCurrentServiceIndex(updated.length - 1);
    }
  };

  const updateServiceName = (index: number, name: string) => {
    const updated = [...state.services];
    updated[index] = { ...updated[index], customName: name };
    updateState({ services: updated });
  };

  const toggleAction = (serviceIndex: number, actionId: string) => {
    const updated = [...state.services];
    const service = { ...updated[serviceIndex] };
    if (service.selectedActionIds.includes(actionId)) {
      service.selectedActionIds = service.selectedActionIds.filter(id => id !== actionId);
    } else {
      service.selectedActionIds = [...service.selectedActionIds, actionId];
    }
    updated[serviceIndex] = service;
    updateState({ services: updated });
  };

  const completeSetup = async () => {
    setIsSubmitting(true);

    try {
      const services = state.services.map(s => {
        const template = SERVICE_TEMPLATES.find(t => t.id === s.templateId)!;
        const selectedActions = s.selectedActionIds
          .map(id => AVAILABLE_ACTIONS.find(a => a.id === id)!)
          .filter(Boolean);

        return {
          templateId: s.templateId,
          name: s.customName,
          description: template.description,
          runbook: {
            title: `${s.customName} Incident Response`,
            description: `Quick actions for ${s.customName}`,
            steps: buildRunbookSteps(selectedActions),
          },
        };
      });

      const teamEmails = state.teamEmails
        .split('\n')
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'));

      await apiService.completeSetup({
        aiApiKey: state.skipAI ? undefined : state.aiApiKey || undefined,
        services,
        teamEmails,
        createRotation: state.createRotation,
      });

      await clearProgress();
      showSuccess('Setup complete!');
      goNext();
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || 'Setup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    await clearProgress();
    if (onComplete) {
      onComplete();
    } else {
      navigation.goBack();
    }
  };

  const handleFinish = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    }
  };

  // Step 1: AI Setup
  const renderAISetup = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.stepHeader}>
        <Text variant="headlineSmall" style={[styles.stepTitle, { color: colors.textPrimary }]}>
          Enable AI-Powered Analysis
        </Text>
        <Text variant="bodyMedium" style={[styles.stepDescription, { color: colors.textSecondary }]}>
          OnCallShift uses Claude AI to analyze incidents, suggest root causes, and help you resolve issues faster.
        </Text>
      </View>

      <Card style={[styles.infoCard, { backgroundColor: colors.surfaceSecondary }]}>
        <Card.Content>
          <Text variant="titleSmall" style={{ color: colors.accent, marginBottom: 8 }}>
            What AI can do:
          </Text>
          <View style={styles.bulletList}>
            <Text style={[styles.bulletItem, { color: colors.textSecondary }]}>
              {'\u2022'} Analyze incidents automatically
            </Text>
            <Text style={[styles.bulletItem, { color: colors.textSecondary }]}>
              {'\u2022'} Suggest likely root causes
            </Text>
            <Text style={[styles.bulletItem, { color: colors.textSecondary }]}>
              {'\u2022'} Find similar past incidents
            </Text>
            <Text style={[styles.bulletItem, { color: colors.textSecondary }]}>
              {'\u2022'} Draft post-incident reports
            </Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.inputContainer}>
        <Text variant="labelLarge" style={[styles.inputLabel, { color: colors.textPrimary }]}>
          Anthropic API Key
        </Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          placeholder="sk-ant-api03-..."
          placeholderTextColor={colors.textMuted}
          value={state.aiApiKey}
          onChangeText={(text) => updateState({ aiApiKey: text, skipAI: false })}
          editable={!state.skipAI}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 4 }}>
          Get your API key at console.anthropic.com
        </Text>
      </View>

      <Pressable
        style={styles.checkboxRow}
        onPress={() => updateState({ skipAI: !state.skipAI })}
      >
        <Checkbox
          status={state.skipAI ? 'checked' : 'unchecked'}
          onPress={() => updateState({ skipAI: !state.skipAI })}
          color={colors.accent}
        />
        <Text style={{ color: colors.textSecondary, flex: 1 }}>
          Skip for now (AI features will be disabled)
        </Text>
      </Pressable>

      <View style={styles.buttonRow}>
        <View style={{ flex: 1 }} />
        <Button
          mode="contained"
          onPress={goNext}
          disabled={!state.aiApiKey && !state.skipAI}
          style={[styles.button, { backgroundColor: colors.accent }]}
        >
          Continue
        </Button>
      </View>
    </ScrollView>
  );

  // Step 2: Select Services
  const renderServicesStep = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.stepHeader}>
        <Text variant="headlineSmall" style={[styles.stepTitle, { color: colors.textPrimary }]}>
          Select Your Services
        </Text>
        <Text variant="bodyMedium" style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Choose from templates to quickly set up services with runbooks and quick actions.
        </Text>
      </View>

      <Text variant="titleSmall" style={{ color: colors.textPrimary, marginBottom: 12 }}>
        Popular Templates
      </Text>

      <View style={styles.templateGrid}>
        {SERVICE_TEMPLATES.map((template) => {
          const isAdded = state.services.some(s => s.templateId === template.id);
          return (
            <Pressable
              key={template.id}
              style={[
                styles.templateCard,
                {
                  backgroundColor: isAdded ? colors.success + '20' : colors.surface,
                  borderColor: isAdded ? colors.success : colors.border,
                },
              ]}
              onPress={() => !isAdded && addService(template)}
              disabled={isAdded}
            >
              <MaterialCommunityIcons
                name={getIconName(template.icon)}
                size={32}
                color={isAdded ? colors.success : colors.accent}
              />
              <Text
                variant="titleSmall"
                style={{ color: colors.textPrimary, marginTop: 8, textAlign: 'center' }}
              >
                {template.name}
              </Text>
              <Text
                variant="bodySmall"
                numberOfLines={2}
                style={{ color: colors.textMuted, textAlign: 'center', marginTop: 4 }}
              >
                {template.description}
              </Text>
              {isAdded && (
                <Chip
                  mode="flat"
                  style={{ marginTop: 8, backgroundColor: colors.success + '30' }}
                  textStyle={{ color: colors.success, fontSize: 10 }}
                >
                  Added
                </Chip>
              )}
            </Pressable>
          );
        })}
      </View>

      {state.services.length > 0 && (
        <>
          <Text variant="titleSmall" style={{ color: colors.textPrimary, marginTop: 24, marginBottom: 12 }}>
            Your Services ({state.services.length})
          </Text>
          {state.services.map((service, index) => {
            const template = SERVICE_TEMPLATES.find(t => t.id === service.templateId);
            return (
              <View
                key={index}
                style={[styles.selectedService, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <MaterialCommunityIcons
                  name={getIconName(template?.icon || 'help-circle')}
                  size={24}
                  color={colors.accent}
                />
                <TextInput
                  style={[
                    styles.serviceNameInput,
                    { color: colors.textPrimary, backgroundColor: colors.surfaceSecondary },
                  ]}
                  value={service.customName}
                  onChangeText={(text) => updateServiceName(index, text)}
                  placeholder="Service name"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={{ color: colors.textMuted, marginHorizontal: 8 }}>
                  {service.selectedActionIds.length} actions
                </Text>
                <IconButton
                  icon="close"
                  size={20}
                  iconColor={colors.error}
                  onPress={() => removeService(index)}
                />
              </View>
            );
          })}
        </>
      )}

      {state.services.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="cube-outline" size={48} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 8 }}>
            Tap a template above to add your first service
          </Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <Button mode="outlined" onPress={goBack} style={styles.button}>
          Back
        </Button>
        <Button
          mode="contained"
          onPress={goNext}
          disabled={state.services.length === 0}
          style={[styles.button, { backgroundColor: colors.accent }]}
        >
          Continue
        </Button>
      </View>
    </ScrollView>
  );

  // Step 3: Configure Actions
  const renderActionsStep = () => {
    const service = state.services[currentServiceIndex];
    const template = service ? SERVICE_TEMPLATES.find(t => t.id === service.templateId) : null;

    if (!service || !template) {
      return (
        <View style={[styles.emptyState, { flex: 1, justifyContent: 'center' }]}>
          <Text style={{ color: colors.textMuted }}>No services selected</Text>
          <Button mode="outlined" onPress={goBack} style={{ marginTop: 16 }}>
            Go Back
          </Button>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.stepHeader}>
          <Text variant="headlineSmall" style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Quick Actions for "{service.customName}"
          </Text>
          <Text variant="bodyMedium" style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Service {currentServiceIndex + 1} of {state.services.length}
          </Text>
        </View>

        {AVAILABLE_ACTIONS.map((action) => {
          const isSelected = service.selectedActionIds.includes(action.id);
          return (
            <Pressable
              key={action.id}
              style={[
                styles.actionCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => toggleAction(currentServiceIndex, action.id)}
            >
              <View style={styles.actionCheckbox}>
                <Checkbox
                  status={isSelected ? 'checked' : 'unchecked'}
                  color={colors.accent}
                />
              </View>
              <MaterialCommunityIcons
                name={getIconName(action.icon)}
                size={28}
                color={isSelected ? colors.accent : colors.textMuted}
              />
              <View style={styles.actionContent}>
                <Text variant="titleSmall" style={{ color: colors.textPrimary }}>
                  {action.label}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                  {action.description}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 4 }}>
                  Est. time: ~{action.estimatedMinutes} min
                </Text>
              </View>
            </Pressable>
          );
        })}

        <View style={styles.buttonRow}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button mode="outlined" onPress={goBack} style={styles.button}>
              Back
            </Button>
            {currentServiceIndex > 0 && (
              <Button
                mode="outlined"
                onPress={() => setCurrentServiceIndex(i => i - 1)}
                style={styles.button}
              >
                Previous
              </Button>
            )}
          </View>
          {currentServiceIndex < state.services.length - 1 ? (
            <Button
              mode="contained"
              onPress={() => setCurrentServiceIndex(i => i + 1)}
              style={[styles.button, { backgroundColor: colors.accent }]}
            >
              Next Service
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={goNext}
              disabled={service.selectedActionIds.length === 0}
              style={[styles.button, { backgroundColor: colors.accent }]}
            >
              Continue
            </Button>
          )}
        </View>
      </ScrollView>
    );
  };

  // Step 4: Invite Team
  const renderTeamStep = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.stepHeader}>
        <Text variant="headlineSmall" style={[styles.stepTitle, { color: colors.textPrimary }]}>
          Invite Your Team
        </Text>
        <Text variant="bodyMedium" style={[styles.stepDescription, { color: colors.textSecondary }]}>
          Add team members who should respond to incidents.
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text variant="labelLarge" style={[styles.inputLabel, { color: colors.textPrimary }]}>
          Email addresses (one per line)
        </Text>
        <TextInput
          style={[
            styles.textInput,
            styles.multilineInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          placeholder={"alice@company.com\nbob@company.com\ncharlie@company.com"}
          placeholderTextColor={colors.textMuted}
          value={state.teamEmails}
          onChangeText={(text) => updateState({ teamEmails: text })}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 4 }}>
          They'll receive an email invitation to join your team.
        </Text>
      </View>

      <Pressable
        style={styles.checkboxRow}
        onPress={() => updateState({ createRotation: !state.createRotation })}
      >
        <Checkbox
          status={state.createRotation ? 'checked' : 'unchecked'}
          onPress={() => updateState({ createRotation: !state.createRotation })}
          color={colors.accent}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>
            Set up a simple on-call rotation
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Each person is on-call for 1 week, rotating through the team
          </Text>
        </View>
      </Pressable>

      <View style={styles.buttonRow}>
        <Button mode="outlined" onPress={goBack} style={styles.button}>
          Back
        </Button>
        <Button
          mode="contained"
          onPress={goNext}
          style={[styles.button, { backgroundColor: colors.accent }]}
        >
          {state.teamEmails.trim() ? 'Continue' : 'Skip for now'}
        </Button>
      </View>
    </ScrollView>
  );

  // Step 5: Review
  const renderReviewStep = () => {
    const emailCount = state.teamEmails
      .split('\n')
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@')).length;

    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.stepHeader}>
          <Text variant="headlineSmall" style={[styles.stepTitle, { color: colors.textPrimary }]}>
            Review & Complete
          </Text>
          <Text variant="bodyMedium" style={[styles.stepDescription, { color: colors.textSecondary }]}>
            Here's what we'll create for you:
          </Text>
        </View>

        <Card style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons
                name={state.skipAI ? 'close-circle' : 'check-circle'}
                size={24}
                color={state.skipAI ? colors.textMuted : colors.success}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="titleSmall" style={{ color: colors.textPrimary }}>
                  AI Analysis
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                  {state.skipAI ? 'Disabled (can enable later)' : 'Enabled with your API key'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="cog" size={24} color={colors.accent} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="titleSmall" style={{ color: colors.textPrimary }}>
                  {state.services.length} Services
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                  {state.services.map(s => s.customName).join(', ')}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="book-open-variant" size={24} color={colors.accent} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="titleSmall" style={{ color: colors.textPrimary }}>
                  {state.services.length} Runbooks
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                  Each service gets a runbook with quick actions
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {emailCount > 0 && (
          <Card style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            <Card.Content>
              <View style={styles.summaryRow}>
                <MaterialCommunityIcons name="account-group" size={24} color={colors.accent} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text variant="titleSmall" style={{ color: colors.textPrimary }}>
                    {emailCount} Team Members
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                    {state.createRotation ? 'With weekly on-call rotation' : 'Invitations will be sent'}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        <View style={styles.buttonRow}>
          <Button mode="outlined" onPress={goBack} disabled={isSubmitting} style={styles.button}>
            Back
          </Button>
          <Button
            mode="contained"
            onPress={completeSetup}
            disabled={isSubmitting}
            loading={isSubmitting}
            style={[styles.button, { backgroundColor: colors.accent }]}
          >
            Complete Setup
          </Button>
        </View>
      </ScrollView>
    );
  };

  // Step 6: Success
  const renderSuccessStep = () => (
    <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}>
        <MaterialCommunityIcons name="check-circle" size={80} color={colors.success} />
      </View>
      <Text variant="headlineMedium" style={[styles.successTitle, { color: colors.textPrimary }]}>
        You're all set!
      </Text>
      <Text variant="bodyLarge" style={[styles.successDescription, { color: colors.textSecondary }]}>
        OnCallShift is ready to help you resolve incidents faster.
      </Text>

      <View style={styles.successList}>
        <View style={styles.successItem}>
          <MaterialCommunityIcons name="check" size={20} color={colors.success} />
          <Text style={{ color: colors.textPrimary, marginLeft: 8 }}>
            {state.services.length} services created
          </Text>
        </View>
        {!state.skipAI && (
          <View style={styles.successItem}>
            <MaterialCommunityIcons name="check" size={20} color={colors.success} />
            <Text style={{ color: colors.textPrimary, marginLeft: 8 }}>
              AI analysis enabled
            </Text>
          </View>
        )}
        {state.teamEmails.trim() && (
          <View style={styles.successItem}>
            <MaterialCommunityIcons name="check" size={20} color={colors.success} />
            <Text style={{ color: colors.textPrimary, marginLeft: 8 }}>
              Team invitations sent
            </Text>
          </View>
        )}
      </View>

      <View style={styles.successButtons}>
        <Button
          mode="contained"
          onPress={handleFinish}
          style={[styles.successButton, { backgroundColor: colors.accent }]}
          contentStyle={{ paddingVertical: 8 }}
        >
          Go to Dashboard
        </Button>
      </View>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return renderAISetup();
      case 2:
        return renderServicesStep();
      case 3:
        return renderActionsStep();
      case 4:
        return renderTeamStep();
      case 5:
        return renderReviewStep();
      case 6:
        return renderSuccessStep();
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={{ color: colors.textPrimary, fontWeight: 'bold' }}>
          Set up OnCallShift
        </Text>
        {step <= totalSteps && (
          <Text variant="bodyMedium" style={{ color: colors.textMuted, marginTop: 4 }}>
            Step {step} of {totalSteps}
          </Text>
        )}
      </View>

      {/* Progress bar */}
      {step <= totalSteps && (
        <View style={styles.progressContainer}>
          <ProgressBar
            progress={progress}
            color={colors.accent}
            style={[styles.progressBar, { backgroundColor: colors.surfaceSecondary }]}
          />
        </View>
      )}

      {/* Step content */}
      {renderStep()}

      {/* Skip link */}
      {step <= totalSteps && (
        <Pressable style={styles.skipLink} onPress={handleSkip}>
          <Text style={{ color: colors.textMuted }}>
            Skip setup and go to dashboard
          </Text>
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: 'center',
  },
  progressContainer: {
    paddingHorizontal: 40,
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepHeader: {
    marginBottom: 24,
  },
  stepTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepDescription: {
    lineHeight: 22,
  },
  infoCard: {
    marginBottom: 24,
    borderRadius: 12,
  },
  bulletList: {
    gap: 4,
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multilineInput: {
    height: 120,
    paddingTop: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  button: {
    borderRadius: 8,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateCard: {
    width: (width - 52) / 2,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  selectedService: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  serviceNameInput: {
    flex: 1,
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  actionCheckbox: {
    marginRight: 4,
  },
  actionContent: {
    flex: 1,
    marginLeft: 10,
  },
  summaryCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  successDescription: {
    textAlign: 'center',
    marginBottom: 24,
  },
  successList: {
    alignSelf: 'stretch',
    maxWidth: 300,
    gap: 12,
    marginBottom: 32,
  },
  successItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successButtons: {
    width: '100%',
    maxWidth: 280,
  },
  successButton: {
    borderRadius: 12,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 32,
  },
});
