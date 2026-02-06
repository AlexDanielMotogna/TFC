'use client';

interface SparklineProps {
  /** Array of data points (numbers) */
  data: number[];
  /** Color of the line */
  color?: string;
  /** Width of the sparkline */
  width?: number;
  /** Height of the sparkline */
  height?: number;
  /** Show trend indicator (up/down arrow) */
  showTrend?: boolean;
}

export function Sparkline({
  data,
  color = '#6366f1',
  width = 60,
  height = 24,
  showTrend = false
}: SparklineProps) {
  if (!data || data.length < 2) {
    return null;
  }

  // Calculate min and max for scaling
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  // Create SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(' L ')}`;

  // Calculate trend
  const trend = (data[data.length - 1] ?? 0) - (data[0] ?? 0);
  const isUp = trend >= 0;

  return (
    <div className="flex items-center gap-2">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="opacity-70"
        style={{ overflow: 'visible' }}
      >
        {/* Gradient for area fill */}
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area under the line */}
        <path
          d={`${pathData} L ${width},${height} L 0,${height} Z`}
          fill={`url(#gradient-${color.replace('#', '')})`}
        />

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showTrend && (
        <span className={`text-xs ${isUp ? 'text-win-400' : 'text-loss-400'}`}>
          {isUp ? '↑' : '↓'}
        </span>
      )}
    </div>
  );
}

/**
 * Generate mock trend data for a stat
 * In real app, this would come from historical data
 */
export function generateMockTrendData(
  currentValue: number,
  dataPoints: number = 10,
  volatility: number = 0.15
): number[] {
  const data: number[] = [];
  let value = currentValue * (1 - volatility);

  for (let i = 0; i < dataPoints; i++) {
    const randomChange = (Math.random() - 0.5) * volatility * currentValue;
    value = Math.max(0, value + randomChange);
    data.push(value);
  }

  // Ensure last value trends toward current value
  data[dataPoints - 1] = currentValue;

  return data;
}
