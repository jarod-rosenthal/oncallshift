import React, { useState, useEffect, useMemo } from 'react';
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
  Chip,
  ActivityIndicator,
  Portal,
  Modal,
  Button,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import * as apiService from '../services/apiService';
import type { OnCallData, Schedule } from '../services/apiService';
import * as hapticService from '../services/hapticService';

interface CalendarDay {
  date: Date;
  dateStr: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  shifts: OnCallShift[];
}

interface OnCallShift {
  scheduleId: string;
  scheduleName: string;
  serviceName: string;
  color: string;
  isOverride: boolean;
}

const SHIFT_COLORS = [
  '#6366f1', // Indigo
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function OnCallCalendarScreen() {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [onCallData, setOnCallData] = useState<OnCallData[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [oncall, scheduleList] = await Promise.all([
        apiService.getOnCallData(),
        apiService.getSchedules().catch(() => []),
      ]);
      setOnCallData(oncall);
      setSchedules(scheduleList);
    } catch (error) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Generate calendar days for the current month view
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the Sunday of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // End on the Saturday of the week containing the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const isToday = current.getTime() === today.getTime();
      const isCurrentMonth = current.getMonth() === month;

      // Find shifts for this day
      const shifts: OnCallShift[] = [];

      // For each schedule where user is on-call, check if this day falls within their shift
      onCallData.forEach((oc, index) => {
        // If user is currently on-call for this schedule, show it on future days
        // In a real implementation, you'd have actual shift start/end times
        if (oc.oncallUser && current >= today) {
          shifts.push({
            scheduleId: oc.schedule.id,
            scheduleName: oc.schedule.name,
            serviceName: oc.service.name,
            color: SHIFT_COLORS[index % SHIFT_COLORS.length],
            isOverride: oc.isOverride,
          });
        }
      });

      days.push({
        date: new Date(current),
        dateStr,
        isToday,
        isCurrentMonth,
        shifts,
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentMonth, onCallData]);

  // Count upcoming on-call days
  const upcomingOnCallDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return calendarDays.filter(
      (day) => day.shifts.length > 0 && day.date >= today && day.isCurrentMonth
    ).length;
  }, [calendarDays]);

  const goToPreviousMonth = () => {
    hapticService.lightTap();
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    hapticService.lightTap();
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    hapticService.lightTap();
    setCurrentMonth(new Date());
  };

  const handleDayPress = (day: CalendarDay) => {
    if (day.shifts.length > 0) {
      hapticService.lightTap();
      setSelectedDay(day);
      setShowDayModal(true);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading calendar...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Summary Card */}
        <Card style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.summaryIcon}>
              <MaterialCommunityIcons name="calendar-check" size={40} color={colors.primary} />
            </View>
            <View style={styles.summaryInfo}>
              <Text variant="headlineMedium" style={[styles.summaryNumber, { color: colors.textPrimary }]}>
                {upcomingOnCallDays}
              </Text>
              <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
                on-call days this month
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Calendar Header */}
        <View style={[styles.calendarHeader, { backgroundColor: colors.surface }]}>
          <View style={styles.monthNavigation}>
            <Pressable onPress={goToPreviousMonth} style={styles.navButton}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={goToToday}>
              <Text variant="titleLarge" style={[styles.monthTitle, { color: colors.textPrimary }]}>
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
            </Pressable>
            <Pressable onPress={goToNextMonth} style={styles.navButton}>
              <MaterialCommunityIcons name="chevron-right" size={28} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {DAYS_OF_WEEK.map((day) => (
              <View key={day} style={styles.dayHeader}>
                <Text variant="labelMedium" style={{ color: colors.textMuted }}>
                  {day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Calendar Grid */}
        <View style={[styles.calendarGrid, { backgroundColor: colors.surface }]}>
          {calendarDays.map((day, index) => (
            <Pressable
              key={day.dateStr}
              style={[
                styles.dayCell,
                !day.isCurrentMonth && styles.dayCellOutside,
                day.isToday && [styles.dayCellToday, { borderColor: colors.primary }],
              ]}
              onPress={() => handleDayPress(day)}
            >
              <Text
                variant="bodyMedium"
                style={[
                  styles.dayNumber,
                  { color: day.isCurrentMonth ? colors.textPrimary : colors.textMuted },
                  day.isToday && { color: colors.primary, fontWeight: 'bold' },
                ]}
              >
                {day.date.getDate()}
              </Text>
              {day.shifts.length > 0 && (
                <View style={styles.shiftIndicators}>
                  {day.shifts.slice(0, 3).map((shift, i) => (
                    <View
                      key={shift.scheduleId}
                      style={[styles.shiftDot, { backgroundColor: shift.color }]}
                    />
                  ))}
                  {day.shifts.length > 3 && (
                    <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                      +{day.shifts.length - 3}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text variant="labelMedium" style={[styles.legendTitle, { color: colors.textSecondary }]}>
            Your Schedules
          </Text>
          <View style={styles.legendItems}>
            {onCallData.map((oc, index) => (
              <View key={oc.schedule.id} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: SHIFT_COLORS[index % SHIFT_COLORS.length] },
                  ]}
                />
                <Text
                  variant="bodySmall"
                  style={{ color: colors.textPrimary }}
                  numberOfLines={1}
                >
                  {oc.schedule.name}
                </Text>
              </View>
            ))}
            {onCallData.length === 0 && (
              <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                No active on-call schedules
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Day Detail Modal */}
      <Portal>
        <Modal
          visible={showDayModal}
          onDismiss={() => setShowDayModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          {selectedDay && (
            <>
              <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {formatDate(selectedDay.date)}
              </Text>
              <Text variant="bodyMedium" style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                {selectedDay.shifts.length} on-call shift{selectedDay.shifts.length !== 1 ? 's' : ''}
              </Text>

              <View style={styles.shiftList}>
                {selectedDay.shifts.map((shift) => (
                  <Card
                    key={shift.scheduleId}
                    style={[styles.shiftCard, { backgroundColor: colors.surfaceVariant }]}
                  >
                    <Card.Content style={styles.shiftCardContent}>
                      <View style={[styles.shiftColorBar, { backgroundColor: shift.color }]} />
                      <View style={styles.shiftInfo}>
                        <Text variant="titleMedium" style={{ color: colors.textPrimary }}>
                          {shift.scheduleName}
                        </Text>
                        <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                          {shift.serviceName}
                        </Text>
                      </View>
                      {shift.isOverride && (
                        <Chip
                          compact
                          style={[styles.overrideChip, { backgroundColor: colors.warning + '20' }]}
                          textStyle={{ color: colors.warning, fontSize: 10 }}
                        >
                          Override
                        </Chip>
                      )}
                    </Card.Content>
                  </Card>
                ))}
              </View>

              <Button
                mode="text"
                onPress={() => setShowDayModal(false)}
                textColor={colors.textSecondary}
              >
                Close
              </Button>
            </>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  summaryCard: {
    margin: 16,
    borderRadius: 16,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryNumber: {
    fontWeight: 'bold',
  },
  calendarHeader: {
    marginHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 8,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontWeight: '600',
  },
  dayHeaders: {
    flexDirection: 'row',
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarGrid: {
    marginHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCellOutside: {
    opacity: 0.4,
  },
  dayCellToday: {
    borderWidth: 2,
    borderRadius: 8,
  },
  dayNumber: {
    fontSize: 14,
  },
  shiftIndicators: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    alignItems: 'center',
  },
  shiftDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legend: {
    margin: 16,
    padding: 16,
  },
  legendTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  modalSubtitle: {
    marginBottom: 16,
  },
  shiftList: {
    gap: 12,
    marginBottom: 16,
  },
  shiftCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  shiftCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shiftColorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  shiftInfo: {
    flex: 1,
  },
  overrideChip: {
    borderRadius: 8,
  },
});
