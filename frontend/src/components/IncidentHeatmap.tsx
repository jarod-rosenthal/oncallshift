import { useMemo } from 'react';
import type { HeatmapData } from '../lib/api-client';

interface IncidentHeatmapProps {
  data: HeatmapData | null;
  loading?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function IncidentHeatmap({ data, loading }: IncidentHeatmapProps) {
  const { heatmapGrid, maxCount } = useMemo(() => {
    if (!data) {
      return { heatmapGrid: [], maxCount: 0 };
    }

    // Create a map for quick lookup
    const dataMap = new Map<string, number>();
    data.data.forEach(item => {
      dataMap.set(`${item.dayOfWeek}-${item.hour}`, item.count);
    });

    // Find max count for color scaling
    const maxCount = Math.max(...data.data.map(item => item.count), 1);

    // Build grid: rows are days (0-6), columns are hours (0-23)
    const heatmapGrid = DAYS.map((dayName, dayIndex) => ({
      day: dayName,
      dayIndex,
      hours: HOURS.map(hour => ({
        hour,
        count: dataMap.get(`${dayIndex}-${hour}`) || 0,
      })),
    }));

    return { heatmapGrid, maxCount };
  }, [data]);

  const getIntensityColor = (count: number) => {
    if (count === 0) return 'bg-gray-50';
    const intensity = count / maxCount;

    if (intensity >= 0.8) return 'bg-red-600';
    if (intensity >= 0.6) return 'bg-red-500';
    if (intensity >= 0.4) return 'bg-red-400';
    if (intensity >= 0.2) return 'bg-red-300';
    return 'bg-red-200';
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12a';
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return '12p';
    return `${hour - 12}p`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No incident data available for the selected period
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded-sm"></div>
          <div className="w-3 h-3 bg-red-200 rounded-sm"></div>
          <div className="w-3 h-3 bg-red-300 rounded-sm"></div>
          <div className="w-3 h-3 bg-red-400 rounded-sm"></div>
          <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
          <div className="w-3 h-3 bg-red-600 rounded-sm"></div>
        </div>
        <span>More</span>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Hour Headers */}
          <div className="flex mb-1">
            <div className="w-12"></div> {/* Space for day labels */}
            {HOURS.map(hour => (
              <div key={hour} className="w-4 text-xs text-center text-muted-foreground">
                {hour % 6 === 0 ? formatHour(hour) : ''}
              </div>
            ))}
          </div>

          {/* Grid Rows */}
          {heatmapGrid.map(({ day, dayIndex, hours }) => (
            <div key={dayIndex} className="flex items-center mb-1">
              {/* Day Label */}
              <div className="w-12 text-xs text-muted-foreground text-right pr-2">
                {day}
              </div>

              {/* Hour Cells */}
              {hours.map(({ hour, count }) => (
                <div
                  key={hour}
                  className={`w-4 h-4 mx-px rounded-sm border border-gray-200 cursor-help ${getIntensityColor(count)}`}
                  title={`${day} ${formatHour(hour)}: ${count} incident${count !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="text-sm text-muted-foreground">
        Total incidents: {data.data.reduce((sum, item) => sum + item.count, 0)} |
        Peak: {maxCount} incidents |
        Period: {new Date(data.period.startDate).toLocaleDateString()} - {new Date(data.period.endDate).toLocaleDateString()}
      </div>
    </div>
  );
}