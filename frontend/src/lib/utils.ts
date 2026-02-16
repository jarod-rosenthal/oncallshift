import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculate color intensity for heatmap visualization
 * Returns appropriate Tailwind CSS class for heatmap cells
 * @param count - The count value for this cell
 * @param maxCount - The maximum count value across all cells
 * @param colorScheme - Color scheme to use ('red' | 'blue' | 'green')
 * @returns Tailwind CSS class for background color
 */
export function getHeatmapIntensityColor(
  count: number,
  maxCount: number,
  colorScheme: 'red' | 'blue' | 'green' = 'red'
): string {
  if (count === 0) return 'bg-gray-50';

  const intensity = count / Math.max(maxCount, 1);

  const colorMap = {
    red: {
      high: 'bg-red-600',
      mediumHigh: 'bg-red-500',
      medium: 'bg-red-400',
      mediumLow: 'bg-red-300',
      low: 'bg-red-200',
    },
    blue: {
      high: 'bg-blue-600',
      mediumHigh: 'bg-blue-500',
      medium: 'bg-blue-400',
      mediumLow: 'bg-blue-300',
      low: 'bg-blue-200',
    },
    green: {
      high: 'bg-green-600',
      mediumHigh: 'bg-green-500',
      medium: 'bg-green-400',
      mediumLow: 'bg-green-300',
      low: 'bg-green-200',
    },
  };

  const colors = colorMap[colorScheme];

  if (intensity >= 0.8) return colors.high;
  if (intensity >= 0.6) return colors.mediumHigh;
  if (intensity >= 0.4) return colors.medium;
  if (intensity >= 0.2) return colors.mediumLow;
  return colors.low;
}
