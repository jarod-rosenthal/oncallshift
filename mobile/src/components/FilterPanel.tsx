import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import {
  Text,
  Button,
  Chip,
  Divider,
  Portal,
  Modal,
  IconButton,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { colors, severityColors, statusColors } from '../theme';

export interface FilterState {
  status: ('triggered' | 'acknowledged' | 'resolved')[];
  severity: ('critical' | 'high' | 'medium' | 'low')[];
  assignedTo: 'me' | 'myTeam' | 'anyone';
  timeRange: '24h' | '7d' | '30d' | 'all';
  serviceIds: string[];
  searchQuery: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
}

export interface FilterPanelProps {
  visible: boolean;
  onDismiss: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  onClear: () => void;
  services?: { id: string; name: string }[];
  presets?: FilterPreset[];
  onSavePreset?: (name: string, filters: FilterState) => void;
  onDeletePreset?: (id: string) => void;
}

export const defaultFilters: FilterState = {
  status: ['triggered', 'acknowledged'],
  severity: ['critical', 'high', 'medium', 'low'],
  assignedTo: 'anyone',
  timeRange: '24h',
  serviceIds: [],
  searchQuery: '',
};

export function FilterPanel({
  visible,
  onDismiss,
  filters,
  onApply,
  onClear,
  services = [],
  presets = [],
  onSavePreset,
  onDeletePreset,
}: FilterPanelProps) {
  const { colors: themeColors } = useAppTheme();
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters, visible]);

  const toggleStatus = (status: 'triggered' | 'acknowledged' | 'resolved') => {
    setLocalFilters(prev => {
      const newStatus = prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status];
      return { ...prev, status: newStatus };
    });
  };

  const toggleSeverity = (severity: 'critical' | 'high' | 'medium' | 'low') => {
    setLocalFilters(prev => {
      const newSeverity = prev.severity.includes(severity)
        ? prev.severity.filter(s => s !== severity)
        : [...prev.severity, severity];
      return { ...prev, severity: newSeverity };
    });
  };

  const toggleService = (serviceId: string) => {
    setLocalFilters(prev => {
      const newServices = prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId];
      return { ...prev, serviceIds: newServices };
    });
  };

  const handleApply = () => {
    onApply(localFilters);
    onDismiss();
  };

  const handleClear = () => {
    setLocalFilters(defaultFilters);
    onClear();
    onDismiss();
  };

  const handleSavePreset = () => {
    if (presetName.trim() && onSavePreset) {
      onSavePreset(presetName.trim(), localFilters);
      setPresetName('');
      setShowSavePreset(false);
    }
  };

  const applyPreset = (preset: FilterPreset) => {
    setLocalFilters(preset.filters);
  };

  const getActiveFilterCount = (): number => {
    let count = 0;
    if (localFilters.status.length !== 2) count++; // Default is triggered + acknowledged
    if (localFilters.severity.length !== 4) count++;
    if (localFilters.assignedTo !== 'anyone') count++;
    if (localFilters.timeRange !== '24h') count++;
    if (localFilters.serviceIds.length > 0) count++;
    if (localFilters.searchQuery) count++;
    return count;
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modalContainer, { backgroundColor: themeColors.surface }]}
      >
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.title}>Filters</Text>
          <IconButton icon="close" onPress={onDismiss} size={24} />
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Saved Presets */}
          {presets.length > 0 && (
            <View style={styles.section}>
              <Text variant="labelLarge" style={styles.sectionTitle}>Saved Presets</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.presetRow}>
                  {presets.map(preset => (
                    <Chip
                      key={preset.id}
                      mode="outlined"
                      onPress={() => applyPreset(preset)}
                      onClose={onDeletePreset ? () => onDeletePreset(preset.id) : undefined}
                      style={styles.presetChip}
                    >
                      {preset.name}
                    </Chip>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Status Filter */}
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionTitle}>Status</Text>
            <View style={styles.chipRow}>
              <Chip
                selected={localFilters.status.includes('triggered')}
                onPress={() => toggleStatus('triggered')}
                style={[
                  styles.chip,
                  localFilters.status.includes('triggered') && { backgroundColor: statusColors.triggered + '30' }
                ]}
                textStyle={localFilters.status.includes('triggered') ? { color: statusColors.triggered } : undefined}
                icon={() => (
                  <View style={[styles.chipDot, { backgroundColor: statusColors.triggered }]} />
                )}
              >
                Triggered
              </Chip>
              <Chip
                selected={localFilters.status.includes('acknowledged')}
                onPress={() => toggleStatus('acknowledged')}
                style={[
                  styles.chip,
                  localFilters.status.includes('acknowledged') && { backgroundColor: statusColors.acknowledged + '30' }
                ]}
                textStyle={localFilters.status.includes('acknowledged') ? { color: statusColors.acknowledged } : undefined}
                icon={() => (
                  <View style={[styles.chipDot, { backgroundColor: statusColors.acknowledged }]} />
                )}
              >
                Acknowledged
              </Chip>
              <Chip
                selected={localFilters.status.includes('resolved')}
                onPress={() => toggleStatus('resolved')}
                style={[
                  styles.chip,
                  localFilters.status.includes('resolved') && { backgroundColor: statusColors.resolved + '30' }
                ]}
                textStyle={localFilters.status.includes('resolved') ? { color: statusColors.resolved } : undefined}
                icon={() => (
                  <View style={[styles.chipDot, { backgroundColor: statusColors.resolved }]} />
                )}
              >
                Resolved
              </Chip>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Severity Filter */}
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionTitle}>Severity</Text>
            <View style={styles.chipRow}>
              <Chip
                selected={localFilters.severity.includes('critical')}
                onPress={() => toggleSeverity('critical')}
                style={[
                  styles.chip,
                  localFilters.severity.includes('critical') && { backgroundColor: severityColors.critical + '30' }
                ]}
                textStyle={localFilters.severity.includes('critical') ? { color: severityColors.critical } : undefined}
                icon={() => (
                  <View style={[styles.chipDot, { backgroundColor: severityColors.critical }]} />
                )}
              >
                Critical
              </Chip>
              <Chip
                selected={localFilters.severity.includes('high')}
                onPress={() => toggleSeverity('high')}
                style={[
                  styles.chip,
                  localFilters.severity.includes('high') && { backgroundColor: severityColors.high + '30' }
                ]}
                textStyle={localFilters.severity.includes('high') ? { color: severityColors.high } : undefined}
                icon={() => (
                  <View style={[styles.chipDot, { backgroundColor: severityColors.high }]} />
                )}
              >
                High
              </Chip>
              <Chip
                selected={localFilters.severity.includes('medium')}
                onPress={() => toggleSeverity('medium')}
                style={[
                  styles.chip,
                  localFilters.severity.includes('medium') && { backgroundColor: severityColors.medium + '30' }
                ]}
                textStyle={localFilters.severity.includes('medium') ? { color: severityColors.medium } : undefined}
                icon={() => (
                  <View style={[styles.chipDot, { backgroundColor: severityColors.medium }]} />
                )}
              >
                Medium
              </Chip>
              <Chip
                selected={localFilters.severity.includes('low')}
                onPress={() => toggleSeverity('low')}
                style={[
                  styles.chip,
                  localFilters.severity.includes('low') && { backgroundColor: severityColors.low + '30' }
                ]}
                textStyle={localFilters.severity.includes('low') ? { color: severityColors.low } : undefined}
                icon={() => (
                  <View style={[styles.chipDot, { backgroundColor: severityColors.low }]} />
                )}
              >
                Low
              </Chip>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Assigned To Filter */}
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionTitle}>Assigned To</Text>
            <View style={styles.chipRow}>
              <Chip
                selected={localFilters.assignedTo === 'me'}
                onPress={() => setLocalFilters(prev => ({ ...prev, assignedTo: 'me' }))}
                style={styles.chip}
                icon="account"
              >
                Me
              </Chip>
              <Chip
                selected={localFilters.assignedTo === 'myTeam'}
                onPress={() => setLocalFilters(prev => ({ ...prev, assignedTo: 'myTeam' }))}
                style={styles.chip}
                icon="account-group"
              >
                My Team
              </Chip>
              <Chip
                selected={localFilters.assignedTo === 'anyone'}
                onPress={() => setLocalFilters(prev => ({ ...prev, assignedTo: 'anyone' }))}
                style={styles.chip}
                icon="account-multiple"
              >
                Anyone
              </Chip>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Time Range Filter */}
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionTitle}>Time Range</Text>
            <View style={styles.chipRow}>
              <Chip
                selected={localFilters.timeRange === '24h'}
                onPress={() => setLocalFilters(prev => ({ ...prev, timeRange: '24h' }))}
                style={styles.chip}
              >
                Last 24h
              </Chip>
              <Chip
                selected={localFilters.timeRange === '7d'}
                onPress={() => setLocalFilters(prev => ({ ...prev, timeRange: '7d' }))}
                style={styles.chip}
              >
                Last 7 days
              </Chip>
              <Chip
                selected={localFilters.timeRange === '30d'}
                onPress={() => setLocalFilters(prev => ({ ...prev, timeRange: '30d' }))}
                style={styles.chip}
              >
                Last 30 days
              </Chip>
              <Chip
                selected={localFilters.timeRange === 'all'}
                onPress={() => setLocalFilters(prev => ({ ...prev, timeRange: 'all' }))}
                style={styles.chip}
              >
                All time
              </Chip>
            </View>
          </View>

          {/* Services Filter */}
          {services.length > 0 && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.section}>
                <Text variant="labelLarge" style={styles.sectionTitle}>Services</Text>
                <View style={styles.chipRow}>
                  {services.slice(0, 8).map(service => (
                    <Chip
                      key={service.id}
                      selected={localFilters.serviceIds.includes(service.id)}
                      onPress={() => toggleService(service.id)}
                      style={styles.chip}
                      icon="server"
                    >
                      {service.name}
                    </Chip>
                  ))}
                </View>
                {services.length > 8 && (
                  <Text style={styles.moreText}>+{services.length - 8} more services</Text>
                )}
              </View>
            </>
          )}

          {/* Save Preset Section */}
          {onSavePreset && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.section}>
                {showSavePreset ? (
                  <View style={styles.savePresetRow}>
                    <TextInput
                      mode="outlined"
                      placeholder="Preset name"
                      value={presetName}
                      onChangeText={setPresetName}
                      style={styles.presetInput}
                      dense
                    />
                    <Button mode="contained" onPress={handleSavePreset} compact>
                      Save
                    </Button>
                    <IconButton icon="close" onPress={() => setShowSavePreset(false)} size={20} />
                  </View>
                ) : (
                  <Button
                    mode="outlined"
                    icon="content-save"
                    onPress={() => setShowSavePreset(true)}
                    style={styles.savePresetButton}
                  >
                    Save as Preset
                  </Button>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={handleClear}
            style={styles.actionButton}
          >
            Clear All
          </Button>
          <Button
            mode="contained"
            onPress={handleApply}
            style={styles.actionButton}
          >
            Apply{getActiveFilterCount() > 0 ? ` (${getActiveFilterCount()})` : ''}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

// Filter Chip component for showing active filters
export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Chip
      mode="outlined"
      onClose={onRemove}
      style={styles.filterChip}
      textStyle={styles.filterChipText}
      closeIcon="close-circle"
    >
      {label}
    </Chip>
  );
}

// Helper to get filter summary text
export function getFilterSummary(filters: FilterState): string {
  const parts: string[] = [];

  if (filters.status.length < 3) {
    parts.push(filters.status.join(', '));
  }

  if (filters.severity.length < 4) {
    parts.push(filters.severity.join(', '));
  }

  if (filters.assignedTo !== 'anyone') {
    parts.push(filters.assignedTo === 'me' ? 'Assigned to me' : 'My team');
  }

  if (filters.timeRange !== '24h') {
    const ranges = { '7d': '7 days', '30d': '30 days', 'all': 'All time' };
    parts.push(ranges[filters.timeRange] || filters.timeRange);
  }

  return parts.length > 0 ? parts.join(' | ') : 'All incidents';
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 16,
    borderRadius: 16,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 12,
  },
  sectionTitle: {
    color: colors.textSecondary,
    marginBottom: 12,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    marginVertical: 4,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  presetChip: {
    marginRight: 4,
  },
  moreText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  savePresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetInput: {
    flex: 1,
    height: 40,
  },
  savePresetButton: {
    borderColor: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  filterChip: {
    height: 32,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipText: {
    fontSize: 12,
  },
});

export default FilterPanel;
