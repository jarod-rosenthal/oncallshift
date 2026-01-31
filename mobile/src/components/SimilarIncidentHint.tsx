import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Surface, ActivityIndicator, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as apiService from '../services/apiService';
import type { SimilarIncident, Incident } from '../services/apiService';
import { useAppTheme } from '../context/ThemeContext';

interface SimilarIncidentHintProps {
  currentIncident: Incident;
  onViewIncident: (incident: SimilarIncident) => void;
}

/**
 * Prominently displays the best matching similar incident with resolution hint
 * Shows above the fold on incident detail to help responders learn from past fixes
 */
export function SimilarIncidentHint({ currentIncident, onViewIncident }: SimilarIncidentHintProps) {
  const theme = useTheme();
  const { colors } = useAppTheme();
  const [bestMatch, setBestMatch] = useState<SimilarIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchSimilarIncidents();
  }, [currentIncident.id]);

  const fetchSimilarIncidents = async () => {
    try {
      setLoading(true);
      setError(false);
      const response = await apiService.getSimilarIncidents(currentIncident.id);
      setBestMatch(response.bestMatch);
    } catch (err) {
      console.error('Error fetching similar incidents:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything while loading or if no match
  if (loading) {
    return null; // Silent loading - don't show spinner for this
  }

  if (error || !bestMatch) {
    return null; // No match found - don't show anything
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <Surface style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]} elevation={1}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.info + '20' }]}>
          <MaterialCommunityIcons name="lightbulb-on" size={20} color={colors.info} />
        </View>
        <View style={styles.headerText}>
          <Text variant="titleSmall" style={[styles.title, { color: colors.textPrimary }]}>
            Similar Incident Found
          </Text>
          <Text variant="bodySmall" style={[styles.subtitle, { color: colors.textSecondary }]}>
            #{bestMatch.incidentNumber} • {formatTimeAgo(bestMatch.triggeredAt)}
            {bestMatch.state === 'resolved' && ' • Resolved'}
          </Text>
        </View>
        {bestMatch.similarityPercent >= 70 && (
          <View style={[styles.matchBadge, { backgroundColor: colors.success + '20' }]}>
            <Text style={[styles.matchBadgeText, { color: colors.success }]}>
              {bestMatch.similarityPercent}% match
            </Text>
          </View>
        )}
      </View>

      {/* Resolution hint - the key value */}
      {bestMatch.resolutionNote && bestMatch.state === 'resolved' && (
        <View style={[styles.resolutionHint, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
          <View style={styles.resolutionContent}>
            <Text variant="labelSmall" style={[styles.resolutionLabel, { color: colors.success }]}>
              How it was fixed:
            </Text>
            <Text variant="bodySmall" style={[styles.resolutionText, { color: colors.textPrimary }]} numberOfLines={3}>
              {truncateText(bestMatch.resolutionNote, 200)}
            </Text>
          </View>
        </View>
      )}

      {/* View button */}
      <Pressable
        style={[styles.viewButton, { borderColor: colors.info }]}
        onPress={() => onViewIncident(bestMatch)}
      >
        <Text style={[styles.viewButtonText, { color: colors.info }]}>
          View Incident #{bestMatch.incidentNumber}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.info} />
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 2,
  },
  matchBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resolutionHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  resolutionContent: {
    flex: 1,
  },
  resolutionLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  resolutionText: {
    lineHeight: 18,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SimilarIncidentHint;
