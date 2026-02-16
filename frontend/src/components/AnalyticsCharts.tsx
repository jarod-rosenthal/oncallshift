import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { getSeveritySolidColor } from '../lib/colors';

// Define Tailwind colors as hex values for recharts
const tailwindColors = {
  danger: '#ef4444',     // red-500
  warning: '#f59e0b',    // amber-500
  'yellow-500': '#eab308', // yellow-500
  primary: '#3b82f6',    // blue-500
  'neutral-400': '#a3a3a3', // neutral-400
  green: '#22c55e',      // green-500
  red: '#ef4444',        // red-500
  yellow: '#eab308',     // yellow-500
} as const;

// Map Tailwind classes to hex colors
const getHexColor = (tailwindClass: string): string => {
  if (tailwindClass.startsWith('bg-')) {
    const colorKey = tailwindClass.replace('bg-', '') as keyof typeof tailwindColors;
    return tailwindColors[colorKey] || tailwindColors.primary;
  }
  return tailwindColors.primary;
};

// Get severity color that matches the original getSeveritySolidColor mapping
const getSeverityColor = (severity: string): string => {
  const tailwindClass = getSeveritySolidColor(severity);
  return getHexColor(tailwindClass);
};

// Get compliance-based color for SLA charts
const getComplianceColor = (rate: number): string => {
  if (rate >= 90) return tailwindColors.green;
  if (rate >= 70) return tailwindColors.yellow;
  return tailwindColors.red;
};

interface SeverityBreakdownChartProps {
  data: Record<string, number>;
  totalIncidents: number;
}

export function SeverityBreakdownChart({ data, totalIncidents }: SeverityBreakdownChartProps) {
  // Transform data for recharts with calculated fill colors
  const chartData = Object.entries(data).map(([severity, count]) => ({
    severity: severity.charAt(0).toUpperCase() + severity.slice(1),
    count,
    percentage: Math.min((count / (totalIncidents || 1)) * 100, 100),
    fill: getSeverityColor(severity),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="severity"
          className="text-muted-foreground"
          tick={{ fontSize: 12 }}
        />
        <YAxis
          className="text-muted-foreground"
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '12px'
          }}
          formatter={(value: number, name: string) => [
            `${value} incidents`,
            'Count'
          ]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface DailyTrendChartProps {
  data: Array<{ date: string; count: number }>;
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
  // Transform data for recharts
  const chartData = data.map((day) => ({
    date: new Date(day.date).getDate(),
    count: day.count,
    fullDate: day.date,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          className="text-muted-foreground"
          tick={{ fontSize: 12 }}
        />
        <YAxis
          className="text-muted-foreground"
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '12px'
          }}
          formatter={(value: number, name: string) => [
            `${value} incidents`,
            'Count'
          ]}
          labelFormatter={(label) => {
            const item = chartData.find(d => d.date === label);
            return item ? `Date: ${item.fullDate}` : `Day ${label}`;
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={tailwindColors.primary}
          fill={tailwindColors.primary}
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface SLAComplianceTrendChartProps {
  data: Array<{ date: string; ackComplianceRate: number; totalIncidents?: number }>;
}

export function SLAComplianceTrendChart({ data }: SLAComplianceTrendChartProps) {
  // Transform data for recharts with dynamic colors based on compliance rate
  const chartData = data.map((day) => ({
    date: new Date(day.date).getDate(),
    ackComplianceRate: day.ackComplianceRate,
    fullDate: day.date,
    fill: getComplianceColor(day.ackComplianceRate),
    totalIncidents: day.totalIncidents || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          className="text-muted-foreground"
          tick={{ fontSize: 12 }}
        />
        <YAxis
          domain={[0, 100]}
          className="text-muted-foreground"
          tick={{ fontSize: 12 }}
          label={{ value: 'Compliance %', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '12px'
          }}
          formatter={(value: number, name: string) => [
            `${value}%`,
            'Ack Compliance'
          ]}
          labelFormatter={(label) => {
            const item = chartData.find(d => d.date === label);
            return item ? `Date: ${item.fullDate}` : `Day ${label}`;
          }}
        />
        <Bar dataKey="ackComplianceRate" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}