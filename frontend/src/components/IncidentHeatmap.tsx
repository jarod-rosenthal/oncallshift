import { useState, useEffect } from 'react';
import { analyticsAPI, type HeatmapData } from '../lib/api-client';

interface IncidentHeatmapProps {
  startDate?: string;
  endDate?: string;
  severity?: string;
  serviceId?: string;
}

export function IncidentHeatmap({ startDate, endDate, severity, serviceId }: IncidentHeatmapProps) {
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Day labels - Monday (0) to Sunday (6) as per dayOfWeek convention
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Hour labels - 0 to 23
  const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

  useEffect(() => {
    loadHeatmapData();
  }, [startDate, endDate, severity, serviceId]);

  const loadHeatmapData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsAPI.getHeatmap(startDate, endDate, severity, serviceId);
      setHeatmapData(data);
    } catch (err) {
      console.error('Failed to load heatmap data:', err);
      setError('Failed to load heatmap data');
    } finally {
      setLoading(false);
    }
  };

  const getColorIntensity = (count: number, maxCount: number): string => {
    if (count === 0) return 'bg-gray-50 border-gray-200';

    // Calculate intensity as percentage of max
    const intensity = Math.min(count / maxCount, 1);

    if (intensity <= 0.2) return 'bg-red-100 border-red-200';
    if (intensity <= 0.4) return 'bg-red-200 border-red-300';
    if (intensity <= 0.6) return 'bg-red-300 border-red-400';
    if (intensity <= 0.8) return 'bg-red-400 border-red-500';
    return 'bg-red-500 border-red-600 text-white';
  };

  const formatTooltip = (day: number, hour: number, count: number): string => {
    const dayName = dayLabels[day];
    const time = hour === 0 ? '12:00 AM' :
                 hour < 12 ? `${hour}:00 AM` :
                 hour === 12 ? '12:00 PM' :
                 `${hour - 12}:00 PM`;

    return `${dayName} ${time}: ${count} incident${count !== 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading heatmap...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading heatmap</p>
          <button
            onClick={loadHeatmapData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!heatmapData || !heatmapData.heatmapData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No heatmap data available</p>
      </div>
    );
  }

  const { heatmapData: data, maxCount, totalIncidents } = heatmapData;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div>
          Total: {totalIncidents} incidents
        </div>
        <div>
          Peak: {maxCount} incidents in a single hour
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Hour headers */}
          <div className="flex">
            <div className="w-12 h-8"></div> {/* Empty corner */}
            {hourLabels.map((hour) => (
              <div
                key={hour}
                className="w-8 h-8 flex items-center justify-center text-xs font-medium text-muted-foreground"
              >
                {hour}
              </div>
            ))}
          </div>

          {/* Data grid */}
          {data.map((dayData, dayIndex) => (
            <div key={dayIndex} className="flex">
              {/* Day label */}
              <div className="w-12 h-8 flex items-center justify-start text-xs font-medium text-muted-foreground">
                {dayLabels[dayIndex]}
              </div>

              {/* Hour cells */}
              {dayData.map((count, hourIndex) => (
                <div
                  key={hourIndex}
                  className={`
                    w-8 h-8 border border-solid cursor-pointer transition-all duration-200 hover:opacity-80
                    ${getColorIntensity(count, maxCount)}
                  `}
                  title={formatTooltip(dayIndex, hourIndex, count)}
                >
                  {count > 0 && maxCount > 0 && (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-medium">
                      {count > 99 ? '99+' : count > 9 ? count : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t">
        <span className="text-xs text-muted-foreground">Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded-sm"></div>
          <div className="w-3 h-3 bg-red-100 border border-red-200 rounded-sm"></div>
          <div className="w-3 h-3 bg-red-200 border border-red-300 rounded-sm"></div>
          <div className="w-3 h-3 bg-red-300 border border-red-400 rounded-sm"></div>
          <div className="w-3 h-3 bg-red-400 border border-red-500 rounded-sm"></div>
          <div className="w-3 h-3 bg-red-500 border border-red-600 rounded-sm"></div>
        </div>
        <span className="text-xs text-muted-foreground">More</span>
      </div>
    </div>
  );
}