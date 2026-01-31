import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Surface,
  ActivityIndicator,
  useTheme,
  Divider,
  Badge,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as apiService from '../services/apiService';
import type { Incident, OnCallData, UserProfile } from '../services/apiService';
import { severityColors } from '../theme';
import { useAppTheme } from '../context/ThemeContext';
import { OwnerAvatar, useToast, GlobalSearch, SearchButton, OnCallBanner } from '../components';
import * as hapticService from '../services/hapticService';

interface IncidentSummary {
  triggered: number;
  acknowledged: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { colors } = useAppTheme();
  const themedStyles = styles(colors);
  const navigation = useNavigation<StackNavigationProp<any>>();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [incidentSummary, setIncidentSummary] = useState<IncidentSummary>({
    triggered: 0,
    acknowledged: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [myOnCall, setMyOnCall] = useState<OnCallData[]>([]);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [profile, triggeredIncidents, ackedIncidents, oncallData] = await Promise.all([
        apiService.getUserProfile().catch(() => null),
        apiService.getIncidents('triggered').catch(() => []),
        apiService.getIncidents('acknowledged').catch(() => []),
        apiService.getOnCallData().catch(() => []),
      ]);

      if (profile) {
        setCurrentUser(profile);
      }

      // Calculate incident summary
      const allActive = [...triggeredIncidents, ...ackedIncidents];
      const summary: IncidentSummary = {
        triggered: triggeredIncidents.length,
        acknowledged: ackedIncidents.length,
        critical: allActive.filter(i => i.severity === 'critical').length,
        high: allActive.filter(i => i.severity === 'high').length,
        medium: allActive.filter(i => i.severity === 'medium').length,
        low: allActive.filter(i => i.severity === 'low').length,
      };
      setIncidentSummary(summary);

      // Get 3 most recent triggered incidents
      setRecentIncidents(triggeredIncidents.slice(0, 3));

      // Filter to user's on-call assignments
      const myAssignments = oncallData.filter(
        item => item.oncallUser?.id === profile?.id
      );
      setMyOnCall(myAssignments);
    } catch (error) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleQuickAcknowledge = async (incidentId: string) => {
    setAcknowledging(incidentId);
    await hapticService.mediumTap();

    try {
      await apiService.acknowledgeIncident(incidentId);
      await hapticService.success();
      showSuccess('Incident has been acknowledged');
      fetchDashboardData();
    } catch (err: any) {
      await hapticService.error();
      showError(err.message || 'Failed to acknowledge');
    } finally {
      setAcknowledging(null);
    }
  };

  const formatTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getSeverityColor = (severity: string) => {
    return severityColors[severity as keyof typeof severityColors] || severityColors.default;
  };

  const totalActiveIncidents = incidentSummary.triggered + incidentSummary.acknowledged;
  const isOnCall = myOnCall.length > 0;

  if (loading) {
    return (
      <View style={[themedStyles.container, themedStyles.centerContent, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={themedStyles.loadingText}>
          Loading dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[themedStyles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[theme.colors.primary]}
        />
      }
      contentContainerStyle={themedStyles.scrollContent}
    >
      {/* Greeting & Search */}
      <View style={themedStyles.greetingSection}>
        <View style={themedStyles.greetingRow}>
          <View style={themedStyles.greetingText}>
            <Text variant="headlineSmall" style={themedStyles.greeting}>
              {getGreeting()}, {currentUser?.fullName?.split(' ')[0] || 'there'}
            </Text>
            <Text variant="bodyMedium" style={themedStyles.greetingSubtext}>
              {isOnCall ? "You're on-call" : 'Not currently on-call'}
            </Text>
          </View>
          <SearchButton onPress={() => setSearchVisible(true)} />
        </View>
      </View>

      {/* Global Search Modal */}
      <GlobalSearch
        visible={searchVisible}
        onDismiss={() => setSearchVisible(false)}
      />

      {/* On-Call Awareness Banner */}
      <OnCallBanner />

      {/* Incident Summary Card */}
      <Card style={themedStyles.summaryCard} mode="elevated">
        <Card.Content>
          <View style={themedStyles.summaryHeader}>
            <Text variant="titleMedium" style={themedStyles.sectionTitle}>Active Incidents</Text>
            <Badge
              size={24}
              style={[
                themedStyles.totalBadge,
                { backgroundColor: totalActiveIncidents > 0 ? colors.error : colors.success }
              ]}
            >
              {totalActiveIncidents}
            </Badge>
          </View>

          {totalActiveIncidents > 0 ? (
            <>
              {/* Status breakdown */}
              <View style={themedStyles.statusRow}>
                <View style={themedStyles.statusItem}>
                  <View style={[themedStyles.statusDot, { backgroundColor: colors.error }]} />
                  <Text style={themedStyles.statusLabel}>Active</Text>
                  <Text style={themedStyles.statusCount}>{incidentSummary.triggered}</Text>
                </View>
                <View style={themedStyles.statusItem}>
                  <View style={[themedStyles.statusDot, { backgroundColor: colors.warning }]} />
                  <Text style={themedStyles.statusLabel}>Acknowledged</Text>
                  <Text style={themedStyles.statusCount}>{incidentSummary.acknowledged}</Text>
                </View>
              </View>

              <Divider style={themedStyles.divider} />

              {/* Severity breakdown */}
              <View style={themedStyles.severityRow}>
                {incidentSummary.critical > 0 && (
                  <View style={[themedStyles.severityChip, { backgroundColor: severityColors.critical + '20' }]}>
                    <View style={[themedStyles.severityDot, { backgroundColor: severityColors.critical }]} />
                    <Text style={[themedStyles.severityText, { color: severityColors.critical }]}>
                      {incidentSummary.critical} Critical
                    </Text>
                  </View>
                )}
                {incidentSummary.high > 0 && (
                  <View style={[themedStyles.severityChip, { backgroundColor: severityColors.high + '20' }]}>
                    <View style={[themedStyles.severityDot, { backgroundColor: severityColors.high }]} />
                    <Text style={[themedStyles.severityText, { color: severityColors.high }]}>
                      {incidentSummary.high} High
                    </Text>
                  </View>
                )}
                {incidentSummary.medium > 0 && (
                  <View style={[themedStyles.severityChip, { backgroundColor: severityColors.medium + '20' }]}>
                    <View style={[themedStyles.severityDot, { backgroundColor: severityColors.medium }]} />
                    <Text style={[themedStyles.severityText, { color: severityColors.medium }]}>
                      {incidentSummary.medium} Medium
                    </Text>
                  </View>
                )}
                {incidentSummary.low > 0 && (
                  <View style={[themedStyles.severityChip, { backgroundColor: severityColors.low + '20' }]}>
                    <View style={[themedStyles.severityDot, { backgroundColor: severityColors.low }]} />
                    <Text style={[themedStyles.severityText, { color: severityColors.low }]}>
                      {incidentSummary.low} Low
                    </Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={themedStyles.allClearContainer}>
              <MaterialCommunityIcons name="check-circle" size={48} color={colors.success} />
              <Text variant="titleMedium" style={themedStyles.allClearText}>All Clear</Text>
              <Text variant="bodySmall" style={themedStyles.allClearSubtext}>
                No active incidents
              </Text>
            </View>
          )}

          <Button
            mode="contained"
            onPress={() => navigation.navigate('Main', { screen: 'Incidents' })}
            style={themedStyles.viewAllButton}
            icon="arrow-right"
            contentStyle={themedStyles.viewAllButtonContent}
          >
            View All Incidents
          </Button>
        </Card.Content>
      </Card>

      {/* Recent Triggered Incidents */}
      {recentIncidents.length > 0 && (
        <View style={themedStyles.recentSection}>
          <Text variant="titleMedium" style={themedStyles.sectionTitle}>Needs Attention</Text>
          {recentIncidents.map((incident) => (
            <Pressable
              key={incident.id}
              onPress={() => navigation.navigate('AlertDetail', { alert: incident })}
            >
              <Card style={themedStyles.incidentCard} mode="elevated">
                <View style={[themedStyles.incidentSeverityBar, { backgroundColor: getSeverityColor(incident.severity) }]} />
                <Card.Content style={themedStyles.incidentContent}>
                  <View style={themedStyles.incidentHeader}>
                    <Text variant="labelSmall" style={themedStyles.incidentNumber}>
                      #{incident.incidentNumber}
                    </Text>
                    <Text style={themedStyles.incidentTime}>{formatTimeSince(incident.triggeredAt)}</Text>
                  </View>
                  <Text variant="titleSmall" style={themedStyles.incidentTitle} numberOfLines={1}>
                    {incident.summary}
                  </Text>
                  <View style={themedStyles.incidentFooter}>
                    <View style={themedStyles.serviceTag}>
                      <MaterialCommunityIcons name="server" size={12} color={colors.textSecondary} />
                      <Text style={themedStyles.serviceName}>{incident.service.name}</Text>
                    </View>
                    <Button
                      mode="contained"
                      compact
                      buttonColor={colors.warning}
                      textColor="#fff"
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleQuickAcknowledge(incident.id);
                      }}
                      loading={acknowledging === incident.id}
                      disabled={acknowledging === incident.id}
                      style={themedStyles.ackButton}
                      labelStyle={themedStyles.ackButtonLabel}
                    >
                      Ack
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      {/* On-Call Status */}
      <View style={themedStyles.onCallSection}>
        <Text variant="titleMedium" style={themedStyles.sectionTitle}>Your On-Call Status</Text>
        <Card style={themedStyles.onCallCard} mode="elevated">
          <Card.Content>
            {isOnCall ? (
              <>
                <View style={themedStyles.onCallHeader}>
                  <View style={themedStyles.onCallLive}>
                    <View style={themedStyles.livePulse} />
                    <Text style={themedStyles.liveText}>ON-CALL</Text>
                  </View>
                  <Text style={themedStyles.onCallCount}>
                    {myOnCall.length} service{myOnCall.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={themedStyles.onCallServices}>
                  {myOnCall.slice(0, 3).map((item) => (
                    <View key={`${item.service.id}-${item.schedule.id}`} style={themedStyles.onCallServiceItem}>
                      <MaterialCommunityIcons name="server" size={16} color={colors.success} />
                      <Text style={themedStyles.onCallServiceName}>{item.service.name}</Text>
                      {item.isOverride && (
                        <View style={themedStyles.overrideBadge}>
                          <Text style={themedStyles.overrideBadgeText}>Override</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  {myOnCall.length > 3 && (
                    <Text style={themedStyles.moreServices}>+{myOnCall.length - 3} more</Text>
                  )}
                </View>
              </>
            ) : (
              <View style={themedStyles.notOnCallContainer}>
                <MaterialCommunityIcons name="phone-off" size={32} color={colors.textMuted} />
                <Text variant="titleSmall" style={themedStyles.notOnCallText}>
                  Not currently on-call
                </Text>
                <Text variant="bodySmall" style={themedStyles.notOnCallSubtext}>
                  Check the On-Call tab for schedules
                </Text>
              </View>
            )}
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Main', { screen: 'OnCall' })}
              style={themedStyles.viewOnCallButton}
              textColor={colors.accent}
            >
              {isOnCall ? 'Manage On-Call' : 'View Schedules'}
            </Button>
          </Card.Content>
        </Card>
      </View>

      {/* Quick Actions */}
      <View style={themedStyles.quickActionsSection}>
        <Text variant="titleMedium" style={themedStyles.sectionTitle}>Quick Actions</Text>
        <View style={themedStyles.quickActionsGrid}>
          <Pressable
            style={themedStyles.quickActionItem}
            onPress={() => navigation.navigate('Incidents')}
          >
            <View style={[themedStyles.quickActionIcon, { backgroundColor: colors.accent + '20' }]}>
              <MaterialCommunityIcons name="robot" size={24} color={colors.accent} />
            </View>
            <Text style={themedStyles.quickActionLabel}>AI Assistant</Text>
          </Pressable>

          <Pressable
            style={themedStyles.quickActionItem}
            onPress={() => navigation.navigate('OnCallCalendar')}
          >
            <View style={[themedStyles.quickActionIcon, { backgroundColor: colors.success + '20' }]}>
              <MaterialCommunityIcons name="calendar-month" size={24} color={colors.success} />
            </View>
            <Text style={themedStyles.quickActionLabel}>My Calendar</Text>
          </Pressable>

          <Pressable
            style={themedStyles.quickActionItem}
            onPress={() => navigation.navigate('Analytics')}
          >
            <View style={[themedStyles.quickActionIcon, { backgroundColor: colors.warning + '20' }]}>
              <MaterialCommunityIcons name="chart-bar" size={24} color={colors.warning} />
            </View>
            <Text style={themedStyles.quickActionLabel}>Analytics</Text>
          </Pressable>

          <Pressable
            style={themedStyles.quickActionItem}
            onPress={() => navigation.navigate('Team')}
          >
            <View style={[themedStyles.quickActionIcon, { backgroundColor: colors.primary + '20' }]}>
              <MaterialCommunityIcons name="account-group" size={24} color={colors.primary} />
            </View>
            <Text style={themedStyles.quickActionLabel}>Team</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.textSecondary,
  },
  // Greeting
  greetingSection: {
    padding: 20,
    paddingBottom: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: {
    flex: 1,
  },
  greeting: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  greetingSubtext: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  // Summary Card
  summaryCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  totalBadge: {
    fontWeight: 'bold',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 10,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  divider: {
    marginVertical: 8,
  },
  severityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  severityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  allClearContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  allClearText: {
    color: colors.success,
    fontWeight: '600',
    marginTop: 8,
  },
  allClearSubtext: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  viewAllButton: {
    marginTop: 4,
    borderRadius: 8,
  },
  viewAllButtonContent: {
    flexDirection: 'row-reverse',
  },
  // Recent Incidents
  recentSection: {
    padding: 16,
    paddingTop: 16,
  },
  incidentCard: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  incidentSeverityBar: {
    height: 4,
  },
  incidentContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  incidentNumber: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  incidentTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  incidentTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 10,
  },
  incidentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  serviceName: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  ackButton: {
    borderRadius: 6,
  },
  ackButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  // On-Call Section
  onCallSection: {
    padding: 16,
    paddingTop: 8,
  },
  onCallCard: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  onCallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  onCallLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.success,
    letterSpacing: 1,
  },
  onCallCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  onCallServices: {
    gap: 10,
    marginBottom: 16,
  },
  onCallServiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onCallServiceName: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  overrideBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  overrideBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.warning,
  },
  moreServices: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  notOnCallContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  notOnCallText: {
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 8,
  },
  notOnCallSubtext: {
    color: colors.textMuted,
    marginTop: 4,
  },
  viewOnCallButton: {
    borderColor: colors.accent,
    borderRadius: 8,
  },
  // Quick Actions
  quickActionsSection: {
    padding: 16,
    paddingTop: 8,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
  },
  quickActionItem: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
});
