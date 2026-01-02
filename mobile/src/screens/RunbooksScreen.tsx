import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  FAB,
  ActivityIndicator,
  Chip,
  IconButton,
  Menu,
  Divider,
  Button,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import { useToast } from '../components';
import * as runbookService from '../services/runbookService';
import type { Runbook } from '../services/runbookService';
import * as hapticService from '../services/hapticService';

export default function RunbooksScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchRunbooks();
  }, []);

  const fetchRunbooks = async () => {
    try {
      const data = await runbookService.listRunbooks();
      setRunbooks(data);
    } catch (error: any) {
      console.error('Failed to fetch runbooks:', error);
      showToast({ message: 'Failed to load runbooks', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRunbooks();
  }, []);

  const handleDelete = (runbook: Runbook) => {
    hapticService.warning();
    Alert.alert(
      'Delete Runbook',
      `Are you sure you want to delete "${runbook.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await runbookService.deleteRunbook(runbook.id);
              hapticService.success();
              showToast({ message: 'Runbook deleted', type: 'success' });
              fetchRunbooks();
            } catch (error: any) {
              showToast({ message: error.message || 'Failed to delete runbook', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleEdit = (runbook: Runbook) => {
    setMenuVisible(null);
    navigation.navigate('RunbookEditor', { runbookId: runbook.id });
  };

  const handleCreate = () => {
    hapticService.lightTap();
    navigation.navigate('RunbookEditor', {});
  };

  const handleSeedExamples = async () => {
    setSeeding(true);
    try {
      await runbookService.seedExampleRunbooks();
      hapticService.success();
      showToast({ message: 'Example runbooks created', type: 'success' });
      fetchRunbooks();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to seed runbooks', type: 'error' });
    } finally {
      setSeeding(false);
    }
  };

  // Group runbooks by service
  const groupedRunbooks = runbooks.reduce((acc, runbook) => {
    const serviceName = runbook.serviceName || 'No Service';
    if (!acc[serviceName]) {
      acc[serviceName] = [];
    }
    acc[serviceName].push(runbook);
    return acc;
  }, {} as Record<string, Runbook[]>);

  const getStepTypeCounts = (runbook: Runbook) => {
    let manual = 0;
    let automated = 0;
    let ai = 0;

    runbook.steps.forEach(step => {
      if (step.type === 'automated' && step.automation) {
        if (step.automation.mode === 'claude_code_api' || step.automation.script?.language === 'natural_language') {
          ai++;
        } else {
          automated++;
        }
      } else {
        manual++;
      }
    });

    return { manual, automated, ai };
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading runbooks...
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
        {runbooks.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="book-open-page-variant" size={64} color={colors.textMuted} />
            <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              No Runbooks Yet
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
              Create runbooks to standardize your incident response procedures.
            </Text>
            <Button
              mode="outlined"
              onPress={handleSeedExamples}
              loading={seeding}
              disabled={seeding}
              style={styles.seedButton}
              icon="auto-fix"
            >
              Create Example Runbooks
            </Button>
          </View>
        ) : (
          Object.entries(groupedRunbooks).map(([serviceName, serviceRunbooks]) => (
            <View key={serviceName} style={styles.serviceGroup}>
              <View style={styles.serviceHeader}>
                <MaterialCommunityIcons name="server" size={16} color={colors.textMuted} />
                <Text variant="titleSmall" style={[styles.serviceTitle, { color: colors.textMuted }]}>
                  {serviceName}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                  ({serviceRunbooks.length})
                </Text>
              </View>

              {serviceRunbooks.map((runbook) => {
                const stepCounts = getStepTypeCounts(runbook);

                return (
                  <Card
                    key={runbook.id}
                    style={[styles.runbookCard, { backgroundColor: colors.surface }]}
                    onPress={() => handleEdit(runbook)}
                  >
                    <Card.Content>
                      <View style={styles.runbookHeader}>
                        <View style={styles.runbookInfo}>
                          <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                            {runbook.title}
                          </Text>
                          {runbook.description && (
                            <Text
                              variant="bodySmall"
                              style={{ color: colors.textSecondary, marginTop: 2 }}
                              numberOfLines={2}
                            >
                              {runbook.description}
                            </Text>
                          )}

                          {/* Step counts */}
                          <View style={styles.stepCounts}>
                            <Chip
                              compact
                              style={[styles.countChip, { backgroundColor: `${colors.primary}15` }]}
                              textStyle={{ color: colors.primary, fontSize: 10 }}
                            >
                              {runbook.steps.length} steps
                            </Chip>
                            {stepCounts.automated > 0 && (
                              <Chip
                                compact
                                icon="code-tags"
                                style={[styles.countChip, { backgroundColor: `${colors.info}15` }]}
                                textStyle={{ color: colors.info, fontSize: 10 }}
                              >
                                {stepCounts.automated} script
                              </Chip>
                            )}
                            {stepCounts.ai > 0 && (
                              <Chip
                                compact
                                icon="robot"
                                style={[styles.countChip, { backgroundColor: `${colors.accent}15` }]}
                                textStyle={{ color: colors.accent, fontSize: 10 }}
                              >
                                {stepCounts.ai} AI
                              </Chip>
                            )}
                          </View>

                          {/* Severity badges */}
                          {runbook.severity && runbook.severity.length > 0 && (
                            <View style={styles.severityRow}>
                              {runbook.severity.map((sev) => (
                                <Chip
                                  key={sev}
                                  compact
                                  style={[styles.severityChip, { backgroundColor: getSeverityColor(sev) + '20' }]}
                                  textStyle={{ color: getSeverityColor(sev), fontSize: 9 }}
                                >
                                  {sev}
                                </Chip>
                              ))}
                            </View>
                          )}

                          {/* Tags */}
                          {runbook.tags && runbook.tags.length > 0 && (
                            <View style={styles.tagsRow}>
                              {runbook.tags.slice(0, 3).map((tag, idx) => (
                                <Text key={idx} style={[styles.tagText, { color: colors.textMuted }]}>
                                  #{tag}
                                </Text>
                              ))}
                              {runbook.tags.length > 3 && (
                                <Text style={[styles.tagText, { color: colors.textMuted }]}>
                                  +{runbook.tags.length - 3}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>

                        <Menu
                          visible={menuVisible === runbook.id}
                          onDismiss={() => setMenuVisible(null)}
                          anchor={
                            <IconButton
                              icon="dots-vertical"
                              size={20}
                              onPress={() => setMenuVisible(runbook.id)}
                            />
                          }
                        >
                          <Menu.Item
                            onPress={() => handleEdit(runbook)}
                            title="Edit"
                            leadingIcon="pencil"
                          />
                          <Divider />
                          <Menu.Item
                            onPress={() => {
                              setMenuVisible(null);
                              handleDelete(runbook);
                            }}
                            title="Delete"
                            leadingIcon="delete"
                            titleStyle={{ color: colors.error }}
                          />
                        </Menu>
                      </View>

                      {/* Author and date */}
                      <View style={styles.metaRow}>
                        {runbook.author && (
                          <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                            By {runbook.author.fullName}
                          </Text>
                        )}
                        <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                          Updated {new Date(runbook.lastUpdated).toLocaleDateString()}
                        </Text>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })}
            </View>
          ))
        )}

        {/* Seed examples button when there are runbooks */}
        {runbooks.length > 0 && (
          <Button
            mode="text"
            onPress={handleSeedExamples}
            loading={seeding}
            disabled={seeding}
            style={styles.seedButtonBottom}
            icon="auto-fix"
          >
            Add Example Runbooks
          </Button>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color="#fff"
        onPress={handleCreate}
      />
    </View>
  );
}

const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return '#C53030';
    case 'error':
    case 'high':
      return '#DD6B20';
    case 'warning':
    case 'medium':
      return '#D69E2E';
    case 'info':
    case 'low':
      return '#3182CE';
    default:
      return '#718096';
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  seedButton: {
    marginTop: 24,
  },
  seedButtonBottom: {
    marginTop: 16,
  },
  serviceGroup: {
    marginBottom: 24,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  serviceTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  runbookCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  runbookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  runbookInfo: {
    flex: 1,
  },
  stepCounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  countChip: {
    borderRadius: 6,
  },
  severityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  severityChip: {
    borderRadius: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tagText: {
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
