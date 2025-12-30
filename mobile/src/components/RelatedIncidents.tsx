import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Surface, ActivityIndicator, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as apiService from '../services/apiService';
import type { Incident } from '../services/apiService';
import { colors, severityColors, statusColors } from '../theme';

interface RelatedIncidentsProps {
  currentIncident: Incident;
  onIncidentPress: (incident: Incident) => void;
}

export default function RelatedIncidents({ currentIncident, onIncidentPress }: RelatedIncidentsProps) {
  const theme = useTheme();
  const [relatedIncidents, setRelatedIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Dynamic styles based on current theme
  const dynamicStyles = {
    container: {
      margin: 16,
      marginTop: 0,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden' as const,
    },
    headerTitle: {
      flex: 1,
      color: theme.colors.onSurface,
      fontWeight: '600' as const,
    },
    list: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
    },
    incidentItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      padding: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    incidentSummary: {
      color: theme.colors.onSurface,
      fontWeight: '500' as const,
      marginBottom: 4,
    },
    timeText: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
    },
  };

  useEffect(() => {
    fetchRelatedIncidents();
  }, [currentIncident.id]);

  const fetchRelatedIncidents = async () => {
    try {
      setLoading(true);
      // Fetch all incidents and filter for related ones
      const allIncidents = await apiService.getIncidents();

      // Filter related incidents:
      // 1. Same service
      // 2. Not the current incident
      // 3. Limit to recent ones (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const related = allIncidents
        .filter(i =>
          i.id !== currentIncident.id &&
          i.service.id === currentIncident.service.id &&
          new Date(i.triggeredAt) > thirtyDaysAgo
        )
        .sort((a, b) => {
          // Score by similarity - prioritize same severity and similar summary
          const aScore = getSimilarityScore(a, currentIncident);
          const bScore = getSimilarityScore(b, currentIncident);
          return bScore - aScore;
        })
        .slice(0, 5);

      setRelatedIncidents(related);
    } catch (error) {
      console.error('Error fetching related incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSimilarityScore = (incident: Incident, current: Incident): number => {
    let score = 0;

    // Same severity
    if (incident.severity === current.severity) score += 2;

    // Similar summary (contains common words)
    const currentWords = current.summary.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const incidentWords = incident.summary.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const commonWords = currentWords.filter(w => incidentWords.includes(w));
    score += commonWords.length;

    // More recent = higher score
    const daysSince = (Date.now() - new Date(incident.triggeredAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) score += 2;
    else if (daysSince < 14) score += 1;

    return score;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const getSeverityColor = (severity: string) => {
    return severityColors[severity as keyof typeof severityColors] || severityColors.default;
  };

  const getStatusColor = (state: string) => {
    return statusColors[state as keyof typeof statusColors] || colors.textSecondary;
  };

  if (loading) {
    return (
      <Surface style={dynamicStyles.container} elevation={0}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="link-variant" size={20} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleSmall" style={dynamicStyles.headerTitle}>Related Incidents</Text>
        </View>
        <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />
      </Surface>
    );
  }

  if (relatedIncidents.length === 0) {
    return null; // Don't show section if no related incidents
  }

  return (
    <Surface style={dynamicStyles.container} elevation={0}>
      <Pressable style={styles.header} onPress={() => setExpanded(!expanded)}>
        <MaterialCommunityIcons name="link-variant" size={20} color={theme.colors.primary} />
        <Text variant="titleSmall" style={dynamicStyles.headerTitle}>
          Related Incidents
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{relatedIncidents.length}</Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>

      {expanded && (
        <View style={dynamicStyles.list}>
          {relatedIncidents.map((incident) => (
            <Pressable
              key={incident.id}
              style={dynamicStyles.incidentItem}
              onPress={() => onIncidentPress(incident)}
            >
              <View style={[styles.severityDot, { backgroundColor: getSeverityColor(incident.severity) }]} />
              <View style={styles.incidentContent}>
                <Text variant="bodyMedium" style={dynamicStyles.incidentSummary} numberOfLines={1}>
                  {incident.summary}
                </Text>
                <View style={styles.incidentMeta}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(incident.state) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(incident.state) }]}>
                      {incident.state}
                    </Text>
                  </View>
                  <Text style={dynamicStyles.timeText}>{formatTimeAgo(incident.triggeredAt)}</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
            </Pressable>
          ))}

          <View style={styles.patternHint}>
            <MaterialCommunityIcons name="lightbulb-outline" size={16} color={colors.info} />
            <Text style={styles.patternHintText}>
              {relatedIncidents.length} similar incidents from {currentIncident.service.name} in the last 30 days
            </Text>
          </View>
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    padding: 16,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  incidentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  incidentContent: {
    flex: 1,
    marginRight: 8,
  },
  incidentSummary: {
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 4,
  },
  incidentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  patternHint: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.info + '10',
    gap: 8,
  },
  patternHintText: {
    flex: 1,
    fontSize: 12,
    color: colors.info,
    fontStyle: 'italic',
  },
});
