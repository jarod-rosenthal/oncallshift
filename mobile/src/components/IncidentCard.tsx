import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Checkbox,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useAppTheme } from '../context/ThemeContext';
import { severityColors, statusColors } from '../theme';
import { OwnerAvatar } from './OwnerAvatar';
import { EscalationBadge } from './EscalationBadge';
import UrgencyIndicator from './UrgencyIndicator';
import * as hapticService from '../services/hapticService';
import type { Incident } from '../services/apiService';

export interface IncidentCardProps {
  incident: Incident;
  onPress: (incident: Incident) => void;
  onAcknowledge?: (incident: Incident) => void;
  onResolve?: (incident: Incident) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onLongPress?: (incident: Incident) => void;
  swipeEnabled?: boolean;
  showQuickActions?: boolean;
  escalationTimeoutMinutes?: number;
  urgencyThresholdMinutes?: number;
}

export function IncidentCard({
  incident,
  onPress,
  onAcknowledge,
  onResolve,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  onLongPress,
  swipeEnabled = true,
  showQuickActions = true,
  escalationTimeoutMinutes = 30,
  urgencyThresholdMinutes = 5,
}: IncidentCardProps) {
  const { colors } = useAppTheme();
  const assignee = incident.acknowledgedBy || incident.resolvedBy;
  const isActionable = incident.state !== 'resolved';

  const getSeverityColor = (severity: string) => {
    return severityColors[severity as keyof typeof severityColors] || severityColors.default;
  };

  const getStatusColor = (state: string) => {
    return statusColors[state as keyof typeof statusColors] || colors.textSecondary;
  };

  const formatTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const handlePress = () => {
    if (isSelectionMode && isActionable) {
      onToggleSelection?.(incident.id);
    } else {
      onPress(incident);
    }
  };

  const handleLongPress = () => {
    if (!isSelectionMode && isActionable && onLongPress) {
      onLongPress(incident);
    }
  };

  const handleAcknowledge = () => {
    hapticService.mediumTap();
    onAcknowledge?.(incident);
  };

  const handleResolve = () => {
    hapticService.mediumTap();
    onResolve?.(incident);
  };

  // Swipe action renderers
  const renderLeftActions = useCallback(
    (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      if (incident.state === 'resolved' || !onResolve) return null;

      const trans = dragX.interpolate({
        inputRange: [0, 50, 100, 101],
        outputRange: [-20, 0, 0, 1],
      });

      return (
        <Animated.View style={[styles(colors).leftAction, { transform: [{ translateX: trans }] }]}>
          <Pressable
            style={[styles(colors).actionButton, { backgroundColor: colors.success }]}
            onPress={handleResolve}
          >
            <MaterialCommunityIcons name="check-all" size={24} color="#fff" />
            <Text style={styles(colors).actionText}>Resolve</Text>
          </Pressable>
        </Animated.View>
      );
    },
    [colors, incident.state, onResolve]
  );

  const renderRightActions = useCallback(
    (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      if (incident.state !== 'triggered' || !onAcknowledge) return null;

      const trans = dragX.interpolate({
        inputRange: [-101, -100, -50, 0],
        outputRange: [-1, 0, 0, 20],
      });

      return (
        <Animated.View style={[styles(colors).rightActions, { transform: [{ translateX: trans }] }]}>
          <Pressable
            style={styles(colors).actionButton}
            onPress={handleAcknowledge}
          >
            <MaterialCommunityIcons name="check" size={24} color="#fff" />
            <Text style={styles(colors).actionText}>Ack</Text>
          </Pressable>
        </Animated.View>
      );
    },
    [colors, incident.state, onAcknowledge]
  );

  const cardContent = (
    <Pressable onPress={handlePress} onLongPress={handleLongPress}>
      <Card style={[styles(colors).card, isSelected && styles(colors).cardSelected]} mode="elevated">
        {/* Severity indicator bar */}
        <View style={[styles(colors).severityBar, { backgroundColor: getSeverityColor(incident.severity) }]} />

        <Card.Content style={styles(colors).cardContent}>
          <View style={styles(colors).cardRow}>
            {/* Selection checkbox */}
            {isSelectionMode && (
              <View style={styles(colors).checkboxContainer}>
                <Checkbox
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => isActionable && onToggleSelection?.(incident.id)}
                  color={colors.accent}
                  disabled={!isActionable}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              {/* Top row: incident number, status, time */}
              <View style={styles(colors).cardTopRow}>
                <View style={styles(colors).incidentMeta}>
                  <Text style={styles(colors).incidentNumber}>#{incident.incidentNumber}</Text>
                  <View style={[styles(colors).statusBadge, { backgroundColor: getStatusColor(incident.state) + '20' }]}>
                    <View style={[styles(colors).statusDot, { backgroundColor: getStatusColor(incident.state) }]} />
                    <Text style={[styles(colors).statusText, { color: getStatusColor(incident.state) }]}>
                      {incident.state === 'triggered' ? 'Active' : incident.state}
                    </Text>
                  </View>
                  {incident.state === 'triggered' && (
                    <EscalationBadge
                      triggeredAt={incident.triggeredAt}
                      escalationTimeoutMinutes={escalationTimeoutMinutes}
                    />
                  )}
                  <UrgencyIndicator
                    triggeredAt={incident.triggeredAt}
                    state={incident.state}
                    thresholdMinutes={urgencyThresholdMinutes}
                  />
                </View>
                <Text style={styles(colors).timeText}>{formatTimeSince(incident.triggeredAt)}</Text>
              </View>

              {/* Title */}
              <Text variant="titleMedium" style={styles(colors).title} numberOfLines={2}>
                {incident.summary}
              </Text>

              {/* Bottom row: service, assignee */}
              <View style={styles(colors).cardBottomRow}>
                <View style={styles(colors).serviceChip}>
                  <MaterialCommunityIcons name="server" size={12} color={colors.textSecondary} />
                  <Text style={styles(colors).serviceText}>{incident.service.name}</Text>
                </View>

                {assignee && (
                  <OwnerAvatar
                    name={assignee.fullName}
                    email={assignee.email}
                    size={26}
                    showName
                  />
                )}
              </View>

              {/* Quick Actions */}
              {showQuickActions && incident.state !== 'resolved' && !isSelectionMode && (
                <View style={styles(colors).quickActions}>
                  {onResolve && (
                    <Button
                      mode="contained"
                      compact
                      buttonColor={colors.success}
                      textColor="#fff"
                      onPress={handleResolve}
                      style={styles(colors).actionButtonStyle}
                      labelStyle={styles(colors).actionButtonLabel}
                    >
                      Resolve
                    </Button>
                  )}
                  {incident.state === 'triggered' && onAcknowledge && (
                    <Button
                      mode="contained"
                      compact
                      buttonColor={colors.warning}
                      textColor="#fff"
                      onPress={handleAcknowledge}
                      style={styles(colors).actionButtonStyle}
                      labelStyle={styles(colors).actionButtonLabel}
                    >
                      Ack
                    </Button>
                  )}
                </View>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );

  if (swipeEnabled && !isSelectionMode) {
    return (
      <Swipeable
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
        onSwipeableOpen={() => hapticService.lightTap()}
      >
        {cardContent}
      </Swipeable>
    );
  }

  return cardContent;
}

const styles = (colors: any) =>
  StyleSheet.create({
    // Swipe Actions
    leftAction: {
      backgroundColor: colors.success,
      justifyContent: 'center',
      marginBottom: 10,
      borderRadius: 12,
      marginRight: -12,
    },
    rightActions: {
      flexDirection: 'row',
      marginBottom: 10,
      borderRadius: 12,
      marginLeft: -12,
      backgroundColor: colors.warning,
    },
    actionButton: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      paddingVertical: 8,
    },
    actionText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
    // Card
    card: {
      marginBottom: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    cardSelected: {
      borderWidth: 2,
      borderColor: colors.accent,
    },
    severityBar: {
      height: 4,
      width: '100%',
    },
    cardContent: {
      paddingTop: 12,
      paddingBottom: 12,
      paddingHorizontal: 14,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    checkboxContainer: {
      marginRight: 8,
      marginTop: -4,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    incidentMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      flex: 1,
    },
    incidentNumber: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      gap: 4,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    timeText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    title: {
      color: colors.textPrimary,
      fontWeight: '600',
      marginBottom: 10,
      lineHeight: 22,
      fontSize: 15,
    },
    cardBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    serviceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    serviceText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    quickActions: {
      flexDirection: 'row',
      marginTop: 12,
      gap: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    actionButtonStyle: {
      flex: 1,
      borderRadius: 8,
    },
    actionButtonLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
  });

export default IncidentCard;
