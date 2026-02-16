import { useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import type { HeatmapData } from '../lib/api-client';

interface IncidentHeatmapProps {
  data: HeatmapData;
  className?: string;
}

interface HeatmapCellProps {
  dayOfWeek: number;
  hour: number;
  count: number;
  maxCount: number;
  onHover: (data: { dayOfWeek: number; hour: number; count: number } | null) => void;
}

interface TooltipData {
  dayOfWeek: number;
  hour: number;
  count: number;
  x: number;
  y: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HeatmapCell({ dayOfWeek, hour, count, maxCount, onHover }: HeatmapCellProps) {
  // Calculate color intensity based on count
  const intensity = maxCount > 0 ? count / maxCount : 0;

  // Create red intensity from white (0) to red (1)
  const getBackgroundColor = (intensity: number) => {
    if (intensity === 0) return 'rgb(255, 255, 255)'; // White for 0
    // Scale from very light red to dark red
    const redScale = Math.round(255 - (intensity * 155)); // Scale from 255 to 100 (lighter red range)
    return `rgb(255, ${redScale}, ${redScale})`;
  };

  const getBorderColor = (intensity: number) => {
    if (intensity === 0) return 'rgb(229, 231, 235)'; // Light gray border for empty cells
    return 'rgb(185, 28, 28)'; // Dark red border for cells with data
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onHover({
      dayOfWeek,
      hour,
      count,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const handleMouseLeave = () => {
    onHover(null);
  };

  return (
    <div
      className="w-full h-full border cursor-pointer hover:ring-2 hover:ring-primary/50 hover:z-10 relative transition-all duration-200"
      style={{
        backgroundColor: getBackgroundColor(intensity),
        borderColor: getBorderColor(intensity),
        minHeight: '20px',
        minWidth: '12px',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-day={dayOfWeek}
      data-hour={hour}
      data-count={count}
    />
  );
}

function CustomTooltip({ data }: { data: TooltipData | null }) {
  if (!data) return null;

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  return (
    <div
      className="absolute z-50 px-3 py-2 bg-popover border border-border rounded-md shadow-md text-sm pointer-events-none"
      style={{
        left: data.x - 80, // Center the tooltip
        top: data.y - 60,
        transform: 'translateY(-100%)',
      }}
    >
      <div className="font-medium">{DAYS[data.dayOfWeek]}</div>
      <div className="text-muted-foreground">{formatTime(data.hour)}</div>
      <div className="font-semibold text-primary">
        {data.count} {data.count === 1 ? 'incident' : 'incidents'}
      </div>
    </div>
  );
}

export function IncidentHeatmap({ data, className }: IncidentHeatmapProps) {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);

  // Create a map for quick lookup of incident counts
  const incidentMap = useMemo(() => {
    const map = new Map<string, number>();
    data.heatmap.forEach(item => {
      const key = `${item.dayOfWeek}-${item.hour}`;
      map.set(key, item.count);
    });
    return map;
  }, [data.heatmap]);

  const getIncidentCount = (dayOfWeek: number, hour: number) => {
    return incidentMap.get(`${dayOfWeek}-${hour}`) || 0;
  };

  const handleCellHover = (hoverData: { dayOfWeek: number; hour: number; count: number; x: number; y: number } | null) => {
    setTooltipData(hoverData);
  };

  return (
    <div className={cn('w-full relative', className)}>
      {/* Hour labels */}
      <div className="grid grid-cols-[80px_1fr] gap-2 mb-3">
        <div></div> {/* Empty space above day labels */}
        <div className="grid grid-cols-24 gap-[2px]">
          {HOURS.map(hour => (
            <div
              key={hour}
              className="text-xs text-muted-foreground text-center font-mono"
            >
              {hour % 6 === 0 ? hour.toString().padStart(2, '0') : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="grid grid-cols-[80px_1fr] gap-2">
        {/* Day labels */}
        <div className="grid grid-rows-7 gap-[2px]">
          {DAY_ABBR.map(day => (
            <div
              key={day}
              className="text-sm text-muted-foreground flex items-center justify-end pr-2 font-medium"
              style={{ height: '22px' }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Heatmap cells */}
        <div className="grid grid-rows-7 grid-cols-24 gap-[2px]">
          {DAY_ABBR.map((_, dayIndex) =>
            HOURS.map(hour => {
              const count = getIncidentCount(dayIndex, hour);
              return (
                <HeatmapCell
                  key={`${dayIndex}-${hour}`}
                  dayOfWeek={dayIndex}
                  hour={hour}
                  count={count}
                  maxCount={data.maxCount}
                  onHover={handleCellHover}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Custom Tooltip */}
      <CustomTooltip data={tooltipData} />

      {/* Legend */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Incidents by day of week and hour
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Less</span>
          <div className="flex gap-1">
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((intensity, index) => (
              <div
                key={index}
                className="w-3 h-3 border border-gray-200 rounded-sm"
                style={{
                  backgroundColor: intensity === 0 ? 'rgb(255, 255, 255)' : `rgb(255, ${Math.round(255 - (intensity * 155))}, ${Math.round(255 - (intensity * 155))})`,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">More</span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Period: {new Date(data.filters.startDate).toLocaleDateString()} - {new Date(data.filters.endDate).toLocaleDateString()}
        </span>
        <span>
          Peak: {data.maxCount} {data.maxCount === 1 ? 'incident' : 'incidents'}
        </span>
      </div>
    </div>
  );
}

export default IncidentHeatmap;