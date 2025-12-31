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
  Button,
  TextInput,
  ActivityIndicator,
  Chip,
  IconButton,
  Divider,
  SegmentedButtons,
  Switch,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import { useToast } from '../components';
import * as apiService from '../services/apiService';
import type { AlertGroupingRule, GroupingType, AlertGroupingDefaults } from '../services/apiService';
import * as hapticService from '../services/hapticService';

type RouteParams = {
  ServiceSettings: { serviceId: string; serviceName: string };
};

const GROUPING_TYPES: { value: GroupingType; label: string; description: string; icon: string }[] = [
  {
    value: 'intelligent',
    label: 'Intelligent',
    description: 'AI-powered grouping based on content similarity',
    icon: 'brain',
  },
  {
    value: 'time',
    label: 'Time-Based',
    description: 'Group alerts within a time window',
    icon: 'clock-outline',
  },
  {
    value: 'content',
    label: 'Content-Based',
    description: 'Group by specific alert fields',
    icon: 'text-box-search',
  },
  {
    value: 'disabled',
    label: 'Disabled',
    description: 'Each alert creates a new incident',
    icon: 'close-circle-outline',
  },
];

export default function ServiceSettingsScreen() {
  const route = useRoute<RouteProp<RouteParams, 'ServiceSettings'>>();
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const { serviceId, serviceName } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [groupingRule, setGroupingRule] = useState<AlertGroupingRule | null>(null);
  const [defaults, setDefaults] = useState<AlertGroupingDefaults | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [groupingType, setGroupingType] = useState<GroupingType>('intelligent');
  const [timeWindowMinutes, setTimeWindowMinutes] = useState('5');
  const [contentFields, setContentFields] = useState<string[]>([]);
  const [newField, setNewField] = useState('');
  const [dedupKeyTemplate, setDedupKeyTemplate] = useState('');
  const [maxAlertsPerIncident, setMaxAlertsPerIncident] = useState('1000');

  useEffect(() => {
    navigation.setOptions({ title: `${serviceName} - Settings` });
    fetchData();
  }, [serviceId]);

  const fetchData = async () => {
    try {
      const data = await apiService.getAlertGroupingRule(serviceId);
      setGroupingRule(data.groupingRule);
      setDefaults(data.defaults);

      // Initialize form with current values or defaults
      const rule = data.groupingRule || data.defaults;
      setGroupingType(rule.groupingType);
      setTimeWindowMinutes(rule.timeWindowMinutes.toString());
      setContentFields(rule.contentFields || []);
      setMaxAlertsPerIncident(rule.maxAlertsPerIncident.toString());
      if (data.groupingRule?.dedupKeyTemplate) {
        setDedupKeyTemplate(data.groupingRule.dedupKeyTemplate);
      }
    } catch (error: any) {
      console.error('Failed to fetch alert grouping rule:', error);
      showToast({ message: 'Failed to load settings', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [serviceId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiService.updateAlertGroupingRule(serviceId, {
        groupingType,
        timeWindowMinutes: parseInt(timeWindowMinutes, 10) || 5,
        contentFields: groupingType === 'content' ? contentFields : [],
        dedupKeyTemplate: dedupKeyTemplate.trim() || null,
        maxAlertsPerIncident: parseInt(maxAlertsPerIncident, 10) || 1000,
      });
      hapticService.success();
      showToast({ message: 'Settings saved', type: 'success' });
      setHasChanges(false);
      fetchData();
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      showToast({ message: error.response?.data?.error || 'Failed to save', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    hapticService.warning();
    Alert.alert(
      'Reset to Defaults',
      'Are you sure you want to reset alert grouping to default settings?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteAlertGroupingRule(serviceId);
              hapticService.success();
              showToast({ message: 'Reset to defaults', type: 'success' });
              setHasChanges(false);
              fetchData();
            } catch (error: any) {
              showToast({ message: 'Failed to reset', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const updateGroupingType = (value: string) => {
    setGroupingType(value as GroupingType);
    setHasChanges(true);
  };

  const addContentField = () => {
    if (newField.trim() && !contentFields.includes(newField.trim())) {
      setContentFields([...contentFields, newField.trim()]);
      setNewField('');
      setHasChanges(true);
    }
  };

  const removeContentField = (field: string) => {
    setContentFields(contentFields.filter(f => f !== field));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading settings...
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
        {/* Alert Grouping Section */}
        <Card style={[styles.card, { backgroundColor: colors.surface }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="group" size={24} color={colors.primary} />
              <Text variant="titleLarge" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Alert Grouping
              </Text>
            </View>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
              Configure how alerts are grouped into incidents for this service.
            </Text>

            {/* Grouping Type Selector */}
            <Text variant="labelLarge" style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Grouping Method
            </Text>
            <View style={styles.groupingTypes}>
              {GROUPING_TYPES.map((type) => (
                <Pressable
                  key={type.value}
                  style={[
                    styles.groupingTypeCard,
                    { borderColor: groupingType === type.value ? colors.primary : colors.border },
                    groupingType === type.value && { backgroundColor: `${colors.primary}08` },
                  ]}
                  onPress={() => updateGroupingType(type.value)}
                >
                  <View style={styles.groupingTypeHeader}>
                    <MaterialCommunityIcons
                      name={type.icon as any}
                      size={24}
                      color={groupingType === type.value ? colors.primary : colors.textMuted}
                    />
                    {groupingType === type.value && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={colors.primary}
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </View>
                  <Text
                    variant="titleSmall"
                    style={{
                      color: groupingType === type.value ? colors.primary : colors.textPrimary,
                      marginTop: 8,
                    }}
                  >
                    {type.label}
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 4 }}>
                    {type.description}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Divider style={styles.divider} />

            {/* Time Window - shown for time and intelligent */}
            {(groupingType === 'time' || groupingType === 'intelligent') && (
              <View style={styles.fieldGroup}>
                <Text variant="labelLarge" style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Time Window (minutes)
                </Text>
                <TextInput
                  value={timeWindowMinutes}
                  onChangeText={(value) => {
                    setTimeWindowMinutes(value);
                    setHasChanges(true);
                  }}
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                  Alerts within this window may be grouped together (1-1440 minutes)
                </Text>
              </View>
            )}

            {/* Content Fields - shown for content-based */}
            {groupingType === 'content' && (
              <View style={styles.fieldGroup}>
                <Text variant="labelLarge" style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Content Fields
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textMuted, marginBottom: 12 }}>
                  Alerts with matching values in these fields will be grouped together
                </Text>

                <View style={styles.fieldsContainer}>
                  {contentFields.map((field) => (
                    <Chip
                      key={field}
                      onClose={() => removeContentField(field)}
                      style={styles.fieldChip}
                    >
                      {field}
                    </Chip>
                  ))}
                </View>

                <View style={styles.addFieldRow}>
                  <TextInput
                    value={newField}
                    onChangeText={setNewField}
                    mode="outlined"
                    placeholder="e.g., source, component"
                    style={[styles.input, { flex: 1 }]}
                    dense
                  />
                  <Button
                    mode="contained"
                    onPress={addContentField}
                    style={{ marginLeft: 8 }}
                    disabled={!newField.trim()}
                  >
                    Add
                  </Button>
                </View>

                <View style={styles.suggestedFields}>
                  <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                    Common fields:
                  </Text>
                  <View style={styles.suggestedChips}>
                    {['source', 'component', 'class', 'group', 'severity'].map((field) => (
                      <Chip
                        key={field}
                        compact
                        onPress={() => {
                          if (!contentFields.includes(field)) {
                            setContentFields([...contentFields, field]);
                            setHasChanges(true);
                          }
                        }}
                        style={[styles.suggestedChip, { backgroundColor: colors.surfaceVariant }]}
                        disabled={contentFields.includes(field)}
                      >
                        {field}
                      </Chip>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Dedup Key Template */}
            {groupingType !== 'disabled' && (
              <View style={styles.fieldGroup}>
                <Text variant="labelLarge" style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Dedup Key Template (optional)
                </Text>
                <TextInput
                  value={dedupKeyTemplate}
                  onChangeText={(value) => {
                    setDedupKeyTemplate(value);
                    setHasChanges(true);
                  }}
                  mode="outlined"
                  placeholder="e.g., {{source}}-{{component}}"
                  style={styles.input}
                />
                <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                  Custom template for deduplication key. Uses {'{{field}}'} syntax.
                </Text>
              </View>
            )}

            {/* Max Alerts Per Incident */}
            {groupingType !== 'disabled' && (
              <View style={styles.fieldGroup}>
                <Text variant="labelLarge" style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Max Alerts Per Incident
                </Text>
                <TextInput
                  value={maxAlertsPerIncident}
                  onChangeText={(value) => {
                    setMaxAlertsPerIncident(value);
                    setHasChanges(true);
                  }}
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                  Maximum alerts that can be grouped into a single incident (1-10000)
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Current Status */}
        {groupingRule && (
          <Card style={[styles.card, { backgroundColor: colors.surface }]}>
            <Card.Content>
              <View style={styles.statusHeader}>
                <MaterialCommunityIcons name="information" size={20} color={colors.primary} />
                <Text variant="titleMedium" style={{ color: colors.textPrimary, marginLeft: 8 }}>
                  Current Configuration
                </Text>
              </View>
              <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 8 }}>
                Last updated: {new Date(groupingRule.updatedAt).toLocaleString()}
              </Text>
              {groupingRule.description && (
                <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginTop: 8 }}>
                  {groupingRule.description}
                </Text>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actions, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Button
          mode="outlined"
          onPress={handleReset}
          disabled={!groupingRule || saving}
          style={styles.resetButton}
        >
          Reset to Defaults
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving || !hasChanges}
          style={styles.saveButton}
        >
          Save Changes
        </Button>
      </View>
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
    paddingBottom: 100,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    marginLeft: 12,
    fontWeight: '600',
  },
  fieldLabel: {
    marginBottom: 8,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 8,
  },
  groupingTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  groupingTypeCard: {
    width: '47%',
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 110,
  },
  groupingTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    marginVertical: 20,
  },
  fieldsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  fieldChip: {
    marginRight: 4,
  },
  addFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestedFields: {
    marginTop: 12,
  },
  suggestedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  suggestedChip: {
    borderRadius: 6,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  resetButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});
